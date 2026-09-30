// What the HUD reads about the race: a small plain snapshot, rebuilt with each publish (about 5 Hz).
import { eraDef, ERAS } from "../../content/eras";
import { RACE_KINDS, type BuildingKind } from "../../content/buildings";
import { ARENA_SIZE } from "../../content/rivals";
import type { GameState } from "../types";
import { boardView, type BoardView } from "./arena";
import { openDropActive, raceVars } from "./finance";
import { powerOf } from "./power";
import { eraOfState } from "./race";

export interface RaceView {
  era: number;
  eraName: string;
  /** The R&D multiplier as of the last day. */
  mult: number;
  /** Where the next era starts, or null in the last one. */
  nextAt: number | null;
  /** How far through the current era's band the multiplier is (0 to 1). */
  eraPct: number;
  rank: number;
  /** Places moved this week (positive = up). */
  rankDelta: number;
  total: number;
  week: number;
  board: BoardView[];
  /** An open-weights drop is eating revenue. */
  drop: { rival: string; model: string; daysLeft: number } | null;
  /** Buildings a compute auction has unlocked, and the ones with a free voucher. */
  unlocked: BuildingKind[];
  free: BuildingKind[];
  power: { datacenters: number; powered: number; gas: number; solar: number };
  /** Template variables for the open card's text. */
  vars: Record<string, string>;
}

export function raceView(s: GameState): RaceView {
  const era = eraOfState(s);
  const def = eraDef(era);
  const next = ERAS[era] ?? null;
  const mult = s.race.mult;
  const eraPct = next ? Math.max(0, Math.min(1, (mult - def.from) / (next.from - def.from))) : 1;
  const drop = s.race.openDrop;
  const power = powerOf(s);
  return {
    era,
    eraName: def.name,
    mult,
    nextAt: next ? Math.round(next.from) : null,
    eraPct,
    rank: s.race.rank,
    rankDelta: s.race.rankDelta,
    total: Math.max(ARENA_SIZE, s.race.board.length),
    week: s.race.week,
    board: boardView(s),
    drop: drop && openDropActive(s) ? { rival: drop.rival, model: drop.model, daysLeft: Math.max(0, drop.until - s.day) } : null,
    unlocked: RACE_KINDS.filter((k) => s.flags[`unlocked:${k}`] !== undefined),
    free: RACE_KINDS.filter((k) => s.flags[`free:${k}`] !== undefined),
    power: { datacenters: power.datacenters, powered: power.powered, gas: power.gas, solar: power.solar },
    vars: raceVars(s),
  };
}
