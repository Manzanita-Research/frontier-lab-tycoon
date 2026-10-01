// FLT-73: the CSS glass over the UI must leave text at WCAG AA. Every skin can wear the tube (it is a Display
// Properties setting), so every skin's text pairs are held to 4.5:1 under the worst the glass does to a pixel's
// colours: a scanline's gap row at the far corner of the vignette. The phosphor glow is the text's own colour, so it
// thickens a glyph rather than recolouring text or background; it is held to "faint" for every skin, and a skin that
// turns the tube on by default (Frontier 95) must pass even counting the glow's halo as part of the background.
import { describe, expect, it } from "vitest";
import { contrast } from "../../skins/contrast";
import { catalog } from "../../skins/registry";
import { BASE_TOKENS } from "../../skins/schema";
import { CRT_LOOKS, worstDarkening, type CrtLook } from "./looks";

const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Black at alpha (1 - k) over a colour, as the browser composites it (in display values). */
const shade = (h: string, k: number) => hex(rgb(h).map((v) => v * k));
const mix = (a: string, b: string, t: number) => hex(rgb(a).map((v, i) => v + (rgb(b)[i]! - v) * t));

/**
 * The glow's halo one pixel off a one-pixel stroke: a text-shadow blur of radius R is a Gaussian of sigma R/2, and a
 * 1px line blurred so puts about a quarter of its colour a pixel away (0.24 at sigma 1, 0.18 at sigma 1.5).
 */
const HALO = 0.25;

function underGlass(look: CrtLook, text: string, bg: string, halo = 0) {
  const k = worstDarkening(look);
  return contrast(shade(text, k), shade(mix(bg, text, look.css.glowAlpha * halo), k));
}

const skins = [
  { id: "base", tokens: { ...BASE_TOKENS }, crt: undefined as string | undefined },
  ...catalog.filter((e) => e.manifest).map((e) => ({ id: e.folder, tokens: { ...BASE_TOKENS, ...e.manifest!.tokens }, crt: e.manifest!.crt as string | undefined })),
];
const PAIRS: [string, string][] = [
  ["color.text", "color.panel"],
  ["color.text", "color.panelAlt"],
  ["color.text", "color.inset"],
  ["color.textDim", "color.panel"],
  ["color.tipText", "color.tip"],
  ["color.selectionText", "color.selection"],
  ["color.titlebarText", "color.titlebar"],
  ["color.accentText", "color.accent"],
];

describe("the CRT glass keeps text at WCAG AA", () => {
  it("is faint: the glass never darkens a pixel by more than 5%, and the glow tints at most 8% a pixel off a stroke", () => {
    for (const look of Object.values(CRT_LOOKS)) {
      expect(worstDarkening(look)).toBeGreaterThanOrEqual(0.95);
      expect(look.css.glowAlpha * HALO).toBeLessThanOrEqual(0.08);
      expect(look.css.glowRadius).toBeLessThanOrEqual(3);
    }
  });

  describe.each(Object.entries(CRT_LOOKS))("%s", (_, look) => {
    it.each(skins)("$id", ({ tokens, crt }) => {
      for (const [fg, bg] of PAIRS) {
        expect(underGlass(look, tokens[fg]!, tokens[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        if (crt && crt !== "off") expect(underGlass(look, tokens[fg]!, tokens[bg]!, HALO), `${fg} on ${bg}, with the glow`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it("holds Frontier 95 (the tube's home) to the glow rule", () => {
    expect(skins.find((s) => s.id === "frontier-95")?.crt).toBe("subtle");
  });
});
