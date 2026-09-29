import { BUILDINGS } from "../content/buildings";
import { EVENTS, eventById } from "../content/events";
import { GOALS, SCENARIO } from "../content/goals";
import { applyCommands, type Command } from "./commands";
import { MAX_AGENTS } from "./constants";
import { dailyEvents, openEventOf } from "./events";
import { dailyGoals, outcomeOf } from "./goals";
import { dailyDiscourse, protesterCount, protesterTarget, syncProtesters } from "./protest";
import { createRng } from "./rng";
import { createInitialState } from "./state";
import { TICKS_PER_DAY, tick } from "./tick";
import { agentTarget, fillAgents, researcherTarget, seedWalkers, visitorCap } from "./walkers";
import type { GameState } from "./types";

const count = (s: GameState, kind: string) => s.walkers.filter((w) => w.kind === kind).length;
const run = (s: GameState, days: number, script: (s: GameState) => Command[] = () => []) => {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) tick(s, i % TICKS_PER_DAY === 0 ? script(s) : []);
};
const choose = (s: GameState, index: number): Command => ({ type: "chooseEvent", eventId: openEventOf(s)!.id, choiceIndex: index });

/** A state with the water event open, cash and discourse known. */
function withWaterEvent(seed = 1): GameState {
  const s = createInitialState(seed);
  s.day = 70;
  s.waterDiscourse = 34;
  dailyEvents(s);
  expect(openEventOf(s)?.id).toBe("waterDiscourse");
  return s;
}

describe("crowd density", () => {
  it("seats 10 + 4 per hall researchers (applicants fill it) and 6 + capability/2 agents, capped at 400", () => {
    const s = createInitialState(1);
    expect(count(s, "researcher")).toBe(8 + 3);
    expect(researcherTarget(s)).toBe(14);
    s.buildings.push({ id: 99, kind: "hall", x: 1, z: 1, w: 3, d: 3, placedTick: 0 });
    expect(researcherTarget(s)).toBe(18);
    s.capability = 40;
    expect(agentTarget(s)).toBe(26);
    s.capability = 5000;
    expect(agentTarget(s)).toBe(MAX_AGENTS);
  });

  it("grows the researcher and agent populations toward their targets", () => {
    const s = createInitialState(3);
    s.buildings.push({ id: 99, kind: "hall", x: 1, z: 1, w: 3, d: 3, placedTick: 0 });
    s.capability = 60;
    tick(s, [{ type: "placePath", x: 5, z: 16 }]); // bump the version so spawns can find the buildings
    run(s, 12);
    expect(count(s, "researcher")).toBe(researcherTarget(s));
    expect(count(s, "agent")).toBe(agentTarget(s));
  });

  it("sends visitors round 2 or 3 buildings", () => {
    const s = createInitialState(5);
    const visitor = s.walkers.find((w) => w.kind === "visitor")!;
    expect(visitor.visits).toBeGreaterThanOrEqual(1); // seeded visitors have already picked a first stop
    expect(visitor.visits).toBeLessThanOrEqual(2);
  });

  it("has walkers loiter next to their last building instead of vanishing from the paths", () => {
    const s = createInitialState(2);
    let loitering = 0;
    for (let i = 0; i < 600; i++) {
      tick(s);
      loitering = Math.max(loitering, s.walkers.filter((w) => w.machine.value === "loitering").length);
    }
    expect(loitering).toBeGreaterThan(3);
  });

  it("keeps 500 walkers (400 agents) under 0.3 ms per tick", () => {
    const s = createInitialState(1);
    const rng = createRng(11);
    s.capability = 4000; // agentTarget caps at 400
    fillAgents(s, rng);
    seedWalkers(s, "visitor", 70, rng);
    s.waterDiscourse = 160;
    syncProtesters(s, rng, true);
    expect(count(s, "agent")).toBe(400);
    expect(s.walkers.length).toBeGreaterThanOrEqual(500);
    for (let i = 0; i < 100; i++) tick(s); // warm up the JIT and spread the crowd out
    let best = Infinity;
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) tick(s);
      best = Math.min(best, (performance.now() - t0) / 200);
    }
    console.log(`500-walker tick: ${best.toFixed(3)} ms (best of 3 x 200 ticks)`);
    expect(best).toBeLessThan(0.3);
  });
});

describe("goals", () => {
  it("starts with the three scenario objectives, all unmet", () => {
    const s = createInitialState(1);
    expect(outcomeOf(s)).toBe("playing");
    expect(s.goals.context.goals.map((g) => g.id)).toEqual(GOALS.map((g) => g.id));
    expect(s.goals.context.goals.every((g) => !g.met)).toBe(true);
    expect(SCENARIO.deadlineDay).toBe(360);
  });

  it("tracks progress and latches a goal once it is met", () => {
    const s = createInitialState(1);
    const rng = createRng(1);
    s.models = ["Frontier-2", "Frontier-3-Reasoner"];
    s.ledger = { income: 140_000, expenses: 0, net: 140_000 };
    s.hype = 61;
    dailyGoals(s, rng);
    expect(s.goals.context.goals.map((g) => [g.value, g.met])).toEqual([
      [2, false],
      [140_000, false],
      [61, true],
    ]);
    s.hype = 30; // hype dips, but the milestone stays ticked
    dailyGoals(s, rng);
    expect(s.goals.context.goals[2]!.met).toBe(true);
    expect(outcomeOf(s)).toBe("playing");
  });

  it("wins the day all three are met, with a headline", () => {
    const s = createInitialState(1);
    s.models = ["a", "b", "c"];
    s.ledger = { income: 260_000, expenses: 0, net: 260_000 };
    s.hype = 64;
    dailyGoals(s, createRng(1));
    expect(outcomeOf(s)).toBe("won");
    expect(s.news.at(-1)!.text).toContain("raising the milestones");
    expect(s.news.at(-1)!.text).toContain(s.labName);
  });

  it("loses at the deadline with anything unmet, but not a day early", () => {
    const s = createInitialState(1);
    s.day = SCENARIO.deadlineDay - 1;
    dailyGoals(s, createRng(1));
    expect(outcomeOf(s)).toBe("playing");
    s.day = SCENARIO.deadlineDay;
    dailyGoals(s, createRng(1));
    expect(outcomeOf(s)).toBe("lost");
    expect(s.news.at(-1)!.text).toContain("NFTs of its own GPUs");
  });

  it("loses when cash sinks below -$2M, and freezes time afterwards", () => {
    const s = createInitialState(1);
    s.cash = -2_500_000;
    s.economy = { ...s.economy, context: { lastBailout: s.day } }; // the bridge round already happened
    dailyGoals(s, createRng(1));
    expect(outcomeOf(s)).toBe("lost");
    const t = s.tick;
    run(s, 2);
    expect(s.tick).toBe(t);
  });

  it("keeps playing after a win without flipping to a loss at the deadline", () => {
    const s = createInitialState(1);
    s.goals = { ...s.goals, value: "won" };
    s.day = SCENARIO.deadlineDay + 5;
    dailyGoals(s, createRng(1));
    expect(outcomeOf(s)).toBe("won");
  });
});

describe("water discourse and protesters", () => {
  it("rises 0.5 per cluster per day and decays 0.3 per day", () => {
    const s = createInitialState(1);
    dailyDiscourse(s, createRng(1));
    expect(s.waterDiscourse).toBeCloseTo(0.2);
    s.buildings.push({ id: 90, kind: "cluster", x: 0, z: 0, w: 2, d: 2, placedTick: 0 });
    s.buildings.push({ id: 91, kind: "cluster", x: 0, z: 3, w: 2, d: 2, placedTick: 0 });
    dailyDiscourse(s, createRng(1));
    expect(s.waterDiscourse).toBeCloseTo(0.2 + 1.5 - 0.3);
    s.buildings = [];
    s.waterDiscourse = 0.1;
    dailyDiscourse(s, createRng(1));
    expect(s.waterDiscourse).toBe(0);
  });

  it("puts floor(discourse / 4) protesters at the gate, capped at 40, and thins them out again", () => {
    const s = createInitialState(1);
    s.waterDiscourse = 33;
    dailyDiscourse(s, createRng(1));
    expect(protesterTarget(s)).toBe(8);
    expect(protesterCount(s)).toBe(8);
    s.waterDiscourse = 500;
    dailyDiscourse(s, createRng(1));
    expect(protesterCount(s)).toBe(40);
    s.waterDiscourse = 12;
    dailyDiscourse(s, createRng(1));
    expect(s.walkers.filter((w) => w.kind === "protester" && w.machine.value !== "leaving")).toHaveLength(3);
    run(s, 2); // the extras walk out through the gate and despawn
    expect(protesterCount(s)).toBe(3);
  });

  it("keeps protesters near the gate and out of every building", () => {
    const s = createInitialState(4);
    s.waterDiscourse = 60;
    dailyDiscourse(s, createRng(1));
    for (let i = 0; i < 800; i++) {
      tick(s);
      for (const w of s.walkers) {
        if (w.kind !== "protester") continue;
        expect(w.machine.value).not.toBe("inside");
        expect(s.buildings.some((b) => w.x >= b.x && w.x < b.x + b.w && w.z >= b.z && w.z < b.z + b.d)).toBe(false);
        if (i > 200) {
          expect(w.z).toBeGreaterThan(s.gate.z - 6.5);
          expect(Math.abs(w.x - (s.gate.x + s.gate.w / 2))).toBeLessThan(5);
        }
      }
    }
  });

  it("halves visitor spawns and adds the protest thought while 10 or more are present", () => {
    const spawns = (protest: boolean) => {
      let total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const s = createInitialState(seed);
        s.walkers = s.walkers.filter((w) => w.kind !== "visitor");
        if (protest) {
          s.waterDiscourse = 44;
          dailyDiscourse(s, createRng(seed));
        }
        for (let i = 0; i < 400; i++) {
          const before = count(s, "visitor");
          tick(s);
          total += Math.max(0, count(s, "visitor") - before);
        }
      }
      return total;
    };
    const calm = spawns(false);
    const crowded = spawns(true);
    expect(crowded).toBeLessThan(calm * 0.75);
  });
});

describe("events", () => {
  it("fires once discourse hits 30 (after day 60), and pauses the game until answered", () => {
    const s = createInitialState(1);
    s.waterDiscourse = 29.9;
    s.day = 90;
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull(); // not angry enough yet
    s.waterDiscourse = 31;
    s.day = 59;
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull(); // too early in the run
    s.day = 60;
    dailyEvents(s);
    expect(openEventOf(s)).toEqual({ id: "waterDiscourse", day: 60 });
    const t = s.tick;
    run(s, 3);
    expect(s.tick).toBe(t);
    tick(s, [choose(s, 0)]);
    expect(openEventOf(s)).toBeNull();
    expect(s.tick).toBe(t + 1);
  });

  it("ignores a choice for the wrong event or an index that does not exist", () => {
    const s = withWaterEvent();
    applyCommands(s, [{ type: "chooseEvent", eventId: "drumCircle", choiceIndex: 0 }], createRng(1));
    applyCommands(s, [{ type: "chooseEvent", eventId: "waterDiscourse", choiceIndex: 7 }], createRng(1));
    expect(openEventOf(s)?.id).toBe("waterDiscourse");
  });

  it("choice 1: the water report costs $150K and cuts discourse by 20", () => {
    const s = withWaterEvent();
    const cash = s.cash;
    applyCommands(s, [choose(s, 0)], createRng(1));
    expect(s.cash).toBe(cash - 150_000);
    expect(s.waterDiscourse).toBe(14);
    expect(s.news.at(-1)!.text).toContain("nobody reads past the abstract");
    expect(openEventOf(s)).toBeNull();
  });

  it("choice 2: the Transparency Fountain costs $300K, cuts discourse by 35, adds hype and a free fountain by the gate", () => {
    const s = withWaterEvent();
    const { cash, hype } = s;
    applyCommands(s, [choose(s, 1)], createRng(1));
    expect(s.cash).toBe(cash - 300_000);
    expect(s.waterDiscourse).toBe(0);
    expect(s.hype).toBe(hype + 5);
    const fountain = s.buildings.find((b) => b.kind === "fountain")!;
    expect(fountain).toBeDefined();
    expect(Math.abs(fountain.x - s.gate.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(fountain.z - s.gate.z)).toBeLessThanOrEqual(2);
    expect(BUILDINGS.fountain.size).toEqual([1, 1]);
    expect(s.thoughts.some((t) => t.text.includes("Transparency Fountain"))).toBe(true);
  });

  it("choice 3: saying nothing is free, adds hype and discourse, and sets the flag", () => {
    const s = withWaterEvent();
    const { cash, hype } = s;
    applyCommands(s, [choose(s, 2)], createRng(1));
    expect(s.cash).toBe(cash);
    expect(s.hype).toBe(hype + 3);
    expect(s.waterDiscourse).toBe(44);
    expect(s.flags.ignoredWater).toBe(70);
    expect(protesterTarget(s)).toBe(11);
  });

  it("does not repeat inside its 60-day cooldown, and can fire again after", () => {
    const s = withWaterEvent();
    applyCommands(s, [choose(s, 0)], createRng(1));
    s.waterDiscourse = 50;
    s.day = 70 + 59;
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull();
    s.day = 70 + 60;
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("waterDiscourse");
  });

  it("fires the drum circle 20 days after the player ignored the water, if discourse is still 40+", () => {
    const s = withWaterEvent();
    applyCommands(s, [choose(s, 2)], createRng(1));
    s.day = 70 + 19;
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull();
    s.day = 70 + 20;
    s.waterDiscourse = 39;
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull();
    s.waterDiscourse = 41;
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("drumCircle");
    applyCommands(s, [choose(s, 0)], createRng(1));
    expect(s.flags.ignoredWater).toBeUndefined();
    expect(s.waterDiscourse).toBe(16);
  });

  it("opens at most one event at a time", () => {
    const s = withWaterEvent();
    s.flags.ignoredWater = 0;
    s.waterDiscourse = 90;
    s.day = 200;
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("waterDiscourse");
  });

  it("keeps every event within 1 to 3 choices, each with a hint", () => {
    for (const e of EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(1);
      expect(e.choices.length).toBeLessThanOrEqual(3);
      for (const c of e.choices) expect(c.hint.length).toBeGreaterThan(3);
      expect(eventById(e.id)).toBe(e);
    }
  });

  it("puts the fountain on grass beside the gate, never on a path or a building", () => {
    const s = withWaterEvent();
    applyCommands(s, [choose(s, 1)], createRng(1));
    for (const f of s.buildings.filter((b) => b.kind === "fountain")) {
      expect(s.grid.paths[f.z * s.grid.w + f.x]).toBe(false);
    }
  });
});

describe("fountain", () => {
  it("refreshes a passing researcher by 0.1, once per pass", () => {
    const s = withWaterEvent();
    applyCommands(s, [choose(s, 1)], createRng(1));
    const f = s.buildings.find((b) => b.kind === "fountain")!;
    const r = s.walkers.find((w) => w.kind === "researcher")!;
    s.walkers = [r];
    Object.assign(r, { x: f.x + 0.5, z: f.z - 0.4, px: f.x + 0.5, pz: f.z - 0.4, energy: 0.5, route: [], targetId: -1, timer: 999, fountain: 0 });
    r.machine = { value: "wandering", context: {} };
    tick(s);
    expect(r.energy).toBeCloseTo(0.5 - 0.0025 + 0.1);
    tick(s);
    expect(r.energy).toBeCloseTo(0.5 - 0.005 + 0.1); // no second helping while standing there
  });

  it("is scenery: walkers never try to visit it", () => {
    const s = withWaterEvent();
    applyCommands(s, [choose(s, 1)], createRng(1));
    const f = s.buildings.find((b) => b.kind === "fountain")!;
    run(s, 15);
    expect(s.walkers.filter((w) => w.machine.value === "inside" && w.targetId === f.id)).toHaveLength(0);
  });
});

describe("determinism with events", () => {
  it("replays identically, event answers included", () => {
    const answer = (s: GameState): Command[] => (openEventOf(s) ? [choose(s, s.tick % 3)] : []);
    const play = () => {
      const s = createInitialState(9);
      s.waterDiscourse = 34;
      s.day = 60;
      tick(s, [{ type: "placeBuilding", kind: "gateway", x: 7, z: 17 }]);
      for (let i = 0; i < 3000; i++) tick(s, i % 7 === 0 ? answer(s) : []);
      return s;
    };
    const a = play();
    expect(a.arcs.waterDiscourse!.context.openedDay).toBeDefined();
    expect(play()).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe("content sanity", () => {
  it("has 10+ protest headlines and 8+ protest thoughts", async () => {
    const { HEADLINES } = await import("../content/headlines");
    const { THOUGHTS } = await import("../content/thoughts");
    expect(HEADLINES.filter((h) => h.trigger === "protest").length).toBeGreaterThanOrEqual(10);
    const protestThoughts = THOUGHTS.filter((t) => t.when === "protest" || t.when === "discourse");
    expect(protestThoughts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(protestThoughts.map((t) => t.kind))).toEqual(new Set(["researcher", "agent", "visitor", "protester"]));
  });

  it("sizes the visitor cap for a busier campus", () => {
    const s = createInitialState(1);
    expect(visitorCap(s)).toBe(Math.round(20 + s.vibes.value * 0.08));
  });
});
