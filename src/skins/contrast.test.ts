import { describe, expect, it } from "vitest";
import { catalog } from "./registry";
import { BASE_TOKENS } from "./schema";

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const skins = [{ id: "base", tokens: { ...BASE_TOKENS } }, ...catalog.filter((e) => e.manifest).map((e) => ({ id: e.folder, tokens: { ...BASE_TOKENS, ...e.manifest!.tokens } }))];

describe("contrast", () => {
  it("measures known pairs correctly", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#ffffff")).toBeGreaterThan(4.4);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  describe.each(skins)("$id", ({ tokens }) => {
    const t = (k: string) => tokens[k]!;
    it("text on panel is at least 4.5:1 (also on the alternate surface and inset fields)", () => {
      expect(contrast(t("color.text"), t("color.panel"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("color.text"), t("color.panelAlt"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("color.text"), t("color.inset"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("color.textDim"), t("color.panel"))).toBeGreaterThanOrEqual(4.5);
    });
    it("big numerals are at least 3:1 on what they sit on", () => {
      expect(contrast(t("color.numeral"), t("color.numeralBg"))).toBeGreaterThanOrEqual(3);
    });
    it("tooltips, selections, titles and accent buttons are readable", () => {
      expect(contrast(t("color.tipText"), t("color.tip"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("color.selectionText"), t("color.selection"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("color.titlebarText"), t("color.titlebar"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("color.accentText"), t("color.accent"))).toBeGreaterThanOrEqual(4.5);
    });
    it("the coach's highlight ring stands out from the panel (3:1, like any UI outline)", () => {
      expect(contrast(t("color.highlight"), t("color.panel"))).toBeGreaterThanOrEqual(3);
    });
    it("good and bad are distinguishable from the panel at large-text strength (3:1)", () => {
      expect(contrast(t("color.good"), t("color.panel"))).toBeGreaterThanOrEqual(3);
      expect(contrast(t("color.bad"), t("color.panel"))).toBeGreaterThanOrEqual(3);
    });
  });
});
