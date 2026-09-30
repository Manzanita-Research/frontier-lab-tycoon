// Temporary M1a bridge: use the existing sim API and only its already-injectable World fields.
// Never mutate imported content, add a second tick engine, or hide which sections await M1b.
import { BUILDINGS } from "../content/buildings";
import { EVENTS } from "../content/events";
import { GOALS } from "../content/goals";
import { RIVAL_DEFS } from "../content/rivals";
import { openEventOf } from "../sim/events";
import { outcomeOf } from "../sim/goals";
import { rankBoard, ranksOf } from "../sim/race/state";
import { createInitialState } from "../sim/state";
import { tick, TICKS_PER_DAY } from "../sim/tick";
import type { Command } from "../sim/commands";
import type { GameState } from "../sim/types";
import { answer } from "../sim/testkit";
import type { GameDefinition } from "./game-definition";
import { baseContent } from "./base-game";
import { ModError } from "./schema";

export interface InjectionReport { readonly applied: string[]; readonly deferred: string[] }
export function injectDefinition(state: GameState, def: GameDefinition): InjectionReport {
  const applied: string[] = [];
  const deferred: string[] = [];
  const byId = new Map(def.content.rivals.map((rival) => [rival.id, rival]));
  for (const stored of state.race.rivals) {
    const rival = byId.get(stored.context.id);
    const base = RIVAL_DEFS.find((rival) => rival.id === stored.context.id);
    if (!rival || !base) { deferred.push(`rivals.${stored.context.id}: removal`); continue; }
    if (JSON.stringify(rival.personality) !== JSON.stringify(base.personality) || rival.startCapability !== base.startCapability || rival.startHype !== base.startHype) {
      stored.context = { ...stored.context, personality: { ...rival.personality }, capability: rival.startCapability, hype: rival.startHype, baseHype: rival.startHype };
      applied.push(`rivals.${rival.id}: personality, startCapability, startHype`);
    }
    if (JSON.stringify({ ...rival, personality: base.personality, startCapability: base.startCapability, startHype: base.startHype }) !== JSON.stringify(base)) deferred.push(`rivals.${rival.id}: copy and model pools`);
  }
  for (const rival of def.content.rivals) if (!RIVAL_DEFS.some((base) => base.id === rival.id)) deferred.push(`rivals.${rival.id}: addition`);
  state.race.board = rankBoard(state, state.race.rivals);
  state.race.prevRanks = ranksOf(state.race.board);
  state.race.rank = state.race.prevRanks.you ?? state.race.rank;
  state.goals.context = { ...state.goals.context, goals: state.goals.context.goals.map((goal) => {
    const override = def.content.goals.find((g) => g.id === goal.id);
    const base = GOALS.find((g) => g.id === goal.id);
    if (override && base && override.metric === base.metric && override.target !== base.target) {
      applied.push(`goals.${goal.id}: target`);
      return { ...goal, target: override.target };
    }
    return goal;
  }) };
  for (const [section, value] of Object.entries(def.content)) {
    if (section === "rivals") continue;
    const base = Reflect.get(baseContent, section);
    if (JSON.stringify(value) !== JSON.stringify(base)) deferred.push(`${section}: full runtime lookup awaits M1b`);
  }
  return { applied, deferred };
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
  readonly injection: InjectionReport;
  readonly state: GameState;
}
/** A fixed sustainable campus harness, not a balance bot. It exercises the existing economy/training/race.
 * It answers cards, and measures actual day advancement (cards can freeze the clock). */
export function runHeadless(def: GameDefinition, options: { days?: number; seed?: number } = {}): HeadlessReport {
  const days = options.days ?? 365;
  const seed = options.seed ?? 42;
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new ModError({ path: "days", detail: "expected 1–3650 whole days" });
  const state = createInitialState(seed);
  const injection = injectDefinition(state, def);
  // Existing public commands can place a revenue building. This avoids an idle, gateway-free campus going broke.
  const setup: Command[] = [{ type: "placeBuilding", kind: "gateway", x: 8, z: 17 }, { type: "hire", job: "sre" }];
  let attempts = 0;
  let cardsAnswered = 0;
  while (state.day < days && attempts < days * TICKS_PER_DAY * 3) {
    const commands = answer(state, (id) => id === "computeAuction" ? 0 : id === "openWeights" ? 1 : 0);
    if (openEventOf(state)) cardsAnswered++;
    tick(state, attempts === 0 ? [...setup, ...commands] : commands);
    attempts++;
    if (outcomeOf(state) === "lost") throw new ModError({ path: "headless", detail: `simulation ended at day ${state.day}, cash ${state.cash}` });
    for (const key of ["cash", "capability", "hype", "compute"] as const) if (!Number.isFinite(state[key])) throw new ModError({ path: `headless.${key}`, detail: `non-finite number at day ${state.day}` });
  }
  if (state.day !== days) throw new ModError({ path: "headless", detail: `clock stalled at day ${state.day}; expected ${days}` });
  return { seed, days: state.day, ticks: state.tick, attempts, cardsAnswered, cash: state.cash, models: state.models.length, outcome: outcomeOf(state), injection, state };
}

/** Exact list of engine seams for the PR and the CLI's coverage report. */
export const M1B_SEAMS = {
  entries: ["createInitialState(seed, def)", "tick(state, commands, def)", "applyNow(state, commands, def)"],
  hardCoded: { buildings: Object.keys(BUILDINGS), events: EVENTS.map((event) => event.id) },
};
