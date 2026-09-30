// The Takeover's autopilot (FLT-11): the lab's newest model builds for you. A plain deterministic function, no dice: every
// `everyTicks` it picks the next kind in the pack's rotation, aims at the best free spot (the one nearest the middle of
// the campus that touches a path), and places it `aimTicks` later, so the UI has time to glide the ghost cursor there.
// When there is nowhere left, it lays a path instead. It pays for everything. Nobody asks where from.
import { BUILDINGS, type BuildingKind } from "../../content/buildings";
import { canPlace, placeBuilding, type Command } from "../commands";
import { fillTemplate } from "../format";
import { addToast } from "../news";
import { buildingAt, inBounds, isPathTile, rectContains, tileIndex } from "../pathfind";
import { findSpot } from "../race/actions";
import type { Rng } from "../rng";
import type { GameState } from "../types";
import { ENDING_RULES } from "./pack";
import type { EndingsState } from "./state";

/** What `canPlace` would say with a bottomless bank account: the autopilot never runs out of money. */
function withMoney<T>(state: GameState, f: () => T): T {
  const cash = state.cash;
  state.cash = Math.max(cash, 1e15);
  try {
    return f();
  } finally {
    state.cash = cash;
  }
}

/** A free tile next to a path, nearest the campus middle; one that carries a straight path on wins. */
function pathSpot(state: GameState): [number, number] | null {
  const { w, h } = state.grid;
  let best: [number, number] | null = null;
  let bestScore = Infinity;
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      if (isPathTile(state, x, z) || buildingAt(state, x, z) || rectContains(state.gate, x, z)) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!inBounds(state, x - dx, z - dz) || !isPathTile(state, x - dx, z - dz)) continue;
        const straight = inBounds(state, x - 2 * dx, z - 2 * dz) && isPathTile(state, x - 2 * dx, z - 2 * dz);
        const score = Math.hypot(x + 0.5 - w / 2, z + 0.5 - h / 2) + (straight ? 0 : 6);
        if (score < bestScore) {
          bestScore = score;
          best = [x, z];
        }
      }
    }
  }
  return best;
}

/** Where it will build next, trying the rotation from `from` on. */
function nextTarget(state: GameState, from: number): { kind: BuildingKind | "path"; x: number; z: number } | null {
  const kinds = ENDING_RULES.autopilot.kinds as readonly BuildingKind[];
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[(from + i) % kinds.length]!;
    if (!(kind in BUILDINGS)) continue;
    const spot = withMoney(state, () => findSpot(state, kind));
    if (spot) return { kind, x: spot[0], z: spot[1] };
  }
  const p = withMoney(state, () => pathSpot(state));
  return p ? { kind: "path", x: p[0], z: p[1] } : null;
}

function place(state: GameState, rng: Rng, kind: BuildingKind | "path", x: number, z: number): boolean {
  if (kind === "path") {
    if (!withMoney(state, () => canPlace(state, "path", x, z).ok)) return false;
    state.grid.paths[tileIndex(state, x, z)] = true;
    state.version++;
    return true;
  }
  const price = BUILDINGS[kind].price;
  const before = state.buildings.length;
  state.cash += price;
  placeBuilding(state, rng, kind, x, z, true);
  if (state.buildings.length === before) {
    state.cash -= price;
    return false;
  }
  return true;
}

/** One tick of the autopilot: land the build it was aiming at, or pick the next one. */
export function updateAutopilot(state: GameState, e: EndingsState, rng: Rng) {
  const a = e.autopilot;
  if (!a.on) return;
  const rules = ENDING_RULES.autopilot;
  if (a.target && state.tick >= a.target.placeTick) {
    const t = a.target;
    a.target = null;
    if (place(state, rng, t.kind as BuildingKind | "path", t.x, t.z)) {
      a.placed++;
      if (e.run) e.run.vars.placed = String(a.placed);
      if (a.placed === 1) addToast(state, fillTemplate(rules.paid, e.run?.vars ?? {}), "joke");
    }
    a.nextTick = state.tick + Math.max(1, rules.everyTicks - rules.aimTicks);
  }
  if (!a.target && state.tick >= a.nextTick) {
    const t = nextTarget(state, a.placed);
    if (!t) {
      a.nextTick = state.tick + rules.everyTicks;
      return;
    }
    a.target = { kind: t.kind as BuildingKind, x: t.x, z: t.z, aimedTick: state.tick, placeTick: state.tick + rules.aimTicks };
  }
}

const HANDS_OFF = new Set<Command["type"]>(["placePath", "placeBuilding", "bulldoze"]);

/** While the autopilot drives, the player's building commands are politely declined. */
export function declineBuilding(state: GameState, commands: readonly Command[]): readonly Command[] {
  const e = state.endings;
  if (!e?.autopilot.on || !commands.some((c) => HANDS_OFF.has(c.type))) return commands;
  addToast(state, fillTemplate(ENDING_RULES.autopilot.refusal, e.run?.vars ?? {}), "neutral");
  return commands.filter((c) => !HANDS_OFF.has(c.type));
}
