// Endings (FLT-11): what the World keeps. Absent until `enableEndings(state)` (the app does it; tests that want the
// old win/lose-only game leave it off), so the goldens and every older save are untouched.
import type { DisasterRun } from "../disasters/types";
import type { BuildingKind } from "../../content/buildings";
import type { GameState } from "../types";
import { initialStored } from "../machines/run";
import { arcMachine } from "../machines/arc";
import { ENDINGS_PACK } from "./pack";
import type { MemoState } from "./memo";

/** Presentation cues an ending's chart sets with `look.set` (the renderer and the HUD read them; the sim never does). */
export type Look = Record<string, string | number | boolean>;

/** The Takeover's hands on the controls: where the cursor is heading, and what it will put there. */
export interface Autopilot {
  on: boolean;
  /** The next build: the cursor glides to it from `aimedTick`, and it lands at `placeTick`. */
  target: { kind: BuildingKind; x: number; z: number; aimedTick: number; placeTick: number } | null;
  /** The tick it next looks for somewhere to build. */
  nextTick: number;
  /** Buildings it has placed. */
  placed: number;
}

export interface EndingsState {
  /** The ending under way (a DisasterRun-shaped record, so every Vocabulary verb works on it), or null. */
  run: DisasterRun | null;
  /** The ending's id, and the day its front page came out (null while the sequence is still playing). */
  id: string | null;
  endedDay: number | null;
  look: Look;
  autopilot: Autopilot;
  /** The run summary's numbers, kept up to date once a day. */
  peakVibes: number;
  peakProtesters: number;
  agentsEscaped: number;
  /** The day the last Rogue Agent Swarm we counted began (every agent on campus that day went with it). */
  swarmDay: number | null;
  /** The day each era was first reached (index 0 is Era 1). */
  eraDays: number[];
  /** Today's lab: the date key (`2026-09-30`) when this is the daily seed, so the summary can say so. */
  daily: string | null;
  /** FLT-57: the Memo, once a box is ticked (absent before, and in saves from before FLT-57). */
  memo?: MemoState;
}

export function createEndings(): EndingsState {
  return {
    run: null,
    id: null,
    endedDay: null,
    look: {},
    autopilot: { on: false, target: null, nextTick: 0, placed: 0 },
    peakVibes: 0,
    peakProtesters: 0,
    agentsEscaped: 0,
    swarmDay: null,
    eraDays: [0],
    daily: null,
  };
}

/** Switch the endings on (the app does, unless `?endings=off`). Idempotent. `daily` marks Today's lab. */
export function enableEndings(state: GameState, daily: string | null = null) {
  state.endings ??= createEndings();
  if (daily) state.endings.daily = daily;
  // Saves from before the Memo existed have no arc for it.
  for (const def of ENDINGS_PACK.content.events.add) state.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 60, openedDay: null });
}
