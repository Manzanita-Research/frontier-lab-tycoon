// mod:check's harness (FLT-37): the real sim, run with the resolved definition threaded through every call.
// Nothing is injected into the World: rivals, goals, events, headlines, names, the ladder and the coach are read
// through sim/defs.ts, and mod arcs are compiled and stepped in the tick like any other machine.
import { openEventOf } from "../sim/events";
import { outcomeOf } from "../sim/goals";
import { createInitialState } from "../sim/state";
import { tick, TICKS_PER_DAY } from "../sim/tick";
import { pacingCommands } from "../sim/pacing";
import type { Command } from "../sim/commands";
import type { GameState } from "../sim/types";
import { answer } from "../sim/testkit";
import { withDefs } from "../sim/defs";
import type { GameDefinition } from "./game-definition";
import { baseContent } from "./base-game";
import { ModError } from "./schema";
import { enableFactions } from "../sim/factions/state";

/** Sections the sim reads at runtime, and sections a mod may carry that nothing executes yet. */
export const EXECUTED_SECTIONS = ["progression", "coach", "buildings", "rivals", "headlines", "thoughts", "events", "arcs", "goals", "names", "disasters", "benchmarks", "mishaps", "factions"] as const;
export const INERT_SECTIONS = ["walkerKinds", "endings", "tips", "tables"] as const;

export interface Coverage {
  /** Changed sections the run executed. */
  readonly executed: string[];
  /** Changed sections that validate but that no system reads yet (see INERT_SECTIONS). */
  readonly inert: string[];
}
export function coverageOf(def: GameDefinition): Coverage {
  const changed = (section: string) => JSON.stringify(Reflect.get(def.content, section)) !== JSON.stringify(Reflect.get(baseContent, section));
  return { executed: EXECUTED_SECTIONS.filter(changed), inert: INERT_SECTIONS.filter(changed) };
}

export interface HeadlessReport {
  readonly seed: number;
  readonly days: number;
  readonly ticks: number;
  readonly attempts: number;
  readonly cardsAnswered: number;
  readonly cash: number;
  readonly models: number;
  readonly outcome: string;
  readonly coverage: Coverage;
  /** Where each mod arc stands at the end of the run (its state path), so an arc that never moved is easy to spot. */
  readonly arcStates: Record<string, string>;
  readonly state: GameState;
}
/** A fixed sustainable campus harness, not a balance bot. It exercises the existing economy/training/race.
 * It answers cards, and measures actual day advancement (cards can freeze the clock). */
export function runHeadless(def: GameDefinition, options: { days?: number; seed?: number } = {}): HeadlessReport {
  const days = options.days ?? 365;
  const seed = options.seed ?? 42;
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new ModError({ path: "days", detail: "expected 1–3650 whole days" });
  const state = createInitialState(seed, "garage", def);
  delete state.progression;
  delete state.coach;
  // Every system is on without the ladder, the factions (FLT-33) included.
  withDefs(def, () => enableFactions(state));
  // The quiet opening has no Hall or long paths: pay for the connected campus this harness exercises.
  const setup: Command[] = [...withDefs(def, () => pacingCommands(state)),
    { type: "placeBuilding", kind: "hall", x: 12, z: 11 },
    { type: "placeBuilding", kind: "gateway", x: 7, z: 17 },
    { type: "placeBuilding", kind: "kombucha", x: 12, z: 19 },
    { type: "hire", job: "sre" }];
  let attempts = 0;
  let cardsAnswered = 0;
  while (state.day < days && attempts < days * TICKS_PER_DAY * 3) {
    const commands = withDefs(def, () => answer(state, (id) => id === "computeAuction" ? 0 : id === "openWeights" ? 1 : 0));
    if (openEventOf(state)) cardsAnswered++;
    tick(state, attempts === 0 ? [...setup, ...commands] : commands, def);
    attempts++;
    if (withDefs(def, () => outcomeOf(state)) === "lost") throw new ModError({ path: "headless", detail: `simulation ended at day ${state.day}, cash ${state.cash}` });
    for (const key of ["cash", "capability", "hype", "compute"] as const) if (!Number.isFinite(state[key])) throw new ModError({ path: `headless.${key}`, detail: `non-finite number at day ${state.day}` });
  }
  if (state.day !== days) throw new ModError({ path: "headless", detail: `clock stalled at day ${state.day}; expected ${days}` });
  return { seed, days: state.day, ticks: state.tick, attempts, cardsAnswered, cash: state.cash, models: state.models.length, outcome: withDefs(def, () => outcomeOf(state)), coverage: coverageOf(def), arcStates: Object.fromEntries(Object.entries(state.modArcs ?? {}).map(([id, arc]) => [id, arc.value])), state };
}
