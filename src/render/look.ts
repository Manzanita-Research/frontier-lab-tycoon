// What walkers look like: the palettes the 3D crowd is coloured from, shared with the inspector's portrait chip so a
// walker's chip matches the little person you tapped.
import type { Walker } from "../sim/types";
import { VISITOR_ROLES } from "../content/names";
import { SIGNS, SIGN_COLORS } from "../content/protest";
import { defs } from "../sim/defs";

export const HOODIES = ["#e8604c", "#f2b134", "#4f8ff0", "#8b6cf0", "#3fb58a"];
export const SKIN = ["#f6d2b0", "#e2a978", "#b57a4f", "#8a5a3a", "#f0c39a"];
/** Visitors dress for their line of work: investor navy, reporter tan, buyer grey, influencer pink. */
export const SUITS: Record<string, string> = {
  [VISITOR_ROLES[0]]: "#2c3e66",
  [VISITOR_ROLES[1]]: "#9a7a48",
  [VISITOR_ROLES[2]]: "#8a93a3",
  [VISITOR_ROLES[3]]: "#e64f9a",
};
/** The water crowd dresses in water (FLT-56: blue, like its row in the gate legend), so the factions' colours stand out beside it. */
export const PICKET = ["#3fa7d6", "#2f80c9", "#5bc0eb", "#2a6f97", "#7cc6e8"];

/** The colour a faction's marchers wear (FLT-56): their own, so you can tell who is at the gate. Null for the water crowd. */
export function crowdColor(crowd: string | undefined): string | null {
  return crowd ? (defs().factionById(crowd)?.color ?? null) : null;
}

/** A placard: what it says, its board, its ink, and whose it is ("" for the water crowd). */
export interface Placard {
  text: string;
  bg: string;
  ink: string;
  crowd: string;
}

/** Mix a colour toward white (`k` 0 is the colour, 1 is white). */
function pale(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

/**
 * Every placard on the map: the water crowd's (cream boards, red ink), then each faction's own signs, up to four, on a
 * board in a pale wash of the faction's colour with the colour itself for ink, so a mixed crowd at the gate sorts itself
 * out at a glance (FLT-56).
 */
export function placards(): Placard[] {
  const water = SIGNS.map((text, i) => ({ text, bg: SIGN_COLORS[i % SIGN_COLORS.length]!, ink: "#b3261e", crowd: "" }));
  const factions = defs().factions.flatMap((f) => f.signs.slice(0, 4).map((text) => ({ text, bg: pale(f.color, 0.82), ink: f.color, crowd: f.id })));
  return [...water, ...factions];
}

export interface Look {
  body: string;
  head: string;
}

/** The body and head colours of a walker (agents are white and cyan; the renderer tints them by drift). */
export function lookOf(w: Pick<Walker, "id" | "kind" | "role" | "crowd">): Look {
  switch (w.kind) {
    case "researcher":
      return { body: HOODIES[w.id % HOODIES.length]!, head: SKIN[(w.id * 3) % SKIN.length]! };
    case "visitor":
      return { body: SUITS[w.role] ?? "#8a93a3", head: SKIN[(w.id * 5) % SKIN.length]! };
    case "protester":
      return { body: crowdColor(w.crowd) ?? PICKET[w.id % PICKET.length]!, head: SKIN[(w.id * 7) % SKIN.length]! };
    default:
      return { body: "#f2f6fb", head: "#3ff0ff" };
  }
}
