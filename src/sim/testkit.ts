// Small helpers the sim tests share. Not game code.
import { BUILDINGS, type PlaceableKind } from "../content/buildings";
import { eventById } from "../content/events";
import { canPlace, type Command } from "./commands";
import { openEventOf } from "./events";
import { TICKS_PER_DAY, tick } from "./tick";
import type { GameState } from "./types";

/** Wall-clock budgets are for Modal and laptops; a shared CI runner gets double. */
export const perfBudget = (ms: number): number => ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI ? ms * 2 : ms);

/** The command that answers whatever card is open with `pick` (default: the first choice), or none if nothing is open. */
export function answer(s: GameState, pick: number | ((id: string, choices: number) => number) = 0): Command[] {
  const open = openEventOf(s);
  if (!open) return [];
  const choices = eventById(open.id)!.choices.length;
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
  s.version++;
}

export const price = (kind: PlaceableKind) => BUILDINGS[kind].price;
export const countOf = (s: GameState, kind: string) => s.buildings.filter((b) => b.kind === kind).length;
