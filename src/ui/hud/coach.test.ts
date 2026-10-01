// FLT-77: the coach balloon keeps off the window its own step opens (the "read a researcher's mind" Properties window), from
// the first frame that window is on screen.
import { describe, expect, it } from "vitest";
import { placeBalloon, type Rect } from "../../skins/kit/place";
import { opensWindow, type WindowChange } from "./CoachLayer";

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A DOM element, as much of one as `opensWindow` asks about. */
const el = (window: boolean, inner = false) => ({ nodeType: 1, matches: (s: string) => window && s === "[data-coach-avoid]", querySelector: (s: string) => (inner && s === "[data-coach-avoid]" ? {} : null) });
const text = { nodeType: 3 };
const change = (target: ReturnType<typeof el>, added: (ReturnType<typeof el> | typeof text)[]): WindowChange => ({ target, addedNodes: added });

describe("the coach looks again when a window opens", () => {
  it("as the window goes in, on its own or inside a wrapper (the Properties window the peek step opens)", () => {
    expect(opensWindow(change(el(false), [el(true)]))).toBe(true);
    expect(opensWindow(change(el(false), [text, el(false, true)]))).toBe(true);
  });
  it("as a window folds or unfolds (its body comes or goes)", () => {
    expect(opensWindow(change(el(true), [el(false)]))).toBe(true);
  });
  it("but not for every number that ticks inside one, nor for the rest of the HUD", () => {
    expect(opensWindow(change(el(false), [text]))).toBe(false);
    expect(opensWindow(change(el(false), [el(false), text]))).toBe(false);
    expect(opensWindow(change(el(false), []))).toBe(false);
  });
});

describe("the balloon and the window the peek step opens", () => {
  // Measured on main at the peek step (e2e/coach-overlap.mjs): the researcher's pin with the ring's padding, Frontier 95's
  // balloon, and the Properties window the click opened (FLT-77).
  const cases: { view: { w: number; h: number }; anchor: Rect; props: Rect }[] = [
    { view: { w: 1280, h: 800 }, anchor: { x: 507, y: 368, w: 85, h: 36 }, props: { x: 847, y: 299, w: 415, h: 444 } },
    { view: { w: 1024, h: 768 }, anchor: { x: 398, y: 352, w: 85, h: 36 }, props: { x: 650, y: 250, w: 355, h: 460 } },
  ];
  const size = { w: 358, h: 87 };
  const opts = { gap: 18, margin: { top: 12, bottom: 52, left: 10, right: 10 } };
  it("the balloon was on it before the window was measured, and is clear of it once it is", () => {
    for (const { view, anchor, props } of cases) {
      const before = placeBalloon(anchor, size, view, opts);
      expect(overlaps({ ...before, ...size }, props), "the place it had before the window opened").toBe(true);
      const after = placeBalloon(anchor, size, view, { ...opts, avoid: [props] });
      expect(overlaps({ ...after, ...size }, props), JSON.stringify(view)).toBe(false);
      expect(overlaps({ ...after, ...size }, anchor)).toBe(false);
    }
  });
});
