// FLT-105: the trip hook and the spells it leaves behind. Generic verbs, so any mod can send the lab somewhere.
import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { createTestCampus, runDays } from "./testkit";
import { TICKS_PER_DAY } from "./constants";
import { morale } from "./training";
import { thoughtOf } from "./mind";
import { dailyThoughts } from "./thoughts";
import { checkCall, runVerb } from "./verbs";
import type { GameState } from "./types";

const verb = (s: GameState, type: string, params: Record<string, unknown> = {}, owner = "acid") => {
  const rng = createRng(s.rngState);
  runVerb({ state: s, rng, run: null, owner }, { type, params } as never);
  s.rngState = rng.state();
};

const researchers = (s: GameState) => s.walkers.filter((w) => w.kind === "researcher");

describe("trip.start / trip.end", () => {
  it("puts a trip on the World in ticks, and clears it once it has worn off", () => {
    const s = createTestCampus(3);
    verb(s, "trip.start", { days: 2, rise: 0.5, fade: 1, label: "Vibe check", lines: ["I am the paper."] });
    expect(s.trip).toMatchObject({ owner: "acid", label: "Vibe check", start: s.tick, end: s.tick + 2 * TICKS_PER_DAY, rise: TICKS_PER_DAY / 2, fade: TICKS_PER_DAY, lines: ["I am the paper."] });
    runDays(s, 2);
    expect(s.trip).toBeDefined();
    runDays(s, 2);
    expect(s.trip).toBeUndefined();
  });

  it("trip.end starts the fade now", () => {
    const s = createTestCampus(3);
    verb(s, "trip.start", { days: 5 });
    runDays(s, 1);
    verb(s, "trip.end");
    expect(s.trip!.end).toBe(s.tick);
  });
});

describe("capability.boost", () => {
  it("adds a share and an amount, and re-ranks the Arena at once", () => {
    const s = createTestCampus(3);
    s.capability = 100;
    verb(s, "capability.boost", { pct: 35, amount: 5 });
    expect(s.capability).toBeCloseTo(140);
  });
});

describe("people.spell", () => {
  const spell = { chance: 1, days: 4, minDays: 2, max: 3, lines: ["The loss curve is a snake. It is eating its tail.", "What is the sound of one GPU clapping?", "Left to start a commune. It has a Discord."], fates: ["back", "bonus", "quit"], afters: ["", "came back with a koan that is also a learning-rate schedule", "{name} left to start a commune. It has a Discord."], bonus: 2 };

  it("sends up to `max` researchers somewhere for a few days, each with a line and a fate", () => {
    const s = createTestCampus(5);
    verb(s, "people.spell", spell);
    const spelled = researchers(s).filter((w) => w.spell);
    expect(spelled).toHaveLength(3);
    for (const w of spelled) {
      expect(spell.lines).toContain(w.spell!.line);
      expect(w.spell!.until - s.day).toBeGreaterThanOrEqual(2);
      expect(w.spell!.until - s.day).toBeLessThanOrEqual(4);
      expect(spell.fates[spell.lines.indexOf(w.spell!.line)]).toBe(w.spell!.fate);
    }
    // Nobody else: visitors and agents keep their heads.
    expect(s.walkers.filter((w) => w.spell && w.kind !== "researcher")).toHaveLength(0);
  });

  it("a spelled researcher thinks their line, out loud, and is no use to the training run", () => {
    const s = createTestCampus(5);
    const before = morale(s);
    verb(s, "people.spell", { ...spell, max: 1 });
    const w = researchers(s).find((r) => r.spell)!;
    expect(thoughtOf(s, w)).toBe(w.spell!.line);
    expect(morale(s)).toBeLessThan(before);
    // Their bubbles take the floor.
    verb(s, "people.spell", { ...spell, max: undefined });
    let spoken = 0;
    for (let i = 0; i < 20; i++) {
      s.thoughts = [];
      dailyThoughts(s, createRng(100 + i), true);
      const t = s.thoughts[0];
      if (t && s.walkers.find((o) => o.id === t.walkerId)?.spell?.line === t.text) spoken++;
    }
    expect(spoken).toBeGreaterThan(2);
  });

  it("each comes back, comes back with a bonus, or leaves for good, when their days are up", () => {
    const s = createTestCampus(5);
    verb(s, "people.spell", spell);
    const fates = new Map(researchers(s).filter((w) => w.spell).map((w) => [w.id, w.spell!.fate]));
    const cap = s.capability;
    runDays(s, 6);
    for (const [id, fate] of fates) {
      const w = s.walkers.find((o) => o.id === id);
      if (fate === "quit") expect(!w || w.machine.value === "quitting" || w.machine.value === "leaving").toBe(true);
      else expect(w?.spell).toBeUndefined();
    }
    if ([...fates.values()].includes("bonus")) expect(s.capability).toBeGreaterThan(cap);
    if ([...fates.values()].includes("quit")) expect(s.news.some((n) => /commune/.test(n.text))).toBe(true);
  });

  it("is deterministic", () => {
    const run = () => {
      const s = createTestCampus(9);
      verb(s, "people.spell", { ...spell, chance: 0.5, max: 6 });
      runDays(s, 6);
      return JSON.stringify({ w: s.walkers.map((w) => [w.id, w.spell?.line ?? ""]), cap: s.capability, rng: s.rngState });
    };
    expect(run()).toBe(run());
  });

  it("checks its parallel lists", () => {
    expect(checkCall({ type: "people.spell", params: spell } as never, "verb", "x")).toEqual([]);
    expect(checkCall({ type: "people.spell", params: { ...spell, fates: ["back"] } } as never, "verb", "x").join()).toMatch(/fates/);
    expect(checkCall({ type: "people.spell", params: { ...spell, fates: ["back", "bonus", "melt"] } } as never, "verb", "x").join()).toMatch(/melt/);
    expect(checkCall({ type: "trip.start", params: { days: 3 } } as never, "verb", "x")).toEqual([]);
  });
});
