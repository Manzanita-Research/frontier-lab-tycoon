import { getNextTransitions, initialTransition, transition } from "xstate";
import { beatOf, introMachine, START_BEATS, type IntroInput } from "./machine";
import { SHEETS } from "./manual";
import { weightsKey, visitorSeed } from "./key";

type Snap = ReturnType<typeof initialTransition<typeof introMachine>>[0];
const boot = (input: Partial<IntroInput> = {}) => initialTransition(introMachine, { still: false, sheets: SHEETS, ...input })[0];
const run = (s: Snap, ...events: Parameters<typeof transition<typeof introMachine>>[2][]) => events.reduce((snap, e) => transition(introMachine, snap, e)[0], s);
const SETTLED = { type: "SETTLED" } as const;

describe("the big box flow", () => {
  it("goes shelf → pull → unwrap → contents → manual → disc → BIOS → splash → the game", () => {
    let s = boot();
    expect(s.value).toBe("shelf");
    s = run(s, { type: "PEEK", id: "paperclip" });
    expect(s.context.peek).toBe("paperclip");
    s = run(s, { type: "PICK" });
    expect([s.value, s.context.peek]).toEqual(["pulling", null]);
    s = run(s, SETTLED, SETTLED);
    expect(s.value).toBe("open");
    s = run(s, { type: "FOCUS", item: "manual" }, { type: "PAGE", delta: 1 }, { type: "PAGE", delta: 1 });
    expect([s.value, s.context.item, s.context.page]).toEqual(["focus", "manual", 2]);
    s = run(s, { type: "FOCUS", item: "coa" });
    expect([s.context.item, s.context.page]).toEqual(["coa", 0]);
    s = run(s, { type: "BACK" });
    expect([s.value, s.context.item]).toEqual(["open", null]);
    s = run(s, { type: "INSERT" });
    const beats = [beatOf(s.value)];
    for (let i = 0; i < 5; i++) {
      s = run(s, SETTLED);
      beats.push(beatOf(s.value));
    }
    expect(beats).toEqual(["disc", "warmup", "post", "splash", "dive", "game"]);
    expect(s.status).toBe("done");
  });

  it("keeps the manual's pages between the covers", () => {
    let s = run(boot({ start: "manual" }), { type: "PAGE", delta: -5 });
    expect(s.context.page).toBe(0);
    s = run(s, ...Array.from({ length: SHEETS + 3 }, () => ({ type: "PAGE", delta: 1 }) as const));
    expect(s.context.page).toBe(SHEETS);
  });

  it("clicking the disc in the box starts the boot", () => {
    expect(beatOf(run(boot({ start: "open" }), { type: "FOCUS", item: "disc" }).value)).toBe("disc");
    expect(beatOf(run(boot({ start: "coa" }), { type: "FOCUS", item: "disc" }).value)).toBe("disc");
  });

  it("Skip intro → works from every beat", () => {
    const every = new Set<string>();
    for (const start of START_BEATS) {
      let s = boot({ start });
      // Walk the scripted path from here, trying SKIP at each step.
      for (let i = 0; i < 8 && s.status !== "done"; i++) {
        every.add(beatOf(s.value));
        expect(run(s, { type: "SKIP" }).value).toBe("game");
        expect(run(s, { type: "PLAY" }).value).toBe("game");
        s = run(s, s.value === "shelf" ? { type: "PICK" } : s.value === "open" || s.value === "focus" ? { type: "INSERT" } : SETTLED);
      }
    }
    expect([...every].sort()).toEqual(["disc", "dive", "focus", "open", "post", "pulling", "shelf", "splash", "unwrapping", "warmup"]);
  });

  it("reduced motion is a still box: Play goes to the game, the manual is text", () => {
    let s = boot({ still: true, start: "coa" });
    expect(s.value).toBe("still");
    s = run(s, { type: "FOCUS", item: "manual" });
    expect(s.context.item).toBe("manual");
    expect(run(s, { type: "SETTLED" }).value).toBe("still");
    expect(run(s, { type: "PLAY" }).value).toBe("game");
  });

  it("review links open on any beat", () => {
    expect(START_BEATS.map((start) => beatOf(boot({ start }).value))).toEqual(["shelf", "open", "focus", "focus", "focus", "focus", "disc", "post", "splash"]);
    expect(boot({ start: "manual", page: 3 }).context.page).toBe(3);
  });

  it("has no dead ends before the game", () => {
    for (const start of START_BEATS) {
      const s = boot({ start });
      expect(getNextTransitions(s).length, start).toBeGreaterThan(0);
    }
  });
});

describe("the Model Weights Key", () => {
  it("is five groups of five, the same for the same seed", () => {
    expect(weightsKey(42)).toMatch(/^([B-Y2-9]{5}-){4}[B-Y2-9]{5}$/);
    expect(weightsKey(42)).toBe(weightsKey(42));
    expect(weightsKey(42)).not.toBe(weightsKey(43));
    expect(weightsKey(0)).toBe(weightsKey(1));
  });
  it("is seeded per visitor: the URL wins, then what was remembered, then a fresh one that is kept", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(visitorSeed("?seed=7", storage, () => 99)).toBe(7);
    expect(visitorSeed("", storage, () => 99)).toBe(99);
    expect(visitorSeed("", storage, () => 12)).toBe(99);
    expect(visitorSeed("", null, () => 12)).toBe(12);
  });
});
