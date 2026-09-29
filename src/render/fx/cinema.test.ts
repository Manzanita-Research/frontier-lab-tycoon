import { describe, expect, it } from "vitest";
import { approach, Cinema, PAN_LIMIT, shakeOffset, type View } from "./cinema";

/** Run the director for `seconds` at 60 fps, applying each result to `view` as the rig would. */
function run(c: Cinema, view: View, seconds: number): View {
  let v = { ...view };
  for (let i = 0; i < seconds * 60; i++) {
    const next = c.update(v, 1 / 60);
    if (next) v = next;
  }
  return v;
}

describe("camera director", () => {
  const start: View = { x: 0, z: 0, zoom: 50 };

  it("eases to the action, holds, then eases back to where the player had the camera", () => {
    const c = new Cinema();
    c.focus(start, { x: 6, z: -4, zoom: 1.3, hold: 1 });
    expect(c.phase).toBe("in");
    const mid = run(c, start, 0.15);
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(6); // eased, not snapped
    const there = run(c, mid, 2);
    expect(c.phase).toBe("hold");
    expect(there.x).toBeCloseTo(6, 1);
    expect(there.z).toBeCloseTo(-4, 1);
    expect(there.zoom).toBeCloseTo(65, 0);
    const back = run(c, there, 4);
    expect(c.phase).toBe("idle");
    expect(back.x).toBeCloseTo(0, 1);
    expect(back.zoom).toBeCloseTo(50, 0);
  });

  it("holds an event card's shot until the card closes", () => {
    const c = new Cinema();
    c.focus(start, { x: 2, z: 9, zoom: 1.2, hold: null });
    let v = run(c, start, 10);
    expect(c.phase).toBe("hold");
    expect(c.holdingOpen).toBe(true);
    c.release();
    expect(c.phase).toBe("out");
    v = run(c, v, 4);
    expect(c.phase).toBe("idle");
    expect(v.x).toBeCloseTo(0, 1);
  });

  it("a timed shot never interrupts an open one, and released early it still goes home", () => {
    const c = new Cinema();
    c.focus(start, { x: 2, z: 9, hold: null });
    c.focus(start, { x: -5, z: -5, hold: 1 });
    const v = run(c, start, 3);
    expect(v.x).toBeCloseTo(2, 1);
    // Release while still travelling in: it arrives, then leaves without waiting.
    const d = new Cinema();
    d.focus(start, { x: 8, z: 0, hold: null });
    d.release();
    const w = run(d, start, 6);
    expect(d.phase).toBe("idle");
    expect(w.x).toBeCloseTo(0, 1);
  });

  it("keeps the original home when a second shot starts mid-flight", () => {
    const c = new Cinema();
    c.focus(start, { x: 8, z: 0, hold: 0.5 });
    const mid = run(c, start, 0.4);
    c.focus(mid, { x: -3, z: 3, hold: 0.5 });
    const end = run(c, mid, 8);
    expect(end.x).toBeCloseTo(0, 1);
    expect(end.z).toBeCloseTo(0, 1);
  });

  it("player input cancels: the camera stays where they put it", () => {
    const c = new Cinema();
    c.focus(start, { x: 6, z: 6, hold: 1 });
    const mid = run(c, start, 0.2);
    c.cancel();
    expect(c.active).toBe(false);
    expect(c.update(mid, 1 / 60)).toBeNull();
  });

  it("double-click focus (back: false) stays put after arriving", () => {
    const c = new Cinema();
    c.focus(start, { x: 5, z: 5, zoom: 1.4, hold: 0, back: false });
    const v = run(c, start, 3);
    expect(c.phase).toBe("idle");
    expect(v.x).toBeCloseTo(5, 1);
    expect(v.zoom).toBeCloseTo(70, 0);
  });

  it("clamps a shot to the board, so it can still arrive and end", () => {
    const c = new Cinema();
    c.focus(start, { x: 40, z: -40, hold: 0, back: false });
    const v = run(c, start, 4);
    expect(c.phase).toBe("idle");
    expect(v.x).toBeCloseTo(PAN_LIMIT, 1);
    expect(v.z).toBeCloseTo(-PAN_LIMIT, 1);
  });

  it("shake: trauma adds up, is capped, decays to nothing, and small bumps stay small", () => {
    const c = new Cinema();
    c.shake(0.3);
    c.shake(0.9);
    expect(c.trauma).toBe(1);
    for (let i = 0; i < 120; i++) c.update(start, 1 / 60);
    expect(c.trauma).toBe(0);
    const big = Math.max(...Array.from({ length: 200 }, (_, i) => Math.hypot(...shakeOffset(1, i / 30))));
    const small = Math.max(...Array.from({ length: 200 }, (_, i) => Math.hypot(...shakeOffset(0.15, i / 30))));
    expect(big).toBeGreaterThan(0.2);
    expect(big).toBeLessThan(0.75);
    expect(small).toBeLessThan(0.05);
    expect(shakeOffset(0, 1)).toEqual([0, 0]);
  });

  it("approach is frame-rate independent", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approach(a, 1, 4, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = approach(b, 1, 4, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});
