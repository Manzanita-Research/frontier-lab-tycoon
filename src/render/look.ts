// What walkers look like: the palettes the 3D crowd is coloured from, shared with the inspector's portrait chip so a
// walker's chip matches the little person you tapped.
import type { Walker } from "../sim/types";
import { VISITOR_ROLES } from "../content/names";

export const HOODIES = ["#e8604c", "#f2b134", "#4f8ff0", "#8b6cf0", "#3fb58a"];
export const SKIN = ["#f6d2b0", "#e2a978", "#b57a4f", "#8a5a3a", "#f0c39a"];
/** Visitors dress for their line of work: investor navy, reporter tan, buyer grey, influencer pink. */
export const SUITS: Record<string, string> = {
  [VISITOR_ROLES[0]]: "#2c3e66",
  [VISITOR_ROLES[1]]: "#9a7a48",
  [VISITOR_ROLES[2]]: "#8a93a3",
  [VISITOR_ROLES[3]]: "#e64f9a",
};
export const PICKET = ["#d9482f", "#f2b134", "#3b8f5f", "#7a5cd6", "#2f80c9"];

export interface Look {
  body: string;
  head: string;
}

/** The body and head colours of a walker (agents are white and cyan; the renderer tints them by drift). */
export function lookOf(w: Pick<Walker, "id" | "kind" | "role">): Look {
  switch (w.kind) {
    case "researcher":
      return { body: HOODIES[w.id % HOODIES.length]!, head: SKIN[(w.id * 3) % SKIN.length]! };
    case "visitor":
      return { body: SUITS[w.role] ?? "#8a93a3", head: SKIN[(w.id * 5) % SKIN.length]! };
    case "protester":
      return { body: PICKET[w.id % PICKET.length]!, head: SKIN[(w.id * 7) % SKIN.length]! };
    default:
      return { body: "#f2f6fb", head: "#3ff0ff" };
  }
}
