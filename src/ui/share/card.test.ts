import { beforeAll, describe, expect, it } from "vitest";
import type { EndingVM } from "../hud/types";
import { hudViewModel } from "../hud/vm";
import { fixtureEnding, fixtureInput } from "../hud/fixtures";
import { CARD_H, CARD_W, CHROMED_SKINS, cardTheme, contrastOn, drawCard, fit, wrap } from "./card";

/** Every character is half its font size wide: close enough to a serif to test layout without a browser. */
const px = (font: string) => Number(/(\d+)px/.exec(font)?.[1] ?? 10);
const measureAt = (s: string, size: number) => s.length * size * 0.5;

/** A 2D context that paints nothing and remembers every line of text and where it went (and whether it was drawn moved or turned). */
function recorder() {
  const texts: { text: string; x: number; y: number; w: number; align: string; moved: boolean }[] = [];
  const state = { font: "10px serif", textAlign: "left" };
  const moved: boolean[] = [false];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(state as Record<string, unknown>, {
    get(t, k) {
      if (k in t) return t[k as string];
      if (k === "measureText") return (s: string) => ({ width: measureAt(s, px(state.font)) });
      if (k === "fillText")
        return (s: string, x: number, y: number) => texts.push({ text: s, x, y, w: measureAt(s, px(state.font)), align: state.textAlign, moved: moved.at(-1)! });
      if (k === "save") return () => moved.push(moved.at(-1)!);
      if (k === "restore") return () => moved.length > 1 && moved.pop();
      if (k === "translate" || k === "rotate" || k === "scale") return () => (moved[moved.length - 1] = true);
      if (typeof k === "string" && k.startsWith("create")) return () => gradient;
      return () => undefined;
    },
    set(t, k, v) {
      t[k as string] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

const MOMENTS = ["front-takeover", "front-regulated", "front-acquihired", "front-captured", "front-pivot"];
const endings = new Map<string, EndingVM>();
const ending = (moment: string) => endings.get(moment)!;

describe("share card (FLT-11)", () => {
  // Staging each ending plays a lab to it: seconds each on a CI runner, so once, up front.
  beforeAll(() => {
    for (const m of MOMENTS) endings.set(m, hudViewModel(fixtureInput({ ending: m })).ending!);
  }, 120_000);

  it("wraps by words and fits at the biggest size that keeps to the line budget", () => {
    expect(wrap("a bb ccc dddd", 4, (s) => s.length)).toEqual(["a bb", "ccc", "dddd"]);
    expect(fit("Lab Achieves Safety; Nobody Notices", 500, 2, [44, 40, 36], measureAt).size).toBe(44);
    const long = fit("word ".repeat(60).trim(), 200, 2, [20, 18], measureAt);
    expect(long.size).toBe(18);
    expect(long.lines).toHaveLength(2);
    expect(long.lines[1]!.endsWith("…")).toBe(true);
    expect(measureAt(long.lines[1]!, 18)).toBeLessThanOrEqual(200);
  });

  it("picks readable ink for a skin's accent", () => {
    expect(contrastOn("#ffffff")).toBe("#000000");
    expect(contrastOn("#000080")).toBe("#ffffff");
    expect(contrastOn("not a colour")).toBe("#000000");
  });

  it("has front-page chrome for every bundled skin", () => {
    expect([...CHROMED_SKINS].sort()).toEqual(["discovery-disc-96", "field-almanac", "frontier-95", "homepage-98", "karaoke-night", "swag-drop"]);
  });

  for (const skin of ["base", ...CHROMED_SKINS]) {
    it(`prints every ending in ${skin} with the headline, the lab and the five stats inside 1200×630`, () => {
      for (const moment of MOMENTS) {
        const e = ending(moment);
        const { ctx, texts } = recorder();
        drawCard(ctx, cardTheme(skin, {}), e, null);
        const all = texts.map((t) => t.text).join(" ");
        expect(all).toContain("The Frontier Times");
        for (const word of e.paper.headline.split(" ").slice(0, 3)) expect(all).toContain(word);
        expect(all.replace(/\s+/g, " ")).toContain(e.lab.split(" ")[0]);
        for (const s of e.stats) expect(all).toContain(s.text);
        // The stamp and the stickers are drawn turned, about their own centre; the rest must sit on the card.
        for (const t of texts.filter((t) => !t.moved)) {
          const left = t.align === "center" ? t.x - t.w / 2 : t.align === "right" ? t.x - t.w : t.x;
          expect(left, `${skin} ${moment}: "${t.text}"`).toBeGreaterThanOrEqual(0);
          expect(left + t.w, `${skin} ${moment}: "${t.text}"`).toBeLessThanOrEqual(CARD_W);
          expect(t.y, `${skin} ${moment}: "${t.text}"`).toBeLessThanOrEqual(CARD_H);
        }
      }
    });
  }

  it("prints Lab #2, the streak (a painted flame) and the head-to-head under the stats, in every skin (FLT-57)", () => {
    // A friend's challenge only applies to a first lab; the card is laid out for all three at once regardless.
    const seed = fixtureEnding("front-acquihired").seed;
    const versus = hudViewModel(fixtureInput({ ending: "front-acquihired", social: { challenge: { ending: "captured", day: 212, vibes: 88, models: 7, seed, daily: null } } })).ending!.versus;
    expect(versus).not.toBeNull();
    const e = { ...hudViewModel(fixtureInput({ ending: "lab2", social: { streak: 7 } })).ending!, versus };
    for (const skin of ["base", ...CHROMED_SKINS]) {
      const { ctx, texts } = recorder();
      drawCard(ctx, cardTheme(skin, {}), e, null);
      const at = (s: string) => texts.find((t) => t.text === s);
      expect(at("Lab #2"), skin).toBeDefined();
      const streak = at("7-day streak")!;
      const verdict = at(e.versus!.text)!;
      const lastStat = at(e.stats.at(-1)!.text)!;
      expect(streak.y, skin).toBeGreaterThan(lastStat.y);
      expect(verdict.y, skin).toBeGreaterThan(streak.y);
      for (const t of [streak, verdict, at("Lab #2")!]) {
        const left = t.align === "right" ? t.x - t.w : t.x;
        expect(left, `${skin} "${t.text}"`).toBeGreaterThanOrEqual(816);
        expect(left + t.w, `${skin} "${t.text}"`).toBeLessThanOrEqual(CARD_W - 28);
        expect(t.y, `${skin} "${t.text}"`).toBeLessThanOrEqual(CARD_H - 30);
      }
    }
  }, 60_000);
});
