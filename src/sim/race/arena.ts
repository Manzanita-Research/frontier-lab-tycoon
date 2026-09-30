// The Frontier Arena: a score from capability and hype, re-ranked once a week.
import { arenaScore, RIVAL_BY_ID, YOU, type RivalId } from "../../content/rivals";
import type { GameState } from "../types";
import { rankBoard, ranksOf, type BoardRow } from "./state";

export const rankOf = (board: BoardRow[]): number => {
  const index = board.findIndex((r) => r.id === YOU);
  return index < 0 ? board.length + 1 : index + 1;
};

/** Re-rank the Arena: rivals as they are, you as you are today. Remembers last week for the arrows. */
export function refreshBoard(state: GameState) {
  const race = state.race;
  race.prevRanks = ranksOf(race.board);
  race.board = rankBoard(state, race.rivals);
  const rank = rankOf(race.board);
  race.rankDelta = (race.prevRanks[YOU] ?? race.board.length + 1) - rank;
  race.rank = rank;
}

/** Where each rival stands against you when the Race opens, in Arena points, best first: five ahead, one behind (FLT-58). */
export const FIELD_MARGINS = [70, 50, 32, 20, 8, -20];

/**
 * The Race opens (Level 4): the rivals have been busy while you were in the garage. Each is set, in the order they already
 * stand, to a margin over your score today, so you start at #6 whatever you did to get here. No random draws.
 */
export function seedField(state: GameState) {
  const race = state.race;
  const mine = arenaScore(state.capability, state.hype);
  const order = rankBoard(state, race.rivals).filter((r) => r.id !== YOU).map((r) => r.id);
  race.rivals = race.rivals.map((r) => {
    const margin = FIELD_MARGINS[order.indexOf(r.context.id)] ?? 0;
    const capability = Math.max(5, Math.round((mine + margin - 1000 - 1.5 * r.context.hype) / 4));
    return { ...r, context: { ...r.context, capability } };
  });
  race.board = rankBoard(state, race.rivals);
  race.prevRanks = ranksOf(race.board);
  race.rank = rankOf(race.board);
  race.rankDelta = 0;
}

export interface BoardView {
  id: string;
  name: string;
  short: string;
  color: string;
  score: number;
  rank: number;
  /** Places moved since last week (positive = up). */
  delta: number;
  you: boolean;
  /** Their latest model, if they have one. */
  model: string;
  open: boolean;
}

export function boardView(state: GameState): BoardView[] {
  const race = state.race;
  return race.board.map((row, i) => {
    const rank = i + 1;
    const delta = (race.prevRanks[row.id] ?? rank) - rank;
    if (row.id === YOU) {
      return { id: YOU, name: state.labName, short: state.labName, color: "#ff8a4c", score: row.score, rank, delta, you: true, model: state.models[state.models.length - 1] ?? "", open: false };
    }
    const def = RIVAL_BY_ID[row.id as RivalId];
    const ctx = race.rivals.find((r) => r.context.id === row.id)!.context;
    return { id: row.id, name: def.name, short: def.short, color: def.color, score: row.score, rank, delta, you: false, model: ctx.model, open: ctx.open };
  });
}
