// FLT-90: a dragged window stays reachable, is remembered per window and per skin, and comes back after a reset.
import { describe, expect, it } from "vitest";
import { BAR, clampPlace, GRIP, makeOrder, makePlaces, placesKey, TASKBAR, Z_BASE, Z_TOP } from "./places";

const view = { width: 1440, height: 900 };

function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("clampPlace", () => {
  it("leaves a window that is on the screen where it is", () => {
    expect(clampPlace({ x: 300, y: 200, w: 400 }, view)).toEqual({ x: 300, y: 200, w: 400 });
  });

  it("keeps the title bar below the top of the screen and above the taskbar", () => {
    expect(clampPlace({ x: 300, y: -80, w: 400 }, view).y).toBe(0);
    expect(clampPlace({ x: 300, y: 5000, w: 400 }, view).y).toBe(900 - TASKBAR - BAR);
  });

  it("lets a window hang off either side, but keeps a grip of its title bar on the screen", () => {
    expect(clampPlace({ x: -1000, y: 100, w: 400 }, view).x).toBe(GRIP - 400);
    expect(clampPlace({ x: 5000, y: 100, w: 400 }, view).x).toBe(1440 - GRIP);
    // Half off the left edge is fine: the grip is still there.
    expect(clampPlace({ x: -200, y: 100, w: 400 }, view).x).toBe(-200);
  });

  it("pulls a window back in when the screen shrinks (a laptop after a big monitor)", () => {
    const placed = { x: 1700, y: 1100, w: 400 };
    expect(clampPlace(placed, { width: 1024, height: 700 })).toEqual({ x: 1024 - GRIP, y: 700 - TASKBAR - BAR, w: 400 });
  });

  it("never asks for an impossible range on a tiny screen", () => {
    const p = clampPlace({ x: 50, y: 50, w: 400 }, { width: 40, height: 40 });
    expect(p.y).toBe(0);
    expect(Number.isFinite(p.x)).toBe(true);
  });

  it("rounds to whole pixels, so the bevels stay crisp", () => {
    expect(clampPlace({ x: 10.6, y: 20.2, w: 400 }, view)).toEqual({ x: 11, y: 20, w: 400 });
  });
});

describe("makePlaces", () => {
  it("remembers a window across a reload, per window id", () => {
    const storage = memory();
    const first = makePlaces("frontier-95", storage);
    first.set("inspector", { x: 40, y: 60, w: 400 });
    first.set("f95-lab", { x: 700, y: 10, w: 600 });
    const again = makePlaces("frontier-95", storage);
    expect(again.get("inspector")).toEqual({ x: 40, y: 60, w: 400 });
    expect(again.get("f95-lab")).toEqual({ x: 700, y: 10, w: 600 });
    expect(again.get("thoughts")).toBeUndefined();
  });

  it("keeps each skin's positions apart", () => {
    const storage = memory();
    makePlaces("frontier-95", storage).set("inspector", { x: 40, y: 60, w: 400 });
    expect(makePlaces("my-95-mod", storage).get("inspector")).toBeUndefined();
    expect(storage.data.has(placesKey("frontier-95"))).toBe(true);
  });

  it("reset puts every window back and forgets them", () => {
    const storage = memory();
    const places = makePlaces("frontier-95", storage);
    places.set("inspector", { x: 40, y: 60, w: 400 });
    expect(places.any()).toBe(true);
    let heard = 0;
    places.subscribe(() => heard++);
    places.reset();
    expect(places.any()).toBe(false);
    expect(places.get("inspector")).toBeUndefined();
    expect(heard).toBe(1);
    expect(storage.data.has(placesKey("frontier-95"))).toBe(false);
    expect(makePlaces("frontier-95", storage).any()).toBe(false);
  });

  it("ignores a garbled save rather than trusting it", () => {
    const storage = memory({ [placesKey("frontier-95")]: JSON.stringify({ ok: { x: 1, y: 2, w: 300 }, nan: { x: "a", y: 2, w: 3 }, zero: { x: 1, y: 1, w: 0 }, nope: null }) });
    const places = makePlaces("frontier-95", storage);
    expect(places.get("ok")).toEqual({ x: 1, y: 2, w: 300 });
    expect(places.get("nan")).toBeUndefined();
    expect(places.get("zero")).toBeUndefined();
    expect(places.get("nope")).toBeUndefined();
    expect(makePlaces("frontier-95", memory({ [placesKey("frontier-95")]: "{not json" })).any()).toBe(false);
  });

  it("survives a storage that throws: the positions just live for this visit", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const places = makePlaces("frontier-95", broken);
    places.set("inspector", { x: 40, y: 60, w: 400 });
    expect(places.get("inspector")).toEqual({ x: 40, y: 60, w: 400 });
    expect(() => places.reset()).not.toThrow();
    expect(makePlaces("frontier-95", null).any()).toBe(false);
  });
});

describe("makeOrder", () => {
  it("brings the last window clicked to the front, below the Start menu", () => {
    const order = makeOrder();
    expect(order.z("a")).toBeUndefined();
    order.raise("a");
    order.raise("b");
    expect(order.z("b")!).toBeGreaterThan(order.z("a")!);
    order.raise("a");
    expect(order.z("a")!).toBeGreaterThan(order.z("b")!);
    for (let i = 0; i < 50; i++) order.raise(`w${i}`);
    expect(order.z("w49")).toBe(Z_TOP);
    expect(order.z("w40")).toBeGreaterThan(Z_BASE);
    // The long-forgotten fall back to the game's own order.
    expect(order.z("w0")).toBeUndefined();
  });
});
