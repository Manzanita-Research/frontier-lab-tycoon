// Small helpers the sim tests share. Not game code.
import type { PlaceableKind } from "../content/buildings";
import { defs } from "./defs";
import { canPlace, type Command } from "./commands";
import { openEventOf } from "./events";
import { applyNow, TICKS_PER_DAY, tick } from "./tick";
import type { GameState } from "./types";
import { createInitialState } from "./state";
import { createRng } from "./rng";
import { seedWalkers } from "./walkers";
import { initialVibes } from "./vibes";
import { pendingConfirmOf } from "./guardrails";
import { FRESH_ECONOMY } from "./machines/economy";
import { MAX_ROUNDS } from "../content/bridgeRounds";

/** Explicit busy campus for existing crowd/render tests; the real opening stays quiet. */
export function createTestCampus(seed = 1): GameState {
  const s = createInitialState(seed);
  delete s.tutorial;
  delete s.coach;
  delete s.progression;
  delete s.flags.walkerPathCount;
  s.flags.firstGateway = 0; // fixture has already opened for visitors
  s.grid.paths.fill(false);
  const path = (x: number, z: number) => { s.grid.paths[z * s.grid.w + x] = true; };
  for (let z = 10; z <= 22; z++) path(11, z);
  path(12, 22);
  for (let x = 6; x <= 17; x++) path(x, 16);
  for (let x = 8; x <= 15; x++) path(x, 10);
  s.buildings = [];
  for (const [kind, x, z] of [["cluster", 8, 11], ["hall", 12, 11], ["kombucha", 12, 19]] as const) {
    const [w, d] = defs().buildings[kind].size;
    s.buildings.push({ id: s.nextId++, kind, x, z, w, d, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    s.flags[`built:${kind}`] = 0;
  }
  s.version++;
  s.training = { value: "training", context: { ...s.training.context, progress: 120, cost: 300 } }; // a full-size run, not the ladder's small first one
  s.walkers = [];
  const rng = createRng(s.rngState);
  seedWalkers(s, "researcher", 11, rng);
  seedWalkers(s, "agent", 11, rng);
  seedWalkers(s, "visitor", 18, rng);
  s.rngState = rng.state();
  s.vibes = initialVibes(s);
  return s;
}

/** Stage the prerequisites explicitly when a test is about pressure rather than onboarding. */
export function readyForPressure(s: GameState) {
  if (!s.models.length) s.models.push("Fixture-1-Preview");
  if (!s.buildings.some((b) => b.kind === "gateway")) {
    const [x, z] = findSpot(s, "gateway")!;
    applyNow(s, [{ type: "placeBuilding", kind: "gateway", x, z }]);
  }
  s.day = Math.max(40, s.day);
}

/** Wall-clock budgets are for Modal and laptops; a shared CI runner gets double. */
export const perfBudget = (ms: number): number => ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI ? ms * 2 : ms);

/** The command that answers whatever card is open with `pick` (default: the first choice), or none if nothing is open. */
export function answer(s: GameState, pick: number | ((id: string, choices: number) => number) = 0): Command[] {
  if (pendingConfirmOf(s)) return [{ type: "cancelConfirm" }];
  const open = openEventOf(s);
  if (!open) return [];
  const choices = defs().eventById(open.id)!.choices.length;
  const choiceIndex = typeof pick === "function" ? pick(open.id, choices) : pick;
  return [{ type: "chooseEvent", eventId: open.id, choiceIndex: Math.min(choiceIndex, choices - 1) }];
}

/** Run `days` game days, answering every card with the first choice unless `script` says something else for the tick. */
export function runDays(s: GameState, days: number, script: (s: GameState) => Command[] = () => []) {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    const asked = i % TICKS_PER_DAY === 0 ? script(s) : [];
    tick(s, asked.length > 0 ? asked : answer(s));
  }
}

/** First free spot for `kind` (paths beside it) scanning the middle of the grid, or null. */
export function findSpot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 3; z <= 21; z++) for (let x = 2; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

/** Lay a generous grid of paths so a scripted player never runs out of places to build (free, for tests). */
export function layPaths(s: GameState) {
  const put = (x: number, z: number) => {
    s.grid.paths[z * s.grid.w + x] = true;
  };
  for (const z of [4, 7, 13, 19]) for (let x = 3; x <= 20; x++) put(x, z);
  for (const x of [5, 17]) for (let z = 4; z <= 22; z++) put(x, z);
  for (let z = 4; z <= 22; z++) if (!s.buildings.some((b) => 11 >= b.x && 11 < b.x + b.w && z >= b.z && z < b.z + b.d)) put(11, z);
  s.version++;
}

/** A lab with every round spent and the bank's last day today: the next midnight is bankruptcy (FLT-86). */
export function brokeTonight(s: GameState) {
  s.cash = -100_000;
  s.economy = { value: "overdrawn", context: { ...FRESH_ECONOMY, rounds: MAX_ROUNDS, overdraftDay: s.day } };
}

export const price = (kind: PlaceableKind) => defs().buildings[kind].price;
export const countOf = (s: GameState, kind: string) => s.buildings.filter((b) => b.kind === kind).length;
