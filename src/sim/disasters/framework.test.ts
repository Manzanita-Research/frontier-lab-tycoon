// The disaster framework: the pack is valid, every statechart can be walked from start to end (xstate/graph), the
// vocabulary refuses typos with a JSON path, and each generic verb does what its doc says.
import { getAdjacencyMap } from "xstate/graph";
import docs from "../../../docs/DISASTERS.md?raw";
import { BUILDINGS } from "../../content/buildings";
import { eventById } from "../../content/events";
import { canPlace, placeBuilding } from "../commands";
import { refreshBoard } from "../race/arena";
import { ranksOf } from "../race/state";
import { createRng } from "../rng";
import { createTestCampus as createInitialState } from "../testkit";
import { perfBudget, createTestCampus, layPaths, readyForPressure } from "../testkit";
import { applyNow, tick } from "../tick";
import { GUARDS, GUARD_NAMES, STATS, STAT_NAMES, VERBS, VERB_NAMES, checkCall, runVerb, statsIn, vocabulary, type VerbEnv } from "../verbs";
import type { GameState } from "../types";
import { machineOf, startStored } from "./compile";
import { cardEvents, DISASTERS, PACKS } from "./pack";
import { auditorOdds, canTrigger, computeFactor, createDisasters, disasterMenu, revenueEffect, triggerDisaster, updateDisasters, upkeepFactor } from "./driver";
import type { Call, DisasterDef, DisasterPack, TransitionDef } from "./types";
import { validateDisaster, validatePack } from "./validate";

const asList = (t: TransitionDef | TransitionDef[] | undefined): TransitionDef[] => (t === undefined ? [] : Array.isArray(t) ? t : [t]);

function statsOfDef(def: DisasterDef): string[] {
  const set = new Set<string>();
  for (const node of Object.values(def.states)) for (const beat of ["TICK", "CHOSE"] as const) for (const t of asList(node.on?.[beat])) statsIn(t.guard, set);
  return [...set];
}

/** Every event the explorer should try on a disaster: late and early ticks, both dice, work and none, each stat low and high, each card choice. */
function samples(def: DisasterDef) {
  const names = statsOfDef(def);
  const combos: Record<string, number>[] = [{}];
  for (const n of names) for (const c of combos.splice(0)) combos.push({ ...c, [n]: 0 }, { ...c, [n]: 1000 });
  const events: unknown[] = [];
  // Ticks grow by a hundredfold, so each state, entered at some tick, finds a later one that satisfies its timers.
  for (const tick of [0, 100, 10_000, 1_000_000, 1_000_000_000]) for (const roll of [0.01, 0.99]) for (const work of [0, 1000]) for (const stats of combos) events.push({ type: "TICK", tick, day: tick / 20, roll, work, stats });
  const keys = (def.cards ?? []).flatMap((c) => c.choices.map((ch) => ch.key));
  for (const choice of keys) events.push({ type: "CHOSE", tick: 10_000, day: 500, roll: 0.5, work: 0, stats: {}, choice });
  return events;
}

function explore(def: DisasterDef) {
  const machine = machineOf(def);
  const input = startStored(def, 0, 0).context;
  const byValue = { serializeState: (s: { value: unknown }) => JSON.stringify(s.value) };
  const map = getAdjacencyMap(machine as never, { ...byValue, input, events: samples(def), limit: 50_000 } as never) as unknown as Record<string, { state: { value: string }; transitions: Record<string, { state: { value: string } }> }>;
  const nodes = Object.values(map);
  const reached = nodes.map((n) => n.state.value);
  const deadEnds = nodes.filter((n) => def.states[n.state.value]?.type !== "final").filter((n) => Object.values(n.transitions).every((t) => t.state.value === n.state.value)).map((n) => n.state.value);
  return { reached, deadEnds, unreachable: Object.keys(def.states).filter((s) => !reached.includes(s)) };
}

describe("the base pack", () => {
  it("passes its own validator, and ships the first wave and two of the second", () => {
    expect(PACKS.flatMap((p) => validatePack(p))).toEqual([]);
    expect(DISASTERS.map((d) => d.id)).toEqual(["rogueSwarm", "gpuFire", "weightsLeak", "viralJailbreak", "gridBrownout"]);
  });

  for (const def of DISASTERS) {
    it(`${def.id}: every state is reachable, and only the final state is a dead end`, () => {
      const r = explore(def);
      expect(r.unreachable, "unreachable").toEqual([]);
      expect(r.deadEnds, "dead ends").toEqual([]);
      expect(Object.entries(def.states).filter(([, n]) => n.type === "final").map(([k]) => k)).toEqual(["done"]);
    });

    it(`${def.id}: goes warning -> active -> ... -> aftermath -> done`, () => {
      const names = Object.keys(def.states);
      for (const phase of ["warning", "active", "aftermath", "done"]) expect(names, phase).toContain(phase);
      expect(def.initial).toBe("warning");
    });
  }

  it("turns each card into an ordinary event card that waits for its offer flag", () => {
    const cards = cardEvents();
    expect(cards.map((c) => c.id)).toEqual(["dz:rogueSwarm:alert", "dz:weightsLeak:leak", "dz:viralJailbreak:jailbreak"]);
    for (const c of cards) {
      expect(eventById(c.id)).toBeDefined();
      expect(c.choices.length).toBeGreaterThanOrEqual(1);
      expect(c.choices.length).toBeLessThanOrEqual(3);
    }
    const s = createInitialState(1);
    expect(Object.keys(s.arcs)).toContain("dz:weightsLeak:leak");
  });
});

describe("the validator", () => {
  const good = () => structuredClone(DISASTERS[0]!) as DisasterDef;

  it("names the JSON path and a suggestion for a mistyped guard", () => {
    const d = good();
    (d.states.warning!.on!.TICK as TransitionDef[])[0]!.guard = { type: "afterr", params: { hours: 3 } };
    const errors = validateDisaster(d, "content.disasters.add[0]");
    expect(errors).toContain('content.disasters.add[0].states.warning.on.TICK[0].guard: unknown guard "afterr" (did you mean "after"?)');
  });

  it("flags a mistyped verb, a bad parameter and a missing one", () => {
    const d = good();
    d.states.warning!.entry = [{ type: "camera.focuss", params: { on: "gate" } }, { type: "shake", params: { strenght: 1 } }, { type: "news", params: {} }];
    const errors = validateDisaster(d, "p");
    expect(errors).toContain('p.states.warning.entry[0]: unknown action "camera.focuss" (did you mean "camera.focus"?)');
    expect(errors).toContain('p.states.warning.entry[1].params.strenght: unknown parameter (did you mean "strength"?)');
    expect(errors).toContain("p.states.warning.entry[1].params.strength: required (number)");
    expect(errors).toContain("p.states.warning.entry[2].params.text: required (string)");
  });

  it("flags an unknown stat, a missing target and an unreachable state", () => {
    const d = good();
    (d.states.warning!.on!.TICK as TransitionDef[])[0]!.guard = { type: "stat.gte", params: { stat: "sre", value: 1 } };
    d.states.cleanup!.on!.TICK = [{ target: "nowhere" }];
    d.states.island = { on: { TICK: [{ target: "done" }] } };
    const errors = validateDisaster(d, "p");
    expect(errors.some((e) => e.includes('no state "nowhere"'))).toBe(true);
    expect(errors.some((e) => e.includes("p.states.island: unreachable"))).toBe(true);
    const typo = good();
    (typo.states.warning!.on!.TICK as TransitionDef[])[0]!.guard = { type: "stat.gte", params: { stat: "clusterz", value: 1 } };
    expect(validateDisaster(typo, "p")).toContain('p.states.warning.on.TICK[0].guard.params.stat: unknown stat "clusterz" (did you mean "clusters"?)');
  });

  it("flags a disaster that can never end, a card choice nobody offers, and too many choices", () => {
    const d = good();
    d.states.aftermath!.on!.TICK = [{ target: "aftermath" }];
    expect(validateDisaster(d, "p").some((e) => e.includes("no final state is reachable"))).toBe(true);
    const c = good();
    c.cards![0]!.choices.push({ key: "c", label: "c", hint: "", effects: [] }, { key: "d", label: "d", hint: "", effects: [] });
    expect(validateDisaster(c, "p").some((e) => e.includes("one to three choices"))).toBe(true);
    const k = good();
    (k.states.active!.on!.CHOSE as TransitionDef[])[0]!.guard = { type: "choice", params: { is: "yell" } };
    expect(validateDisaster(k, "p").some((e) => e.includes('no card choice with key "yell"'))).toBe(true);
  });

  it("flags a pack of the wrong shape", () => {
    const pack = structuredClone(PACKS[0]!) as DisasterPack;
    pack.apiVersion = 2 as never;
    pack.content.disasters.add.push(structuredClone(pack.content.disasters.add[0]!));
    const errors = validatePack(pack);
    expect(errors).toContain("apiVersion: expected 1");
    expect(errors.some((e) => e.includes('"rogueSwarm" is used twice'))).toBe(true);
  });
});

describe("the vocabulary", () => {
  it("is exactly the names FLT-30's Vocabulary service wants, and every verb of the spec is in it", () => {
    expect(vocabulary.effects).toEqual(VERB_NAMES);
    expect(vocabulary.guards).toEqual(GUARD_NAMES);
    for (const v of ["staff.divert", "compute.drain", "cost.spike", "building.offline", "building.fire", "trust.delta", "heat.delta", "camera.focus", "sound.cue", "shake", "news", "card"]) expect(VERB_NAMES).toContain(v);
    for (const v of ["visitors.arrive", "visitors.leave", "walkers.disguise", "walkers.reveal", "investigate.start"]) expect(VERB_NAMES).toContain(v); // FLT-18/19
    for (const g of Object.values(GUARDS)) expect(g.doc.length).toBeGreaterThan(10);
    for (const v of Object.values(VERBS)) expect(v.doc.length).toBeGreaterThan(10);
  });

  it("is written up: every guard, verb and stat is in docs/DISASTERS.md", () => {
    for (const name of [...GUARD_NAMES, ...VERB_NAMES, ...STAT_NAMES]) expect(docs, name).toContain(name);
  });

  it("reads the lab's stats by name", () => {
    const s = createTestCampus(1);
    const read = Object.fromEntries(STAT_NAMES.map((n) => [n, STATS[n]!(s, null)]));
    expect(read.clusters).toBe(1);
    expect(read.halls).toBe(1);
    expect(read.security).toBe(0);
    expect(read.trust).toBe(50);
    expect(read.heat).toBe(0);
    expect(Object.values(read).every(Number.isFinite)).toBe(true);
  });

  it("checks nested guards and reports where they are", () => {
    const bad: Call = { type: "not", params: { guard: { type: "stat.gte", params: { stat: "nope", value: 1 } } } };
    expect(checkCall(bad, "guard", "g")[0]).toContain("g.params.guard.params.stat: unknown stat");
    expect(checkCall({ type: "any", params: { guards: [{ type: "chance", params: { p: 0.5 } }, "bogus"] } }, "guard", "g")[0]).toContain('g.params.guards[1]: unknown guard "bogus"');
    expect(checkCall({ type: "after", params: {} }, "guard", "g")).toEqual(["g: give `ticks`, `hours` or `days`"]);
  });
});

// ---- verbs -------------------------------------------------------------------------------------------------------

function env(s: GameState, owner: string | null = null): VerbEnv {
  const run = owner
    ? { id: owner, startedDay: s.day, startedTick: s.tick, machine: { value: "warning", context: { id: owner, startedDay: 0, enteredTick: 0, progress: 0, hours: 0 } }, target: 0, fires: [], card: null, diverts: [], vars: {}, forced: true }
    : null;
  return { state: s, rng: createRng(7), run };
}

function crewed(): GameState {
  const s = createInitialState(3);
  s.cash = 50_000_000;
  applyNow(s, [{ type: "hire", job: "security" }, { type: "hire", job: "security" }, { type: "hire", job: "sre" }]);
  for (let i = 0; i < 60; i++) tick(s);
  return s;
}

describe("verbs", () => {
  it("compute.drain, cost.spike, revenue.mult and auditor.odds are timed effects that end", () => {
    const s = createInitialState(1);
    const e = env(s);
    runVerb(e, { type: "compute.drain", params: { pct: 40, days: 2 } });
    runVerb(e, { type: "cost.spike", params: { mult: 3, days: 2, kinds: ["cluster"] } });
    runVerb(e, { type: "revenue.mult", params: { mult: 0, days: 2 } });
    runVerb(e, { type: "auditor.odds", params: { mult: 2, days: 2 } });
    expect(computeFactor(s)).toBeCloseTo(0.6);
    expect(upkeepFactor(s, "cluster")).toBe(3);
    expect(upkeepFactor(s, "kombucha")).toBe(1);
    expect(revenueEffect(s)).toBe(0);
    expect(auditorOdds(s)).toBe(2);
    s.tick += 40;
    expect([computeFactor(s), upkeepFactor(s, "cluster"), revenueEffect(s), auditorOdds(s)]).toEqual([1, 1, 1, 1]);
  });

  it("a disaster's effects end with `effects.end`, all or by kind", () => {
    const s = createInitialState(1);
    const e = env(s, "x");
    runVerb(e, { type: "compute.drain", params: { pct: 50 } });
    runVerb(e, { type: "cost.spike", params: { mult: 2 } });
    expect(s.disasters.effects.map((f) => f.until)).toEqual([-1, -1]);
    runVerb(e, { type: "effects.end", params: { kind: "spike" } });
    expect(s.disasters.effects.map((f) => f.kind)).toEqual(["drain"]);
    runVerb(e, "effects.end");
    expect(s.disasters.effects).toEqual([]);
  });

  it("staff.divert pulls a fraction of a job to a building and holds them there; release lets go", () => {
    const s = crewed();
    const e = env(s, "x");
    runVerb(e, { type: "building.ensure", params: { kind: "security" } });
    const office = s.buildings.find((b) => b.kind === "security")!;
    runVerb(e, { type: "staff.divert", params: { job: "security", to: "$office", fraction: 0.5 } });
    const guards = s.staff.filter((o) => o.job === "security");
    expect(guards.filter((o) => o.divert).length).toBe(1);
    // A new hire of the job is drawn in on the next pass (the driver's enforcement), keeping the share.
    runVerb(e, { type: "staff.divert", params: { job: "security", to: "$office", fraction: 1 } });
    expect(guards.every((o) => o.divert?.to === office.id)).toBe(true);
    expect(s.disasters.effects).toEqual([]);
    for (let i = 0; i < 80; i++) tick(s);
    const arrived = guards.filter((o) => Math.hypot(o.x - (office.x + 1), o.z - (office.z + 1)) < 2.2);
    expect(arrived.length).toBe(2);
    runVerb(e, "staff.release");
    expect(guards.some((o) => o.divert)).toBe(false);
  });

  it("a diverted SRE does not fix a fire; once released, it does", () => {
    const s = crewed();
    const e = env(s, "x");
    const cluster = s.buildings.find((b) => b.kind === "cluster")!;
    runVerb(e, { type: "staff.divert", params: { job: "sre", to: "gate", fraction: 1 } });
    runVerb(e, { type: "building.offline", params: { building: "cluster" } });
    expect(cluster.broken).toBe(true);
    for (let i = 0; i < 60; i++) tick(s);
    expect(cluster.broken).toBe(true);
    runVerb(e, "staff.release");
    for (let i = 0; i < 80; i++) tick(s);
    expect(cluster.broken).toBe(false);
  });

  it("building.fire breaks a building and remembers it; wear caps reliability; ensure places a free Security Office once", () => {
    const s = createTestCampus(3);
    layPaths(s); // the free Security Office arrives beside a path
    s.cash = 1000;
    const cash = s.cash;
    const e = env(s, "x");
    runVerb(e, { type: "building.fire", params: { building: "cluster" } });
    const cluster = s.buildings.find((b) => b.kind === "cluster")!;
    expect(cluster.broken).toBe(true);
    expect(e.run!.fires).toEqual([cluster.id]);
    runVerb(e, { type: "building.wear", params: { building: "cluster", to: 0.3 } });
    expect(cluster.reliability).toBe(0.3);
    runVerb(e, { type: "building.ensure", params: { kind: "security", text: "Trailer." } });
    runVerb(e, { type: "building.ensure", params: { kind: "security" } });
    expect(s.buildings.filter((b) => b.kind === "security").length).toBe(1);
    expect(s.cash).toBe(cash);
    expect(s.flags["free:security"]).toBeUndefined();
    expect(s.toasts.map((t) => t.text)).toContain("Trailer.");
  });

  it("trust, heat and hype clamp at 0 and 100; cash.delta moves the bank", () => {
    const s = createInitialState(1);
    const e = env(s);
    runVerb(e, { type: "trust.delta", params: { amount: 500 } });
    runVerb(e, { type: "heat.delta", params: { amount: -500 } });
    runVerb(e, { type: "hype.delta", params: { amount: -500 } });
    const cash = s.cash;
    runVerb(e, { type: "cash.delta", params: { amount: -1234 } });
    expect([s.disasters.trust, s.disasters.heat, s.hype, s.cash - cash]).toEqual([100, 0, 0, -1234]);
  });

  it("camera.focus, shake and sound.cue leave cues for the renderer, with rising ids", () => {
    const s = createInitialState(1);
    const e = env(s);
    runVerb(e, { type: "camera.focus", params: { on: "gate", zoom: 1.2, hold: 3 } });
    runVerb(e, { type: "camera.focus", params: { on: "cluster" } });
    runVerb(e, { type: "shake", params: { strength: 9 } });
    runVerb(e, { type: "sound.cue", params: { cue: "alarm" } });
    const cues = s.disasters.cues;
    expect(cues.map((c) => c.type)).toEqual(["focus", "focus", "shake", "sound"]);
    expect(cues[0]).toMatchObject({ x: s.gate.x + s.gate.w / 2, z: s.gate.z + 0.5, zoom: 1.2, hold: 3 });
    expect(cues[2]).toMatchObject({ strength: 1 });
    expect(cues[3]).toMatchObject({ cue: "breakdown" });
    expect(new Set(cues.map((c) => c.id)).size).toBe(4);
    for (let i = 0; i < 20; i++) runVerb(e, { type: "shake", params: { strength: 0.1 } });
    expect(s.disasters.cues.length).toBe(12);
  });

  it("news and toast fill {lab}, {model} and {target}", () => {
    const s = createInitialState(1);
    const e = env(s, "x");
    e.run!.target = s.buildings.find((b) => b.kind === "cluster")!.id;
    runVerb(e, { type: "news", params: { text: "{lab} lost its {target} to {model}", tone: "bad" } });
    runVerb(e, { type: "toast", params: { text: "{target}!" } });
    expect(s.news.at(-1)!.text).toBe(`${s.labName} lost its ${BUILDINGS.cluster.name} to ${s.training.context.name}`);
    expect(s.toasts.at(-1)!.text).toBe("Compute Cluster!");
  });

  it("rival.leap lifts the most open lab to just under you, opens its weights, and never drags it down", () => {
    const s = createInitialState(1);
    s.capability = 60;
    refreshBoard(s);
    const before = ranksOf(s.race.board).sirocco!;
    const e = env(s, "x");
    runVerb(e, { type: "rival.leap", params: { relative: -0.1, open: true } });
    const sirocco = s.race.rivals.find((r) => r.context.id === "sirocco")!;
    expect(sirocco.context.capability).toBeCloseTo(54);
    expect(sirocco.context.open).toBe(true);
    expect(e.run!.vars.leapRival).toBe("Sirocco");
    expect(e.run!.vars.leapRivalId).toBe("sirocco");
    // The Arena shows the jump now, not at the weekly re-rank (FLT-32).
    expect(ranksOf(s.race.board).sirocco).toBeLessThan(before);
    s.capability = 10;
    runVerb(e, { type: "rival.leap", params: { relative: -0.1 } });
    expect(s.race.rivals.find((r) => r.context.id === "sirocco")!.context.capability).toBeCloseTo(54);
  });

  it("card sets the offer flag and opens the card at once when the screen is free", () => {
    const s = createTestCampus(1);
    readyForPressure(s); // cards wait for a first launch and a gateway (FLT-16)
    const e = env(s, "weightsLeak");
    runVerb(e, { type: "card", params: { id: "leak" } });
    expect(e.run!.card).toBe("dz:weightsLeak:leak");
    expect(s.arcs["dz:weightsLeak:leak"]!.value).toBe("cardOpen");
  });
});

describe("cost", () => {
  it("costs nothing with no disaster running, and well under the tick budget with three", () => {
    const s = crewed();
    let best = Infinity;
    for (let b = 0; b < 5; b++) {
      const t0 = performance.now();
      for (let i = 0; i < 400; i++) updateDisasters(s);
      best = Math.min(best, (performance.now() - t0) / 400);
    }
    expect(best).toBeLessThan(0.005);
    for (const id of ["rogueSwarm", "gpuFire", "weightsLeak"]) expect(triggerDisaster(s, id).ok).toBe(true);
    for (let i = 0; i < 12; i++) tick(s, [{ type: "chooseEvent", eventId: "dz:rogueSwarm:alert", choiceIndex: 0 }, { type: "chooseEvent", eventId: "dz:weightsLeak:leak", choiceIndex: 0 }]);
    expect(s.disasters.runs.length).toBe(3);
    best = Infinity;
    for (let b = 0; b < 5; b++) {
      const t0 = performance.now();
      for (let i = 0; i < 300; i++) {
        s.tick++; // the disasters advance one beat per tick; hold the World still around them
        updateDisasters(s);
      }
      best = Math.min(best, (performance.now() - t0) / 300);
    }
    expect(best).toBeLessThan(perfBudget(0.15));
  });
});

describe("triggering", () => {
  it("refuses what cannot happen, with a reason for the menu", () => {
    const s = createInitialState(1);
    s.buildings = s.buildings.filter((b) => b.kind !== "cluster");
    expect(canTrigger(s, "gpuFire")).toEqual({ ok: false, reason: "No working Compute Cluster to set on fire. Build one, then we can talk." });
    expect(canTrigger(s, "nonsense")).toEqual({ ok: false, reason: "No such disaster: nonsense" });
    const menu = disasterMenu(s);
    expect(menu.map((m) => m.id)).toEqual(["rogueSwarm", "gpuFire", "weightsLeak", "viralJailbreak", "gridBrownout"]);
    expect(menu.find((m) => m.id === "gpuFire")).toMatchObject({ available: false, active: false });
    expect(menu.find((m) => m.id === "rogueSwarm")).toMatchObject({ available: true, active: false, blurb: "An agent swarm is loose on the internet, and it's wearing your API key." });
  });

  it("refuses a second copy of one already under way; the `disaster` command toasts the refusal", () => {
    const s = createInitialState(1);
    applyNow(s, [{ type: "disaster", id: "weightsLeak" }]);
    expect(s.disasters.runs.map((r) => r.id)).toEqual(["weightsLeak"]);
    expect(disasterMenu(s).find((m) => m.id === "weightsLeak")).toMatchObject({ active: true, available: false });
    applyNow(s, [{ type: "disaster", id: "weightsLeak" }, { type: "disaster", id: "nonsense" }]);
    expect(s.disasters.runs.length).toBe(1);
    expect(s.toasts.map((t) => t.text)).toContain("Weights Leak is already under way.");
    expect(s.toasts.map((t) => t.text)).toContain("No such disaster: nonsense");
  });

  it("the setRisk command sets the random-disaster setting, and ignores nonsense", () => {
    const s = createInitialState(1);
    expect(s.disasters).toEqual(createDisasters(1));
    applyNow(s, [{ type: "setRisk", risk: "chaos" }]);
    expect(s.disasters.risk).toBe("chaos");
    applyNow(s, [{ type: "setRisk", risk: "apocalypse" as never }]);
    expect(s.disasters.risk).toBe("chaos");
  });

  it("puts the Security Office where the palette is not (it is placeable by command)", () => {
    const s = createInitialState(3);
    s.cash = 10_000_000;
    let spot: [number, number] | null = null;
    for (let z = 8; z <= 21 && !spot; z++) for (let x = 3; x <= 20 && !spot; x++) if (canPlace(s, "security", x, z).ok) spot = [x, z];
    expect(spot).not.toBeNull();
    placeBuilding(s, createRng(1), "security", spot![0], spot![1]);
    expect(s.buildings.some((b) => b.kind === "security")).toBe(true);
    expect(BUILDINGS.security.office).toBe(true);
  });
});
