// Player actions. They are queued and applied at the start of the next tick.
import { BUILDINGS, BULLDOZE_REFUND, PATH_PRICE, type BuildingKind } from "../content/buildings";
import { publishPaper, setPublicationPolicy } from "./race/papers/driver";
import type { PublicationPolicy } from "./race/papers/policy";
import { setRisk, triggerDisaster } from "./disasters/driver";
import type { Risk } from "./disasters/types";
import { chooseEvent } from "./events";
import { addToast, pushNews } from "./news";
import { clearSlop } from "./slop";
import { canHire, clearZone, fire, hire, paintZone } from "./staff";
import { buildingAt, edgeTiles, inBounds, isPathTile, rectContains, rectsOverlap, tileIndex, gateAccessTiles } from "./pathfind";
import { guardSpending, clearConfirm, hallBuilt } from "./guardrails";
import type { Rng } from "./rng";
import type { GameState, Rect, StaffJob } from "./types";
import { continueTutorial } from "./tutorial";

export type Command =
  | { type: "setPublicationPolicy"; policy: PublicationPolicy }
  | { type: "publishPaper"; id: number; route: "preprint" | "review" }
  | { type: "placePath"; x: number; z: number; confirmed?: boolean }
  | { type: "placeBuilding"; kind: BuildingKind; x: number; z: number; confirmed?: boolean }
  | { type: "cancelConfirm" }
  | { type: "bulldoze"; x: number; z: number }
  | { type: "startTraining" }
  | { type: "continueTutorial" }
  | { type: "skipTutorial" }
  /** Put someone on the payroll (FLT-10): they walk in through the gate. */
  | { type: "hire"; job: StaffJob; confirmed?: boolean }
  | { type: "fire"; id: number }
  /** Paint (`on`) or erase one tile of a staffer's patrol zone; `clearZone` wipes it. */
  | { type: "paintZone"; id: number; x: number; z: number; on: boolean }
  | { type: "clearZone"; id: number }
  | { type: "chooseEvent"; eventId: string; choiceIndex: number }
  /** Trigger a disaster on purpose (the Disasters menu, after its confirmation; the `?disaster=` hook). A refusal is a toast. */
  | { type: "disaster"; id: string }
  /** The random-disaster setting: off, rare, normal or chaos. */
  | { type: "setRisk"; risk: Risk };

export type PlaceResult = { ok: true } | { ok: false; reason: string };

const no = (reason: string): PlaceResult => ({ ok: false, reason });

/** What `kind` costs right now: a compute auction win leaves a free voucher for one of them. */
export function buildPrice(state: GameState, kind: BuildingKind): number {
  return state.flags[`free:${kind}`] !== undefined ? 0 : BUILDINGS[kind].price;
}

/** Locked buildings (the race's Datacenter and power plants) stay locked until a compute auction is won. */
export const isUnlocked = (state: GameState, kind: BuildingKind): boolean => !BUILDINGS[kind].locked || state.flags[`unlocked:${kind}`] !== undefined;

/** Can `kind` (or a path tile) go at (x, z)? For buildings, (x, z) is the top-left tile of the footprint. */
export function canPlace(state: GameState, kind: BuildingKind | "path", x: number, z: number): PlaceResult {
  if (kind === "path") {
    if (!inBounds(state, x, z)) return no("Out of bounds");
    if (isPathTile(state, x, z)) return no("Already a path");
    if (buildingAt(state, x, z) || rectContains(state.gate, x, z)) return no("Something's already there");
    if (state.cash < PATH_PRICE) return no("Not enough cash");
    return { ok: true };
  }
  const def = BUILDINGS[kind];
  if (!isUnlocked(state, kind)) return no("Win a compute auction to unlock this");
  const rect: Rect = { x, z, w: def.size[0], d: def.size[1] };
  if (gateAccessTiles(state).some(([gx, gz]) => rectContains(rect, gx, gz))) return no("Keep the entrance access clear; it belongs to the queue to somewhere.");
  if (!inBounds(state, x, z) || !inBounds(state, x + rect.w - 1, z + rect.d - 1)) return no("Out of bounds");
  if (rectsOverlap(rect, state.gate) || state.buildings.some((b) => rectsOverlap(rect, b))) {
    return no("Something's already there");
  }
  for (let i = x; i < x + rect.w; i++) {
    for (let j = z; j < z + rect.d; j++) if (isPathTile(state, i, j)) return no("Something's already there");
  }
  if (!edgeTiles(state, rect).some((e) => isPathTile(state, e.x, e.z))) return no("Needs a path next to it");
  if (state.cash < buildPrice(state, kind)) return no("Not enough cash");
  return { ok: true };
}

export function placeBuilding(state: GameState, rng: Rng, kind: BuildingKind, x: number, z: number, confirmed = false) {
  if (!canPlace(state, kind, x, z).ok) return;
  if (!guardSpending(state, { type: "placeBuilding", kind, x, z, confirmed })) return;
  const def = BUILDINGS[kind];
  state.cash -= buildPrice(state, kind);
  delete state.flags[`free:${kind}`];
  state.buildings.push({ id: state.nextId++, kind, x, z, w: def.size[0], d: def.size[1], placedTick: state.tick, reliability: 1, broken: false, brokenTick: 0 });
  state.version++;
  state.flags.firstBuild ??= state.day;
  const first = state.flags[`built:${kind}`] === undefined;
  state.flags[`built:${kind}`] = state.day;
  if (kind === "hall") hallBuilt(state);
  if (first) {
    state.hype = Math.min(100, state.hype + 1);
    pushNews(state, rng, `built:${kind}`);
  }
}

function bulldoze(state: GameState, x: number, z: number) {
  const b = buildingAt(state, x, z);
  if (b) {
    state.cash += Math.round(BUILDINGS[b.kind].price * BULLDOZE_REFUND);
    state.buildings = state.buildings.filter((o) => o.id !== b.id);
    state.version++;
    return;
  }
  if (isPathTile(state, x, z)) {
    state.grid.paths[tileIndex(state, x, z)] = false;
    clearSlop(state, tileIndex(state, x, z));
    state.cash += Math.round(PATH_PRICE * BULLDOZE_REFUND);
    state.version++;
  }
}

export function applyCommands(state: GameState, commands: readonly Command[], rng: Rng) {
  for (const c of commands) {
    switch (c.type) {
      case "placePath":
        if (canPlace(state, "path", c.x, c.z).ok && guardSpending(state, c)) {
          state.cash -= PATH_PRICE;
          state.grid.paths[tileIndex(state, c.x, c.z)] = true;
          state.version++;
          state.flags.firstBuild ??= state.day;
          state.flags.firstPath ??= state.day;
        }
        break;
      case "placeBuilding":
        placeBuilding(state, rng, c.kind, c.x, c.z, c.confirmed);
        break;
      case "bulldoze":
        bulldoze(state, c.x, c.z);
        break;
      case "chooseEvent":
        chooseEvent(state, rng, c.eventId, c.choiceIndex);
        break;
      case "hire":
        if (canHire(state, c.job).ok && guardSpending(state, c)) {
          hire(state, c.job);
          if (c.job === "janitor" || c.job === "sre") state.flags.firstSupportHire ??= state.day;
        }
        break;
      case "cancelConfirm":
        clearConfirm(state);
        break;
      case "continueTutorial":
        continueTutorial(state);
        break;
      case "skipTutorial":
        continueTutorial(state, true);
        break;
      case "fire":
        fire(state, c.id);
        break;
      case "paintZone":
        paintZone(state, c.id, c.x, c.z, c.on);
        break;
      case "clearZone":
        clearZone(state, c.id);
        break;
      case "setPublicationPolicy":
        setPublicationPolicy(state, c.policy, rng);
        break;
      case "publishPaper":
        publishPaper(state, c.id, c.route, rng);
        break;
      case "disaster": {
        const r = triggerDisaster(state, c.id, { forced: true });
        if (!r.ok) addToast(state, r.reason, "bad");
        break;
      }
      case "setRisk":
        setRisk(state, c.risk);
        break;
      case "startTraining":
        if (!state.buildings.some((b) => b.kind === "hall")) addToast(state, "Build a Training Hall first.", "bad");
        break;
    }
  }
}
