import type { CoachLine, CoachMark } from "../content/coach";
import { canPlace } from "./commands";
import { coachMachine } from "./machines/coach";
import { initialStored, step } from "./machines/run";
import { entrances, getReach, isReachable } from "./pathfind";
import type { GameState } from "./types";
import { defs } from "./defs";

export function coachOf(s: GameState): CoachMark | null {
  if (!s.coach || s.coach.value !== "active") return null;
  const index = s.coach.context.index;
  const line = defs().coach[index];
  if (!line) return null;
  const mark: CoachMark = { ...line, step: index + 1, of: defs().coach.length, canSkip: true };
  if (line.id === "path") {
    const tiles: [number, number][] = [];
    for (let z = 18; z >= 15; z--) if (canPlace(s, "path", 11, z).ok) tiles.push([11, z]);
    if (tiles.length) mark.suggest = { kind: "path", tiles };
  } else if (line.id === "hall" || line.id === "gateway") {
    const building = line.id === "hall" ? "hall" : "gateway";
    const preferred: [number, number] = building === "hall" ? [12, 16] : [12, 20];
    const [w, d] = defs().buildings[building].size;
    const connected = (x: number, z: number) => canPlace(s, building, x, z).ok &&
      entrances(s, { x, z, w, d }).some((e) => getReach(s).tiles[e.z * s.grid.w + e.x]);
    let at = connected(...preferred) ? preferred : null;
    for (let z = 3; !at && z <= 21; z++) for (let x = 2; !at && x <= 20; x++) if (connected(x, z)) at = [x, z];
    if (at) mark.suggest = { kind: "building", building, x: at[0], z: at[1] };
  }
  return mark;
}
export function updateCoach(s: GameState, ticked = false) {
  if (!s.coach || s.coach.value !== "active") return;
  for (let i = 0; i < defs().coach.length; i++) {
    const line: CoachLine | undefined = defs().coach[s.coach.context.index];
    if (!line) break;
    const reach: ReturnType<typeof getReach>["tiles"] | null = line.trigger === "pathConnected" ? getReach(s).tiles : null;
    const matches: boolean = line.trigger === "buildPanelOpened" ? s.flags.coachBuildOpened !== undefined || (s.flags.coachReplayAt === undefined && s.flags.firstPath !== undefined)
      : line.trigger === "pathConnected" ? s.flags.firstPath !== undefined && reach!.filter(Boolean).length >= 8
      : line.trigger === "hallBuilt" ? s.buildings.some((b) => b.kind === "hall" && isReachable(s, b))
      : line.trigger === "released" ? s.models.length > 0
      : line.trigger === "gatewayBuilt" ? s.buildings.some((b) => b.kind === "gateway" && isReachable(s, b)) : false;
    if (!matches) break;
    s.coach = step(coachMachine, s.coach, { type: "CHECK", matches, last: s.coach.context.index === defs().coach.length - 1 }).stored;
  }
  if (ticked && s.coach.value === "active") {
    s.coach = step(coachMachine, s.coach, { type: "TICK", timer: defs().coach[s.coach.context.index]?.waitFor === "timer", last: s.coach.context.index === defs().coach.length - 1 }).stored;
  }
}
export function coachCommand(s: GameState, type: "coachSkip" | "coachReplay" | "coachClick") {
  if (type === "coachReplay") { s.coach = initialStored(coachMachine, undefined); delete s.flags.coachBuildOpened; s.flags.coachReplayAt = s.tick; return; }
  if (!s.coach) return;
  s.coach = type === "coachSkip" ? step(coachMachine, s.coach, { type: "SKIP" }).stored
    : step(coachMachine, s.coach, { type: "CLICK", timer: defs().coach[s.coach.context.index]?.waitFor === "timer", last: s.coach.context.index === defs().coach.length - 1 }).stored;
}
