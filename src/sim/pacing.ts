// Scripted, paid actions for the report and pacing tests. No free compute, money, visitors or map edits.
import type { PlaceableKind } from "../content/buildings";
import { BUILDINGS } from "../content/buildings";
import { canPlace, type Command } from "./commands";
import { openEventOf } from "./events";
import type { GameState } from "./types";

export const PACING_BUILDS: readonly [number, PlaceableKind][] = [
  [10, "hall"], [13, "gateway"], [23, "kombucha"], [30, "snack"], [35, "nap"],
  [45, "demo"], [55, "gateway"], [65, "cluster"], [80, "demo"], [90, "gateway"],
  [110, "cluster"], [125, "hall"], [150, "kombucha"], [170, "nap"], [190, "snack"],
  [210, "gateway"], [230, "cluster"], [250, "hall"], [280, "demo"], [310, "cluster"],
];

/** First connected free spot, kept deterministic for evidence. */
export function pacingSpot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 10; z <= 21; z++) for (let x = 4; x <= 19; x++) {
    if (!canPlace(s, kind, x, z).ok) continue;
    // A placement beside a disconnected path does not count as sensible play.
    if (x + BUILDINGS[kind].size[0] === 11 || x === 12 || z + BUILDINGS[kind].size[1] === 16 || z === 17) return [x, z];
  }
  return null;
}

export function pacingCommands(s: GameState): Command[] {
  const open = openEventOf(s);
  if (open) return [{ type: "chooseEvent", eventId: open.id, choiceIndex: open.id === "waterDiscourse" && s.cash > 1_000_000 ? 1 : open.id === "openWeights" ? 1 : 0 }];
  const cmds: Command[] = [{ type: "continueTutorial" }];
  if (s.flags["unlocked:gas"] !== undefined && s.buildings.filter((b) => b.kind === "gas").length < s.buildings.filter((b) => b.kind === "datacenter").length && s.cash > BUILDINGS.gas.price + 400_000) {
    const spot = pacingSpot(s, "gas");
    if (spot) cmds.push({ type: "placeBuilding", kind: "gas", x: spot[0], z: spot[1] });
  }
  if (s.day === 0) {
    for (let z = 18; z >= 10; z--) cmds.push({ type: "placePath", x: 11, z });
    for (let x = 4; x <= 19; x++) if (x !== 11) cmds.push({ type: "placePath", x, z: 16 });
  }
  if (s.day === 15) cmds.push({ type: "hire", job: "sre" });
  if (s.day === 50) cmds.push({ type: "hire", job: "janitor" });
  if (s.day === 100) cmds.push({ type: "hire", job: "comms" });
  if (s.day === 200) cmds.push({ type: "hire", job: "sre" });
  const kind = PACING_BUILDS.find(([day]) => day === s.day)?.[1];
  if (kind && s.cash >= BUILDINGS[kind].price + 400_000) {
    const spot = pacingSpot(s, kind);
    if (spot) cmds.push({ type: "placeBuilding", kind, x: spot[0], z: spot[1] });
  }
  return cmds;
}
