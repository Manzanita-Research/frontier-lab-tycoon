// FLT-33 (factions) and FLT-25 (the Water Discourse escalation): the machines, the stance, the headless year under
// three stances, the two crowds at the gate, and the toggles.
import type { AnyStateMachine } from "xstate";
import { getAdjacencyMap } from "xstate/graph";
import { BASE_ARCS, FACTIONS } from "../../content/factions";
import { initialStored, step } from "../machines/run";
import { answer, createTestCampus, perfBudget, readyForPressure } from "../testkit";
import { TICKS_PER_DAY, tick } from "../tick";
import { hire } from "../staff";
import { protesterTarget } from "../protest";
import { enablePapers } from "../race/papers/driver";
import { enableLeapfrog } from "../race/leapfrog/driver";
import type { GameState } from "../types";
import { validateArc } from "../../mods/validation";
import { baseVocabulary } from "../../mods/base-game";
import { defs } from "../defs";
import { factionMoodMachine, quietMoodDay, quietRelationDay, relationMachine, type FactionMoodStored } from "./machines";
import { enableFactions, meterOf, nudgeRelation, relationStateOf } from "./state";
import { dailyFactions, setSafetySpend, settleFactions } from "./driver";
import { safetyDrag } from "./stance";
import { stageFactions, type FactionMoment } from "./demo";
import { factionsView } from "./view";
import { issueStatement, STATEMENT } from "./statement";
import { CLOSED_CAREFUL, COMPROMISE, OPEN_FAST, runFactions, factionsTable, type FactionsReport } from "./headless";

// Pinned v6 graph typing does not model emitted events; same adapter as machines/graph.test.ts.
function graph(machine: AnyStateMachine, options: Record<string, unknown>) {
  return getAdjacencyMap(machine as never, options as never) as unknown as Record<string, { state: { value: string } }>;
}

describe("faction machines", () => {
  it("xstate/graph reaches every mood and every relation", () => {
    const days = [-100, -70, -45, 0, 60].map((meter) => ({ type: "DAY", meter, day: 1, march: -60 }));
    const moods = graph(factionMoodMachine, { input: { meter: 0, since: -1 }, events: [...days, { type: "RELEASE" }], serializeState: (s: { value: unknown; context: { meter: number } }) => `${String(s.value)}:${s.context.meter}` });
    expect(new Set(Object.values(moods).map((n) => n.state.value))).toEqual(new Set(["calm", "fan", "upset", "protesting"]));
    const rel = graph(relationMachine, { input: { value: 0, wasAllied: false }, events: [-80, 0, 80].map((value) => ({ type: "DAY", value })), serializeState: (s: { value: unknown; context: { wasAllied: boolean } }) => `${String(s.value)}:${s.context.wasAllied}` });
    expect(new Set(Object.values(rel).map((n) => n.state.value))).toEqual(new Set(["cordial", "allied", "feuding"]));
  });

  it("moods have hysteresis, and a faction with no march line never protests on its own", () => {
    let m = initialStored(factionMoodMachine, { meter: 0, since: -1 });
    const day = (meter: number, march: number | null = -60) => (m = step(factionMoodMachine, m, { type: "DAY", meter, day: 1, march }).stored);
    day(-45);
    expect(m.value).toBe("upset");
    day(-30); // above −40 but below −25: still upset
    expect(m.value).toBe("upset");
    day(-65);
    expect(m.value).toBe("protesting");
    day(-50); // not 20 above the line yet
    expect(m.value).toBe("protesting");
    day(-35);
    expect(m.value).toBe("upset");
    day(-100, null);
    expect(m.value).toBe("upset");
    const hype = step(factionMoodMachine, step(factionMoodMachine, m, { type: "DAY", meter: 80, day: 2, march: null }).stored, { type: "DAY", meter: 80, day: 3, march: null });
    expect(step(factionMoodMachine, hype.stored, { type: "RELEASE" }).effects).toEqual([{ type: "HYPE" }]);
  });

  it("an alliance that falls out is a schism; a pair that was never allied is only a feud", () => {
    let r = initialStored(relationMachine, { value: 0, wasAllied: false });
    const day = (value: number) => {
      const out = step(relationMachine, r, { type: "DAY", value });
      r = out.stored;
      return out.effects.map((e) => e.type);
    };
    expect(day(-60)).toEqual(["FEUD"]);
    expect(day(0)).toEqual(["COOLED"]);
    expect(day(60)).toEqual(["ALLIED"]);
    expect(day(20)).toEqual(["COOLED"]); // drifted apart, and remembers the alliance
    expect(day(-60)).toEqual(["SCHISM"]);
  });
});

describe("factions in the World", () => {
  const campus = () => {
    const s = createTestCampus(7);
    enableLeapfrog(s);
    enablePapers(s);
    enableFactions(s);
    return s;
  };

  it("starts with a mood per faction, a relation per pair, and nothing without enableFactions", () => {
    expect(createTestCampus(7).factions).toBeUndefined();
    const s = campus();
    expect(Object.keys(s.factions!.moods).sort()).toEqual(FACTIONS.map((f) => f.id).sort());
    expect(Object.keys(s.factions!.relations)).toHaveLength((FACTIONS.length * (FACTIONS.length - 1)) / 2);
    const off = createTestCampus(7);
    off.flags.factionsOff = 1;
    enableFactions(off);
    expect(off.factions).toBeUndefined();
  });

  it("the safety budget costs money every day and slows training; none is exactly the old speed", () => {
    const s = campus();
    expect(safetyDrag(s)).toBe(1);
    setSafetySpend(s, 3);
    const cash = s.cash;
    dailyFactions(s);
    expect(s.cash).toBe(cash - 20_000);
    expect(safetyDrag(s)).toBeCloseTo(0.8);
    expect(s.factions!.signals.safetyUp).toBe(s.day);
  });

  it("settleFactions starts every meter where the stance puts it, without a single headline", () => {
    const s = campus();
    const news = s.news.length;
    s.factions!.pace = 3;
    settleFactions(s);
    expect(meterOf(s, "accelerationists")).toBeGreaterThan(20);
    expect(meterOf(s, "doomers")).toBeLessThan(-20);
    expect(s.news.length).toBe(news);
  });

  it("a card's relation effect can split an alliance (the Pause Letter)", () => {
    const s = campus();
    nudgeRelation(s, "doomers", "safetyists", 40);
    dailyFactions(s);
    expect(relationStateOf(s, "doomers", "safetyists")).toBe("allied");
    nudgeRelation(s, "doomers", "safetyists", -150);
    dailyFactions(s);
    expect(relationStateOf(s, "doomers", "safetyists")).toBe("feuding");
    expect(s.factions!.counts.schisms).toBe(1);
    expect(s.news.some((n) => /Doomers|Safetyists|Pause|pause/.test(n.text))).toBe(true);
  });
});

describe("a headless year of the discourse", () => {
  const reports = new Map<string, FactionsReport>();
  const run = (name: string) => reports.get(name)!;
  beforeAll(() => {
    for (const st of [OPEN_FAST, CLOSED_CAREFUL, COMPROMISE]) reports.set(st.name, runFactions(1, st));
  }, 300_000);
  const meter = (r: FactionsReport, id: string) => r.factions.find((f) => f.id === id)!.meter;

  it("meters respond to the stance: open + fast pleases the Accelerationists and the open-weights crowd, closed + careful the Doomers", () => {
    const fast = run("open + fast");
    const careful = run("closed + careful");
    expect(meter(fast, "accelerationists")).toBeGreaterThan(50);
    expect(meter(careful, "accelerationists")).toBeLessThan(0);
    expect(meter(fast, "open-weights")).toBeGreaterThan(meter(careful, "open-weights") + 50);
    expect(meter(careful, "doomers")).toBeGreaterThan(meter(fast, "doomers") + 50);
    expect(meter(careful, "safetyists")).toBeGreaterThan(meter(fast, "safetyists"));
    expect(meter(fast, "vcs")).toBeGreaterThan(meter(careful, "vcs"));
    // Shipping fast makes fans hype and the angry boycott; careful barely registers.
    expect(fast.counts.hype).toBeGreaterThan(careful.counts.hype);
    expect(fast.counts.boycotts).toBeGreaterThan(careful.counts.boycotts);
  });

  it("an alliance and a schism each happen; the paths argue and the factions march", () => {
    const all = [...reports.values()];
    expect(all.some((r) => r.firstAlliance !== null)).toBe(true);
    expect(run("open + fast").firstSchism).not.toBeNull();
    for (const r of all) {
      expect(r.counts.arguments).toBeGreaterThan(50);
      expect(r.counts.opEds).toBeGreaterThan(0);
    }
    expect(run("open + fast").counts.marches).toBeGreaterThan(run("compromise").counts.marches);
  });

  it("FLT-25: drum circle, documentary crew, then the Water Truthers Truthers, with two crowds shouting at the gate", () => {
    for (const r of reports.values()) {
      expect(r.water.slice(0, 6)).toEqual(["quiet", "simmering", "filming", "aired", "counter", "resolved"]);
      expect(r.cards.documentary).toBeGreaterThan(0);
      expect(r.cards.truthers).toBeGreaterThan(0);
      expect(r.twoCrowdDays).toBeGreaterThan(0);
      expect(r.counts.shouts).toBeGreaterThan(0);
      expect(r.maxCrowd).toBeGreaterThan(0);
    }
  });

  it("writes the sim report for the PR with FACTIONS_REPORT=1 (docs/evidence/flt-33/report.md)", async () => {
    const all = [...reports.values()];
    const s = createTestCampus(3);
    enableLeapfrog(s);
    enableFactions(s);
    s.factions!.pace = 3;
    settleFactions(s);
    const t0 = performance.now();
    for (let d = 0; d < 365; d++) {
      s.day++;
      dailyFactions(s);
    }
    const dailyMs = (performance.now() - t0) / 365;
    expect(dailyMs).toBeLessThan(perfBudget(0.5));
    const lines = [
      "# FLT-33/25 sim report", "",
      "`FACTIONS_REPORT=1 pnpm vitest run src/sim/factions/factions.test.ts`. Seed 1, 365 days, the Release Leapfrog bot building and hiring, three stances (src/sim/factions/headless.ts). Meters are −100..100; the mood is the one on the last day.", "",
      factionsTable(all), "",
      ...all.map((r) => `- **${r.strategy}**: first alliance ${r.firstAlliance ? `day ${r.firstAlliance.day} (${r.firstAlliance.pair})` : "none"}; first schism ${r.firstSchism ? `day ${r.firstSchism.day} (${r.firstSchism.pair})` : "none"}; water escalation ${r.water.join(" → ")}.`),
      "", "## The discourse log, open + fast (last dozen)", "", ...run("open + fast").log.map((l) => `- ${l}`),
      "", "## Cost", "", `- \`dailyFactions\` (stance, ten moods, 45 relations, op-eds): **${(dailyMs * 1000).toFixed(0)} µs** a game day, once every 20 ticks.`, "",
    ];
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (env?.FACTIONS_REPORT) {
      const fs = (await import(/* @vite-ignore */ ("node:fs" as string))) as { mkdirSync: (p: string, o: object) => void; writeFileSync: (p: string, t: string) => void };
      fs.mkdirSync("docs/evidence/flt-33", { recursive: true });
      fs.writeFileSync("docs/evidence/flt-33/report.md", lines.join("\n") + "\n");
    }
  });

  it("is deterministic, and a save mid-year (JSON) plays on exactly like the run it came from", () => {
    const again = runFactions(1, OPEN_FAST, 120);
    expect(JSON.stringify(again.world)).toBe(JSON.stringify(runFactions(1, OPEN_FAST, 120).world));
    const s = createTestCampus(5);
    enableLeapfrog(s);
    enableFactions(s);
    readyForPressure(s);
    s.waterDiscourse = 120;
    for (let i = 0; i < 60 * TICKS_PER_DAY; i++) tick(s, answer(s, 1));
    const saved: GameState = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 60 * TICKS_PER_DAY; i++) {
      tick(s, answer(s, 1));
      tick(saved, answer(saved, 1));
    }
    expect(s.factions!.counts.arguments).toBeGreaterThan(0);
    expect(JSON.stringify(saved)).toBe(JSON.stringify(s));
  }, 120_000);
});

describe("FLT-25: the Water Discourse escalation", () => {
  it("the base arcs use only the Vocabulary, name real cards and reach every state", () => {
    const cards = defs().events.map((e) => e.id);
    for (const arc of BASE_ARCS) expect(() => validateArc(arc, baseVocabulary, arc.id, cards)).not.toThrow();
  });

  /** A lab whose gate is already loud, played until the counter-protest is on; cards get the first answer. */
  function toCounter(seed: number, extra?: (s: GameState) => void): GameState {
    const s = createTestCampus(seed);
    enableLeapfrog(s);
    enableFactions(s);
    extra?.(s);
    readyForPressure(s);
    s.waterDiscourse = 150;
    for (let i = 0; i < 200 * TICKS_PER_DAY && s.modArcs?.["water-escalation"]?.value !== "counter"; i++) {
      s.waterDiscourse = Math.max(s.waterDiscourse, 90);
      tick(s, answer(s));
    }
    return s;
  }

  it("the counter-crowd scales with the discourse, and Comms calm both crowds down", () => {
    const s = toCounter(3);
    expect(s.modArcs!["water-escalation"]!.value).toBe("counter");
    expect(s.rallies?.[0]?.faction).toBe("truthers-truthers");
    const counter = (w: GameState) => w.walkers.filter((x) => x.crowd === "truthers-truthers" && x.machine.value !== "leaving").length;
    for (let i = 0; i < 2 * TICKS_PER_DAY; i++) tick(s, answer(s));
    const loud = counter(s);
    expect(loud).toBeGreaterThan(2);
    expect(protesterTarget(s)).toBeGreaterThan(10);
    // Same World, two futures: one hires four Comms Reps, one does not.
    const calm = structuredClone(s);
    for (let i = 0; i < 4; i++) hire(calm, "comms");
    for (let i = 0; i < 20 * TICKS_PER_DAY; i++) {
      tick(s, answer(s));
      tick(calm, answer(calm));
    }
    expect(calm.waterDiscourse).toBeLessThan(s.waterDiscourse);
    const gate = (w: GameState) => w.walkers.filter((x) => x.kind === "protester").length;
    expect(gate(calm)).toBeLessThan(gate(s));
  }, 120_000);

  it("runs without the factions (standalone), and ?water=off switches the escalation off", () => {
    const alone = toCounter(3, (s) => {
      s.flags.factionsOff = 1;
      delete s.factions;
    });
    expect(alone.factions).toBeUndefined();
    expect(alone.modArcs!["water-escalation"]!.value).toBe("counter");
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(alone, answer(alone));
    expect(alone.walkers.some((w) => w.crowd === "truthers-truthers")).toBe(true);
    const off = createTestCampus(3);
    off.flags["arcOff:water-escalation"] = 1;
    off.waterDiscourse = 150;
    for (let i = 0; i < 60 * TICKS_PER_DAY; i++) tick(off, answer(off));
    expect(off.modArcs?.["water-escalation"]).toBeUndefined();
    expect(off.walkers.some((w) => w.kind === "protester")).toBe(true);
  }, 120_000);
});

describe("quiet days", () => {
  it("skipping transition() on a quiet day gives exactly what the machine would have", () => {
    const meters = [-100, -80, -70, -61, -60, -55, -41, -40, -39, -30, -25, -24, 0, 29, 30, 31, 49, 50, 51, 100];
    const moods = new Map<string, FactionMoodStored>();
    for (const a of meters) for (const b of meters) for (const march of [-60, null]) {
      const s1 = step(factionMoodMachine, initialStored(factionMoodMachine, { meter: 0, since: -1 }), { type: "DAY", meter: a, day: 1, march }).stored;
      const s2 = step(factionMoodMachine, s1, { type: "DAY", meter: b, day: 2, march }).stored;
      moods.set(`${s2.value}:${a}:${b}:${march}`, s2);
    }
    let checked = 0;
    for (const stored of moods.values()) for (const meter of meters) for (const march of [-60, null]) {
      const quiet = quietMoodDay(stored, meter, march);
      const full = step(factionMoodMachine, stored, { type: "DAY", meter, day: 9, march });
      if (quiet) {
        checked++;
        expect(full.effects).toEqual([]);
        expect(quiet).toEqual(full.stored);
      } else expect(full.effects.length).toBeGreaterThan(0);
    }
    expect(checked).toBeGreaterThan(100);
    const values = [-100, -56, -55, -54, -36, -35, -34, 0, 34, 35, 36, 54, 55, 56, 100];
    for (const start of values) for (const wasAllied of [false, true]) {
      const stored = step(relationMachine, initialStored(relationMachine, { value: 0, wasAllied }), { type: "DAY", value: start }).stored;
      const primed = { ...stored, context: { ...stored.context, wasAllied: stored.context.wasAllied || wasAllied } };
      for (const value of values) {
        const quiet = quietRelationDay(primed, value);
        const full = step(relationMachine, primed, { type: "DAY", value });
        if (quiet) {
          expect(full.effects).toEqual([]);
          expect(quiet).toEqual(full.stored);
        } else expect(full.effects.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("debug moments (?moment=factions|counterprotest|argue)", () => {
  const staged = (moment: FactionMoment, seed = 3) => {
    const s = createTestCampus(seed);
    for (let i = 0; i < 12 * TICKS_PER_DAY; i++) tick(s, answer(s));
    stageFactions(s, moment);
    return s;
  };

  it("stages an alliance, a schism, fans and a march, the same way every time", () => {
    const s = staged("factions");
    expect(relationStateOf(s, "accelerationists", "open-weights")).toBe("allied");
    expect(relationStateOf(s, "doomers", "safetyists")).toBe("feuding");
    expect(s.factions!.log.some((l) => l.text.startsWith("Schism"))).toBe(true);
    const v = factionsView(s);
    expect(v.rows.some((r) => r.mood === "fan")).toBe(true);
    expect(v.relations.find((r) => r.schism)).toBeDefined();
    expect(JSON.stringify(staged("factions"))).toBe(JSON.stringify(s));
  });

  it("puts two crowds at the gate for the counter-protest, and the arc where it would be", () => {
    const s = staged("counterprotest");
    expect(s.modArcs?.["water-escalation"]?.value).toBe("counter");
    const gate = factionsView(s).gate;
    expect(gate.find((g) => g.id === "")?.count).toBeGreaterThan(0);
    expect(gate.find((g) => g.id === "truthers-truthers")?.count).toBeGreaterThan(0);
  });

  it("starts an argument on a path: two bubbles, one the reply", () => {
    const s = staged("argue");
    const pair = s.thoughts.filter((t) => t.faction && t.expiresTick > s.tick);
    expect(pair.map((t) => t.faction)).toEqual(["accelerationists", "doomers"]);
    expect(pair[1]!.replyTo).toBe(pair[0]!.walkerId);
  });
});

describe("the Comms statement (FLT-56)", () => {
  const discourse = (seed = 3) => {
    const s = createTestCampus(seed);
    for (let i = 0; i < 12 * TICKS_PER_DAY; i++) tick(s, answer(s));
    stageFactions(s, "factions");
    s.cash = 200_000;
    return s;
  };

  it("calms the faction addressed, snubs its feuds, costs money, makes the news and plays a beat at the gate", () => {
    const s = discourse();
    const doom = meterOf(s, "doomers");
    const safety = meterOf(s, "safetyists");
    const cash = s.cash;
    const news = s.news.length;
    expect(issueStatement(s, "doomers")).toBe(true);
    expect(s.cash).toBe(cash - STATEMENT.cost);
    // No Comms Rep: the intern writes it, and it lands softer.
    expect(meterOf(s, "doomers")).toBeCloseTo(Math.min(100, doom + STATEMENT.calmUnstaffed));
    expect(meterOf(s, "safetyists")).toBeCloseTo(Math.max(-100, safety - STATEMENT.backlash));
    expect(s.news.length).toBeGreaterThanOrEqual(news + 2);
    expect(s.news.some((n) => n.text.includes("addresses the Doomers in"))).toBe(true);
    const beat = s.disasters.cues.find((c) => c.type === "beat");
    expect(beat).toMatchObject({ beat: "statement", caption: expect.stringContaining("Doomers") });
    expect((beat as { sub: string }).sub).toMatch(/^".+"$/);
    expect(s.toasts.at(-1)!.text).toContain("intern");
  });

  it("waits out its cooldown, refuses when broke, and lands harder with a Comms Rep", () => {
    const s = discourse();
    issueStatement(s, "doomers");
    const cash = s.cash;
    expect(issueStatement(s, "doomers")).toBe(false);
    expect(s.cash).toBe(cash);
    expect(factionsView(s).statement.wait).toBe(STATEMENT.cooldownDays);
    const t = discourse();
    t.cash = STATEMENT.cost - 1;
    expect(issueStatement(t, "doomers")).toBe(false);
    const u = discourse();
    hire(u, "comms");
    expect(u.staff.some((st) => st.job === "comms")).toBe(true);
    const before = meterOf(u, "doomers");
    issueStatement(u, "doomers");
    expect(meterOf(u, "doomers")).toBeCloseTo(Math.min(100, before + STATEMENT.calm));
    expect(factionsView(u).statement.staffed).toBe(true);
  });

  it("stages three crowds in three colours and the statement beat (?moment=statement), the same way every time", () => {
    const stage = () => {
      const s = createTestCampus(3);
      for (let i = 0; i < 12 * TICKS_PER_DAY; i++) tick(s, answer(s));
      stageFactions(s, "statement");
      return s;
    };
    const s = stage();
    const gate = factionsView(s).gate;
    expect(gate.map((g) => g.id)).toEqual(expect.arrayContaining(["", "truthers-truthers", "doomers"]));
    expect(new Set(gate.map((g) => g.color)).size).toBe(gate.length);
    expect(s.disasters.cues.some((c) => c.type === "beat" && c.beat === "statement")).toBe(true);
    expect(JSON.stringify(stage())).toBe(JSON.stringify(s));
  });
});
