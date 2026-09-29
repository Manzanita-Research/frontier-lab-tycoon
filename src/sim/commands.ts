// Player actions. They are queued and applied at the start of the next tick.
import { BUILDINGS, BULLDOZE_REFUND, PATH_PRICE, type BuildingKind } from "../content/buildings";
import { chooseEvent } from "./events";
import { addToast, pushNews } from "./news";
import { buildingAt, edgeTiles, inBounds, isPathTile, rectContains, rectsOverlap, tileIndex } from "./pathfind";
import type { Rng } from "./rng";
import type { GameState, Rect } from "./types";

export type Command =
  | { type: "placePath"; x: number; z: number }
  | { type: "placeBuilding"; kind: BuildingKind; x: number; z: number }
  | { type: "bulldoze"; x: number; z: number }
  | { type: "startTraining" }
  | { type: "chooseEvent"; eventId: string; choiceIndex: number };

export type PlaceResult = { ok: true } | { ok: false; reason: string };

const no = (reason: string): PlaceResult => ({ ok: false, reason });

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
  const rect: Rect = { x, z, w: def.size[0], d: def.size[1] };
  if (!inBounds(state, x, z) || !inBounds(state, x + rect.w - 1, z + rect.d - 1)) return no("Out of bounds");
  if (rectsOverlap(rect, state.gate) || state.buildings.some((b) => rectsOverlap(rect, b))) {
    return no("Something's already there");
  }
  for (let i = x; i < x + rect.w; i++) {
    for (let j = z; j < z + rect.d; j++) if (isPathTile(state, i, j)) return no("Something's already there");
  }
  if (!edgeTiles(state, rect).some((e) => isPathTile(state, e.x, e.z))) return no("Needs a path next to it");
  if (state.cash < def.price) return no("Not enough cash");
  return { ok: true };
}

function placeBuilding(state: GameState, rng: Rng, kind: BuildingKind, x: number, z: number) {
  if (!canPlace(state, kind, x, z).ok) return;
  const def = BUILDINGS[kind];
  state.cash -= def.price;
  state.buildings.push({ id: state.nextId++, kind, x, z, w: def.size[0], d: def.size[1], placedTick: state.tick });
  state.version++;
  const first = state.flags[`built:${kind}`] === undefined;
  state.flags[`built:${kind}`] = state.day;
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
    state.cash += Math.round(PATH_PRICE * BULLDOZE_REFUND);
    state.version++;
  }
}

export function applyCommands(state: GameState, commands: readonly Command[], rng: Rng) {
  for (const c of commands) {
    switch (c.type) {
      case "placePath":
        if (canPlace(state, "path", c.x, c.z).ok) {
          state.cash -= PATH_PRICE;
          state.grid.paths[tileIndex(state, c.x, c.z)] = true;
          state.version++;
        }
        break;
      case "placeBuilding":
        placeBuilding(state, rng, c.kind, c.x, c.z);
        break;
      case "bulldoze":
        bulldoze(state, c.x, c.z);
        break;
      case "chooseEvent":
        chooseEvent(state, rng, c.eventId, c.choiceIndex);
        break;
      case "startTraining":
        if (!state.buildings.some((b) => b.kind === "hall")) addToast(state, "Build a Training Hall first.", "bad");
        break;
    }
  }
}
