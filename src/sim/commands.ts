// Player actions. They are queued and applied at the start of the next tick.
import { BULLDOZE_REFUND, PATH_PRICE, type BuildingKind } from "../content/buildings";
import { publishPaper, setPublicationPolicy } from "./race/papers/driver";
import type { PublicationPolicy } from "./race/papers/policy";
import { setRisk, triggerDisaster } from "./disasters/driver";
import type { Risk } from "./disasters/types";
import { chooseEvent, pacerOf } from "./events";
import { paceFor, pacerMachine } from "./machines/cardPace";
import { step } from "./machines/run";
import { TICKS_PER_DAY, TICKS_PER_SECOND } from "./constants";
import { addToast, pushNews } from "./news";
import { clearSlop } from "./slop";
import { canHire, clearZone, fire, hire, paintZone } from "./staff";
import { buildingAt, edgeTiles, inBounds, isPathTile, rectContains, rectsOverlap, tileIndex, gateAccessTiles } from "./pathfind";
import { guardSpending, clearConfirm, hallBuilt } from "./guardrails";
import type { Rng } from "./rng";
import type { GameState, Rect, StaffJob } from "./types";
import { buildingUnlocked, systemUnlocked } from "./progression";
import { coachCommand } from "./coach";
import { lobbySenator } from "./promises/driver";
import { draftClause } from "./capture/driver";
import { continueTutorial } from "./tutorial";
import { defs } from "./defs";
import { setSafetySpend } from "./factions/driver";

export type Command =
  | { type: "coachSkip" | "coachReplay" | "coachClick" | "dismissUnlock" | "buildPanelOpened" }
  /** The coach saw you do what it asked while a model trains (FLT-58): press ▶▶, or open somebody's card to read their mind. */
  | { type: "coachSaw"; what: "speed" } | { type: "coachSaw"; what: "mind"; id: number }
  | { type: "placePath"; x: number; z: number; confirmed?: boolean }
  | { type: "placeBuilding"; kind: BuildingKind; x: number; z: number; confirmed?: boolean }
  | { type: "cancelConfirm" }
  | { type: "setPublicationPolicy"; policy: PublicationPolicy }
  | { type: "publishPaper"; id: number; route: "preprint" | "review" }
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
  | { type: "setRisk"; risk: Risk }
  /** Send the lab's lobbyists to a senator about the motion on the docket (FLT-23). A refusal is a toast. */
  | { type: "lobby"; senator: string }
  /** Tick (`on`) or untick a clause on the bill the lab was asked to draft (FLT-22). */
  | { type: "draftClause"; clause: string; on: boolean }
  /** FLT-33: the safety budget, 0 (none) to 3 (lavish). Costs money daily and slows training; the factions notice. */
  | { type: "setSafetySpend"; level: number }
  /** FLT-54: the game speed changed (0 never comes: pausing keeps the pace). The card budget stretches with it. */
  | { type: "setPace"; speed: number };

export type PlaceResult = { ok: true } | { ok: false; reason: string };

const no = (reason: string): PlaceResult => ({ ok: false, reason });

/** What `kind` costs right now: a compute auction win leaves a free voucher for one of them. */
export function buildPrice(state: GameState, kind: BuildingKind): number {
  return state.flags[`free:${kind}`] !== undefined ? 0 : defs().buildings[kind].price;
}

/** Locked buildings (the race's Datacenter and power plants) stay locked until a compute auction is won. */
export const isUnlocked = (state: GameState, kind: BuildingKind): boolean => buildingUnlocked(state, kind) && (!defs().buildings[kind].locked || state.flags[`unlocked:${kind}`] !== undefined);

/** Can `kind` (or a path tile) go at (x, z)? For buildings, (x, z) is the top-left tile of the footprint. */
export function canPlace(state: GameState, kind: BuildingKind | "path", x: number, z: number): PlaceResult {
  if (kind === "path") {
    if (!inBounds(state, x, z)) return no("Out of bounds");
    if (isPathTile(state, x, z)) return no("Already a path");
    if (buildingAt(state, x, z) || rectContains(state.gate, x, z)) return no("Something's already there");
    if (state.cash < PATH_PRICE) return no("Not enough cash");
    return { ok: true };
  }
  const buildings = defs().buildings;
  // A kind this run's definition does not have (a stale link, a mod that is no longer loaded).
  if (!Object.hasOwn(buildings, kind)) return no("There's no such building here");
  const def = buildings[kind];
  const rect: Rect = { x, z, w: def.size[0], d: def.size[1] };
  if (gateAccessTiles(state).some(([gx, gz]) => rectContains(rect, gx, gz))) return no("Keep the entrance access clear; it belongs to the queue to somewhere.");
  if (!isUnlocked(state, kind)) return no(defs().buildings[kind].locked ? "Win a compute auction to unlock this" : "Meet your next goal to unlock this");
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
  const def = defs().buildings[kind];
  state.cash -= buildPrice(state, kind);
  delete state.flags[`free:${kind}`];
  state.buildings.push({ id: state.nextId++, kind, x, z, w: def.size[0], d: def.size[1], placedTick: state.tick, reliability: 1, broken: false, brokenTick: 0 });
  state.version++;
  state.flags.firstBuild ??= state.day;
  const first = state.flags[`built:${kind}`] === undefined;
  state.flags[`built:${kind}`] = state.day;
  if (kind === "hall") hallBuilt(state);
  if (kind === "gateway") state.flags.firstGateway ??= state.day;
  if (first) {
    state.hype = Math.min(100, state.hype + 1);
    pushNews(state, rng, `built:${kind}`);
  }
}

function bulldoze(state: GameState, x: number, z: number) {
  const b = buildingAt(state, x, z);
  if (b) {
    state.cash += Math.round(defs().buildings[b.kind].price * BULLDOZE_REFUND);
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
      case "coachSkip": case "coachReplay": case "coachClick":
        coachCommand(state, c.type); break;
      case "dismissUnlock": state.unlockCards?.shift(); break;
      case "buildPanelOpened": state.flags.started ??= state.tick; state.flags.coachBuildOpened = state.tick; break;
      case "coachSaw":
        if (c.what === "speed") state.flags.coachSpedUp ??= state.tick;
        else if (state.walkers.some((w) => w.id === c.id) || state.staff.some((w) => w.id === c.id)) state.flags.coachMindRead ??= state.tick;
        break;
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
        if (systemUnlocked(state, "papers")) setPublicationPolicy(state, c.policy, rng);
        break;
      case "publishPaper":
        if (systemUnlocked(state, "papers")) publishPaper(state, c.id, c.route, rng);
        break;
      case "disaster": {
        if (!systemUnlocked(state, "disasters")) break;
        const r = triggerDisaster(state, c.id, { forced: true });
        if (!r.ok) addToast(state, r.reason, "bad", { source: "disaster", importance: "you" });
        break;
      }
      case "setRisk":
        if (systemUnlocked(state, "disasters")) setRisk(state, c.risk);
        break;
      case "lobby":
        if (systemUnlocked(state, "promises")) lobbySenator(state, c.senator);
        break;
      case "draftClause":
        if (systemUnlocked(state, "capture")) draftClause(state, c.clause, c.on);
        break;
      case "setPace":
        state.pacer = step(pacerMachine, pacerOf(state), { type: "PACE", ...paceFor(c.speed, TICKS_PER_SECOND, TICKS_PER_DAY) }).stored;
        break;
      case "setSafetySpend":
        if (state.factions && systemUnlocked(state, "factions")) setSafetySpend(state, c.level);
        break;
      case "startTraining":
        if (!state.buildings.some((b) => b.kind === "hall")) addToast(state, "Build a Training Hall first.", "bad", { source: "build", importance: "you" });
        break;
    }
  }
}
