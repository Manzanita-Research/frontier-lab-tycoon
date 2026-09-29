// The race's slice of the World. Plain JSON, like everything in GameState.
import { RIVAL_DEFS } from "../../content/rivals";
import { arenaScore, YOU } from "../../content/rivals";
import { initialStored } from "../machines/run";
import type { GameState } from "../types";
import { eraMachine, type EraStored } from "./era";
import { rivalMachine, type RivalStored } from "./rival";

export interface BoardRow {
  id: string;
  score: number;
}

export interface OpenDrop {
  /** Game day the -30% revenue ends. */
  until: number;
  /** The open-weights lab that dropped it, and the model. */
  rival: string;
  model: string;
}

export interface RaceState {
  /** The era ratchet. */
  era: EraStored;
  /** The R&D multiplier as of the last daily check. */
  mult: number;
  /** One machine per rival, in RIVAL_DEFS order. */
  rivals: RivalStored[];
  /** The Frontier Arena as of the last weekly update, best first. */
  board: BoardRow[];
  /** Everyone's rank a week earlier. */
  prevRanks: Record<string, number>;
  /** Your rank, and how many places you moved this week (positive = up). */
  rank: number;
  rankDelta: number;
  /** Weekly cycles run so far. */
  week: number;
  /** An open-weights rival is eating your revenue (-30%) until this day passes. */
  openDrop: OpenDrop | null;
  /** Day of the last open-weights drop, for spacing them out. */
  lastDrop: number;
  /** Each "cut prices" is -15% revenue for good. */
  priceCuts: number;
  /** The day the next compute auction is called. */
  nextAuction: number;
  /** Day of the last funding round offer. */
  lastFunding: number;
  /** Researchers poached so far. */
  poached: number;
}

export const AUCTION_FIRST_DAY = 40;

/** Your row is last among equals: ties go to the lab with the better press. */
export function rankBoard(state: Pick<GameState, "capability" | "hype">, rivals: RivalStored[]): BoardRow[] {
  const rows: BoardRow[] = rivals.map((r) => ({ id: r.context.id, score: arenaScore(r.context.capability, r.context.hype) }));
  rows.push({ id: YOU, score: arenaScore(state.capability, state.hype) });
  return rows.sort((a, b) => b.score - a.score);
}

export const ranksOf = (board: BoardRow[]): Record<string, number> => Object.fromEntries(board.map((r, i) => [r.id, i + 1]));

export function createRace(state: Pick<GameState, "capability" | "hype">): RaceState {
  const rivals = RIVAL_DEFS.map((d) =>
    initialStored(rivalMachine, {
      id: d.id,
      personality: d.personality,
      capability: d.startCapability,
      hype: d.startHype,
      baseHype: d.startHype,
      weeks: 0,
      releases: 0,
      open: false,
      momentum: 1,
      model: "",
      lastRelease: -1,
    }),
  );
  const board = rankBoard(state, rivals);
  const ranks = ranksOf(board);
  return {
    era: initialStored(eraMachine, { peak: 1 }),
    mult: 1,
    rivals,
    board,
    prevRanks: ranks,
    rank: ranks[YOU]!,
    rankDelta: 0,
    week: 0,
    openDrop: null,
    lastDrop: -999,
    priceCuts: 0,
    nextAuction: AUCTION_FIRST_DAY,
    lastFunding: -999,
    poached: 0,
  };
}
