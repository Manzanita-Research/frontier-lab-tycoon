import { describe, expect, it } from "vitest";
import { placeBalloon } from "./place";

const view = { w: 1440, h: 900 };
const box = { w: 320, h: 120 };
const overlaps = (a: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + box.w > b.x && a.y < b.y + b.h && a.y + box.h > b.y;

describe("placeBalloon", () => {
  it("puts the balloon above a target in the bottom row (the Start button) and beside one higher up (a menu item)", () => {
    const start = { x: 4, y: 862, w: 72, h: 32 };
    const p = placeBalloon(start, box, view, { margin: { bottom: 52 } });
    expect(p.side).toBe("top");
    expect(p.y + box.h).toBeLessThanOrEqual(start.y);
    const menuItem = { x: 40, y: 520, w: 320, h: 32 };
    const q = placeBalloon(menuItem, box, view, { margin: { bottom: 52 } });
    expect(q.side).toBe("right");
    expect(q.x).toBeGreaterThanOrEqual(menuItem.x + menuItem.w);
  });

  it("keeps clear of the taskbar it is told about", () => {
    for (const anchor of [{ x: 4, y: 862, w: 72, h: 32 }, { x: 900, y: 700, w: 100, h: 60 }]) {
      const p = placeBalloon(anchor, box, view, { margin: { bottom: 52 } });
      expect(p.y + box.h).toBeLessThanOrEqual(view.h - 52);
    }
  });

  it("never covers the thing it points at, wherever it is", () => {
    for (const anchor of [{ x: 0, y: 0, w: 100, h: 40 }, { x: 1340, y: 10, w: 90, h: 30 }, { x: 600, y: 400, w: 200, h: 60 }, { x: 1300, y: 850, w: 130, h: 40 }, { x: 4, y: 862, w: 72, h: 32 }]) {
      const p = placeBalloon(anchor, box, view);
      expect(overlaps(p, anchor), JSON.stringify(anchor)).toBe(false);
    }
  });

  it("stays on the screen", () => {
    for (const anchor of [{ x: 0, y: 0, w: 10, h: 10 }, { x: 1430, y: 890, w: 10, h: 10 }, null]) {
      const p = placeBalloon(anchor, box, view);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + box.w).toBeLessThanOrEqual(view.w);
      expect(p.y + box.h).toBeLessThanOrEqual(view.h);
    }
  });

  it("keeps clear of the whole popup the target sits in, level with the target", () => {
    const panel = { x: 431, y: 604, w: 582, h: 191 };
    const target = { x: 660, y: 608, w: 120, h: 100 };
    const p = placeBalloon(target, box, view, { panel, margin: { bottom: 48 } });
    const clear = p.y + box.h <= panel.y || p.y >= panel.y + panel.h || p.x + box.w <= panel.x || p.x >= panel.x + panel.w;
    expect(clear).toBe(true);
    expect(p.side).toBe("top");
  });

  it("honours the preferred order, and with no target sits bottom-right", () => {
    const anchor = { x: 600, y: 400, w: 200, h: 60 };
    expect(placeBalloon(anchor, box, view, { prefer: ["left"] }).side).toBe("left");
    expect(placeBalloon(anchor, box, view, { prefer: ["bottom", "top"] }).side).toBe("bottom");
    const none = placeBalloon(null, box, view);
    expect(none.side).toBe("none");
    expect(none.x).toBeGreaterThan(view.w / 2);
    expect(none.y).toBeGreaterThan(view.h / 2);
  });

  it("steps around the windows it is told to avoid (FLT-58: the coach never covers a card)", () => {
    const anchor = { x: 600, y: 400, w: 200, h: 60 };
    const card = { x: 820, y: 300, w: 400, h: 300 };
    const p = placeBalloon(anchor, box, view, { prefer: ["right", "left"], avoid: [card] });
    expect(p.side).toBe("left");
    expect(overlaps(p, card)).toBe(false);
    const corner = { x: view.w - 500, y: view.h - 300, w: 500, h: 300 };
    const none = placeBalloon(null, box, view, { avoid: [corner] });
    expect(overlaps(none, corner)).toBe(false);
  });
});
