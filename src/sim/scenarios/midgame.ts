// A scripted player, not a save-file fixture: every building, hire and release goes through the ordinary sim.
import { BUILDINGS, type PlaceableKind } from "../../content/buildings";
import { eventById } from "../../content/events";
import { canPlace, type Command } from "../commands";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { buildingAt, isPathTile, rectContains } from "../pathfind";
import { enableLeapfrog } from "../race/leapfrog/driver";
import { createInitialState } from "../state";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";

export const MIDGAME_SEED = 48;
export const MIDGAME_CAMERA = { focus: [11.5, 14.5] as [number, number], zoom: 43 };
/** The chosen pair-launch joke starts the tape. Keep the real ids in order so new news joins normally on resume. */
export function midgameOpeningNews(s: GameState) {
  const chosen = s.news.find((n) => n.day === s.leapfrog.last?.day && n.text.includes("answers") && n.text.includes("within 24 hours"));
  if (!chosen) throw new Error("Mid-game opening headline is missing");
  return s.news.filter((n) => n.id >= chosen.id);
}

function pave(s: GameState, plaza = false) {
  const cmds: Command[] = [];
  const put = (x: number, z: number) => { if (canPlace(s, "path", x, z).ok) cmds.push({ type: "placePath", x, z }); };
  if (plaza) for (let z = 17; z <= 22; z++) for (let x = 6; x <= 17; x++) put(x, z);
  else {
    for (const z of [7, 10, 16]) for (let x = 5; x <= 18; x++) put(x, z);
    for (const x of [5, 17]) for (let z = 7; z <= 22; z++) put(x, z);
  }
  applyNow(s, cmds);
}

function spot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 7; z <= 16; z++) for (let x = 3; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

function build(s: GameState): Command[] {
  const n = (kind: PlaceableKind) => s.buildings.filter((b) => b.kind === kind).length;
  const halls = n("hall");
  let kind: PlaceableKind | null = null;
  if (n("gateway") < Math.min(4, 1 + Math.floor(s.day / 80))) kind = "gateway";
  else if (n("kombucha") < Math.min(2, 1 + Math.floor(halls / 2))) kind = "kombucha";
  else if (s.day > 30 && n("nap") < Math.min(2, Math.ceil(halls / 2))) kind = "nap";
  else if (s.day > 50 && n("snack") < 1) kind = "snack";
  else if (n("cluster") < Math.min(5, 2 * halls)) kind = "cluster";
  else if (halls < 5) kind = "hall";
  else if (n("demo") < 1) kind = "demo";
  if (!kind || s.buildings.length >= 20 || s.cash < BUILDINGS[kind].price + 400_000) return [];
  const at = spot(s, kind);
  return at ? [{ type: "placeBuilding", kind, x: at[0], z: at[1] }] : [];
}

function answer(s: GameState): Command[] {
  const open = openEventOf(s);
  if (!open) return [];
  // Hold the run, bid low at auctions, and leave the Water Discourse unresolved in the world (not a modal).
  const choice = open.id === "shipNow" ? 1 : open.id === "computeAuction" ? 0 : open.id === "waterDiscourse" ? 2 : 0;
  return [{ type: "chooseEvent", eventId: open.id, choiceIndex: Math.min(choice, eventById(open.id)!.choices.length - 1) }];
}

export function walkerOnCampus(s: GameState): boolean {
  return s.walkers.every((w) => isPathTile(s, Math.floor(w.x), Math.floor(w.z)) || !!buildingAt(s, w.x, w.z) || rectContains(s.gate, w.x, w.z));
}

export function createMidgameScenario(): GameState {
  const s = createInitialState(MIDGAME_SEED);
  enableLeapfrog(s);
  pave(s);
  // TODO(FLT-47): mark the scenario's unlock ladder complete once that ladder exists.
  for (let i = 0; s.day < 480 && i < 500 * TICKS_PER_DAY && outcomeOf(s) !== "lost"; i++) {
    let cmds = answer(s);
    // Auction cards have no pass button; bid low, then resell any awarded unpowered bunker.
    for (const b of s.buildings) if (b.kind === "datacenter") cmds.push({ type: "bulldoze", x: b.x, z: b.z });
    if (!cmds.length && s.tick % (4 * TICKS_PER_DAY) === 0) cmds = build(s);
    if (!cmds.length && s.tick % (4 * TICKS_PER_DAY) === 2) {
      const n = (job: string) => s.staff.filter((o) => o.job === job).length;
      if (s.day > 15 && n("sre") < Math.min(12, 1 + Math.floor(s.day / 25))) cmds.push({ type: "hire", job: "sre" });
      else if (s.day > 30 && n("janitor") < 12) cmds.push({ type: "hire", job: "janitor" });
    }
    if (s.day === 350 && s.tick % TICKS_PER_DAY === 0) pave(s, true);
    tick(s, cmds);
    // Y2 · Feb 29, the day-after counter-launch. The three ordinary bubbles at this tick were curated in the capture.
    if (s.day === 418 && s.tick % TICKS_PER_DAY === 10) return s;
  }
  throw new Error("Mid-game scenario could not reach its opening moment");
}
