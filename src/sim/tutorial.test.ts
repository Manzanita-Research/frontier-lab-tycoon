import { applyNow, tick, TICKS_PER_DAY } from "./tick";
import { createInitialState } from "./state";
import { assistantOf, pressureReady } from "./tutorial";
import { dailyEvents, openEventOf } from "./events";
import { dailyBreakdowns } from "./breakdowns";
import { createRng } from "./rng";
import { pacingCommands } from "./pacing";
import { visitorDemand } from "./attendance";
import { TUTORIAL_STEPS } from "../content/tutorial";

describe("the first run", () => {
  it("holds five short instructions, advances on successful facts, and catches up out-of-order builds", () => {
    const s = createInitialState(1);
    expect(assistantOf(s)).toMatchObject({ step: "path", highlight: "build:path", paused: true, canSkip: true });
    applyNow(s, [{ type: "placePath", x: 11, z: 19 }]); // already there
    expect(assistantOf(s)?.step).toBe("path");
    applyNow(s, [{ type: "placePath", x: 11, z: 18 }]);
    expect(assistantOf(s)).toMatchObject({ step: "hall", paused: true });
    applyNow(s, [{ type: "continueTutorial" }, { type: "placeBuilding", kind: "hall", x: 12, z: 18 }]);
    expect(assistantOf(s)).toMatchObject({ step: "gateway", paused: true });
    // Hiring early counts when that step is reached.
    applyNow(s, [{ type: "hire", job: "sre" }, { type: "placeBuilding", kind: "gateway", x: 9, z: 21 }, { type: "continueTutorial" }]);
    expect(assistantOf(s)?.step).toBe("gateway"); // no revenue until the daily economy runs
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(s);
    expect(s.ledger.income).toBeGreaterThan(0);
    expect(assistantOf(s)?.step).toBe("release");
    applyNow(s, [{ type: "continueTutorial" }]);
    for (let i = 0; i < 40 * TICKS_PER_DAY; i++) tick(s);
    expect(s.models.length).toBeGreaterThan(0);
    expect(s.tutorial?.value).toBe("done");
    expect(assistantOf(s)).toBeNull();
    expect(TUTORIAL_STEPS).toHaveLength(5);
  });

  it("skip persists through JSON, changes no gameplay facts, and older saves don't restart onboarding", () => {
    const s = createInitialState(2);
    const before = { cash: s.cash, buildings: s.buildings, rng: s.rngState };
    applyNow(s, [{ type: "skipTutorial" }]);
    expect({ cash: s.cash, buildings: s.buildings, rng: s.rngState }).toEqual(before);
    const loaded = JSON.parse(JSON.stringify(s));
    tick(loaded);
    expect(loaded.tutorial.value).toBe("skipped");
    delete loaded.tutorial;
    tick(loaded);
    expect(assistantOf(loaded)).toBeNull();
  });

  it("saves mid-step and follows exactly the same RNG and World after loading", () => {
    const s = createInitialState(3);
    applyNow(s, pacingCommands(s));
    const loaded = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 1500; i++) {
      const a = i % TICKS_PER_DAY === 0 ? pacingCommands(s) : [];
      const b = i % TICKS_PER_DAY === 0 ? pacingCommands(loaded) : [];
      tick(s, a); tick(loaded, b);
    }
    expect(loaded).toEqual(s);
    expect(s.day).toBeGreaterThan(40);
  });

  it("keeps cards, free-model shocks and building fires asleep until day 40 and a launch with a gateway", () => {
    const s = createInitialState(1);
    s.flags["offer:auction"] = 0;
    for (const b of s.buildings) b.reliability = 0;
    s.day = 100;
    dailyEvents(s);
    dailyBreakdowns(s, { ...createRng(1), chance: () => true });
    expect(openEventOf(s)).toBeNull();
    expect(s.buildings.some((b) => b.broken)).toBe(false);
    applyNow(s, [{ type: "placeBuilding", kind: "gateway", x: 12, z: 20 }]);
    s.models.push("Fixture-1");
    s.day = 39;
    expect(pressureReady(s)).toBe(false);
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull();
    s.day = 40;
    expect(pressureReady(s)).toBe(true);
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("computeAuction");
  });

  it("pulls visitors with connected attractions, hype and Vibes, with a late-game cap", () => {
    const s = createInitialState(1);
    s.day = 60;
    const small = visitorDemand(s);
    applyNow(s, [{ type: "placeBuilding", kind: "demo", x: 12, z: 20 }]);
    const attraction = visitorDemand(s);
    expect(attraction.perDay).toBeGreaterThan(small.perDay * 10);
    s.hype = 100;
    s.vibes.value = 999;
    expect(visitorDemand(s).perDay).toBeGreaterThan(attraction.perDay);
    expect(visitorDemand(s).cap).toBeLessThan(400);
    // Cutting off the gate removes even a lovely demo from the draw.
    applyNow(s, [{ type: "bulldoze", x: 11, z: 22 }, { type: "bulldoze", x: 12, z: 22 }]);
    expect(visitorDemand(s).perDay).toBeLessThan(small.perDay * 5);
  });
});
