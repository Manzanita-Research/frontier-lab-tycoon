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

/** Ink that reads on a board of `hex`: near-black on a light colour, white on a dark one. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Whichever contrasts more: white's ratio is 1.05 / (l + 0.05), #1b1b1b's is (l + 0.05) / 0.061. They cross near 0.2.
  return l > 0.2 ? "#1b1b1b" : "#ffffff";
}

/**
 * Every placard on the map: the water crowd's (cream boards, red ink), then each faction's own signs, up to four, on a
 * board in the faction's colour itself, so a mixed crowd at the gate sorts itself out at the default zoom (FLT-56).
 */
export function placards(): Placard[] {
  const water = SIGNS.map((text, i) => ({ text, bg: SIGN_COLORS[i % SIGN_COLORS.length]!, ink: "#b3261e", crowd: "" }));
  const factions = defs().factions.flatMap((f) => f.signs.slice(0, 4).map((text) => ({ text, bg: f.color, ink: inkOn(f.color), crowd: f.id })));
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
