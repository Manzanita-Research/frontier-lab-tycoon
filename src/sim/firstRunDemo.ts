// Jem's fast opening, reproduced with paid commands; confirmation is explicit for the identical-layout comparison.
import type { Command } from "./commands";
import type { GameState } from "./types";
import { applyNow, tick, TICKS_PER_DAY } from "./tick";

export function jemOpeningCommands(confirmed = true): Command[] {
  const paths: Command[] = [];
  for (let z = 18; z >= 10; z--) paths.push({ type: "placePath", x: 11, z, confirmed });
  for (let x = 12; x <= 15; x++) paths.push({ type: "placePath", x, z: 12, confirmed });
  return [{ type: "skipTutorial" }, ...paths,
    { type: "placeBuilding", kind: "cluster", x: 9, z: 16, confirmed },
    { type: "placeBuilding", kind: "cluster", x: 9, z: 13, confirmed },
    { type: "placeBuilding", kind: "hall", x: 12, z: 19, confirmed },
    { type: "placeBuilding", kind: "hall", x: 12, z: 16, confirmed },
    { type: "placeBuilding", kind: "hall", x: 12, z: 13, confirmed },
    { type: "placeBuilding", kind: "gateway", x: 12, z: 10, confirmed },
    { type: "placeBuilding", kind: "kombucha", x: 15, z: 13, confirmed },
    ...(["janitor", "sre", "comms", "security"] as const).map((job): Command => ({ type: "hire", job, confirmed })),
  ];
}
export function stageFirstRun(s: GameState, moment: string) {
  applyNow(s, jemOpeningCommands(moment !== "jem-confirm"));
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) tick(s);
  // Keep the screenshot readable; warnings are persistent state, not drained toasts.
  s.toasts = [];
  s.thoughts = [];
}
