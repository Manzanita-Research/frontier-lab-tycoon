// The Frontier Arena: a score from capability and hype, re-ranked once a week.
import { RIVAL_BY_ID, YOU, type RivalId } from "../../content/rivals";
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
  race.rankDelta = race.prevRanks[YOU]! - rank;
  race.rank = rank;
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
