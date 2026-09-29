import { BUILDINGS } from "../content/buildings";
import { canPlace } from "../sim/commands";
import { buildingAt } from "../sim/pathfind";
import type { GameState, Rect } from "../sim/types";
import type { BuildingKind } from "../sim/types";
import type { Tool } from "../store";

export interface Ghost {
  rect: Rect;
  ok: boolean;
  reason: string;
  kind: BuildingKind | null;
  bulldoze: boolean;
}

/** What the pointer would do right now: the footprint to draw, and why not if it can't. */
export function computeGhost(sim: GameState, tool: Tool | null, hover: { x: number; z: number } | null): Ghost | null {
  if (!tool || !hover) return null;
  if (tool === "bulldoze") {
    const b = buildingAt(sim, hover.x, hover.z);
    const isPath = sim.grid.paths[hover.z * sim.grid.w + hover.x];
    if (!b && !isPath) return null;
    return {
      rect: b ?? { x: hover.x, z: hover.z, w: 1, d: 1 },
      ok: false,
      reason: b ? `Bulldoze ${BUILDINGS[b.kind].name}` : "Bulldoze path",
      kind: null,
      bulldoze: true,
    };
  }
  const res = tool === "path" ? canPlace(sim, "path", hover.x, hover.z) : canPlace(sim, tool, hover.x, hover.z);
  const [w, d] = tool === "path" ? [1, 1] : BUILDINGS[tool].size;
  return {
    rect: { x: hover.x, z: hover.z, w, d },
    ok: res.ok,
    reason: res.ok ? "" : res.reason,
    kind: tool === "path" ? null : tool,
    bulldoze: false,
  };
}
