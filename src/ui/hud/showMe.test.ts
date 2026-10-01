import { describe, expect, it, vi } from "vitest";
import { guardWith } from "./guard";
import { MAX_CLICKS, newWalk, walkStep, type Page, type PageEl } from "./showMe";

/**
 * A tiny Frontier 95 as the walk sees it: Start opens a menu with Facilities ▸, which shows the Staff entry, which opens the
 * Staff Manager on its Hire tab, where the Hire SRE button is. Clicking a control changes what is "on the page".
 */
function fakeF95(opts: { hireTabSelected?: boolean; broken?: string } = {}) {
  const on = { menu: false, facilities: false, staff: false };
  const clicks: string[] = [];
  const el = (name: string, opens: string | null, depth: number, open: () => boolean, onClick: () => void): PageEl => ({
    key: name,
    rect: { x: depth * 10, y: 0, w: 10, h: 10 },
    opens,
    open: open(),
    depth,
    click: () => {
      clicks.push(name);
      if (opts.broken === name) throw new Error(`${name} fell off`);
      onClick();
    },
  });
  const page: Page = {
    anchors: (id) => (id === "hire:sre" && on.staff ? [el("hire:sre", null, 9, () => false, () => {})] : []),
    doors: () => [
      el("start", "build:* hire:* app:*", 2, () => on.menu, () => (on.menu = !on.menu)),
      ...(on.menu ? [el("facilities", "build:* hire:* app:staff", 4, () => on.facilities, () => (on.facilities = true))] : []),
      ...(on.facilities ? [el("staff", "hire:*", 5, () => false, () => (on.staff = true))] : []),
    ],
  };
  return { page, clicks, on };
}

describe("[Show me]'s walk (FLT-93)", () => {
  it("clicks Start, Facilities, Staff, then lights the Hire button", () => {
    const { page, clicks } = fakeF95();
    const walk = newWalk();
    const steps = Array.from({ length: 5 }, () => walkStep("hire:sre", page, walk));
    expect(clicks).toEqual(["start", "facilities", "staff"]);
    expect(steps.map((s) => s.arrived)).toEqual([false, false, false, true, true]);
    expect(steps[3]!.lit).toEqual({ x: 90, y: 0, w: 10, h: 10 });
  });

  it("lights the anchor straight away when it is already showing, and clicks nothing", () => {
    const { page, clicks, on } = fakeF95();
    on.staff = true;
    expect(walkStep("hire:sre", page, newWalk()).arrived).toBe(true);
    expect(clicks).toEqual([]);
  });

  it("does not click a door shut, and points at the way in when the player shut the menu", () => {
    const { page, clicks, on } = fakeF95();
    const walk = newWalk();
    walkStep("hire:sre", page, walk); // opens Start
    on.menu = false; // the player clicked away
    const step = walkStep("hire:sre", page, walk);
    expect(clicks).toEqual(["start"]);
    expect(step).toEqual({ lit: { x: 20, y: 0, w: 10, h: 10 }, arrived: false });
  });

  it("gives up clicking after a handful of doors", () => {
    const doors = Array.from({ length: 10 }, (_, i): PageEl => ({ key: i, rect: { x: i, y: 0, w: 1, h: 1 }, opens: "hire:*", open: false, depth: i, click: () => {} }));
    const walk = newWalk();
    for (let i = 0; i < 10; i++) walkStep("hire:sre", { anchors: () => [], doors: () => doors }, walk);
    expect(walk.clicks).toBe(MAX_CLICKS);
  });

  it("a door that throws costs the walk, not the game: the guard reports it and returns the fallback", () => {
    const { page } = fakeF95({ broken: "start" });
    const sink = vi.fn();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const lit = guardWith(sink, "showMe.walk", () => walkStep("hire:sre", page, newWalk()).lit, null);
    expect(lit).toBeNull();
    expect(sink).toHaveBeenCalledOnce();
    expect(sink.mock.calls[0]![0]).toMatch(/showMe\.walk/);
    expect(sink.mock.calls[0]![0]).toMatch(/start fell off/);
    quiet.mockRestore();
  });

  it("a report that itself fails is swallowed", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(guardWith(() => { throw new Error("no"); }, "x", () => { throw new Error("yes"); }, 7)).toBe(7);
    quiet.mockRestore();
  });
});
