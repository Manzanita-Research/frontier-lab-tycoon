// FLT-8, the Crowd: names, needs, destination choice, queues, quitting, Vibes, demos, thoughts, and the perf budget.
import { BUILDINGS, type BuildingKind } from "../content/buildings";
import { AGENT_NICKNAMES, FIRST_NAMES, LAST_NAMES, RIVAL_SHORT, RIVALS, THEIR, VISITOR_ROLES } from "../content/names";
import { CAUSES, CAUSE_KEYS } from "../content/needThoughts";
import { applyCommands, canPlace } from "./commands";
import { dailyCrowd } from "./crowd";
import { demoOdds, FLOP_SCALE, SHOW_TICKS, showFor } from "./demo";
import { causeOf, thoughtBoard, thoughtOf, walkersThinking } from "./mind";
import { applyServes, happinessOf, moodFor, RIVAL_FOMO, tickNeeds } from "./needs";
import { createRng } from "./rng";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { tick } from "./tick";
import type { GameState, Walker } from "./types";
import { TARGET_WANDER } from "./types";
import { dailyVibes, initialVibes, readVibes, trendOf, visitorCapFor, visitorChanceFor, vibesTarget } from "./vibes";
import { chooseTarget, dailyWalkers, fillAgents, researcherTarget, seedWalkers } from "./walkers";
import { syncProtesters } from "./protest";

const count = (s: GameState, kind: Walker["kind"]) => s.walkers.filter((w) => w.kind === kind).length;
const researchers = (s: GameState) => s.walkers.filter((w) => w.kind === "researcher");

/** Where each new building goes on the starting campus: all beside the cross path along z = 16, clear of the originals. */
const SPOTS: Partial<Record<BuildingKind, [number, number]>> = { nap: [6, 17], snack: [9, 17], demo: [14, 17], hall: [4, 17] };

function campus(...kinds: BuildingKind[]): GameState {
  const s = createInitialState(1);
  s.cash = 100_000_000;
  const cmds = kinds.map((kind) => ({ type: "placeBuilding" as const, kind, x: SPOTS[kind]![0], z: SPOTS[kind]![1] }));
  for (const c of cmds) expect(canPlace(s, c.kind, c.x, c.z), c.kind).toEqual({ ok: true });
  applyCommands(s, cmds, createRng(5));
  return s;
}

/** Everyone gone but `keep`, so a test can stage a scene without the crowd wandering into it. */
function only(s: GameState, ...keep: Walker[]) {
  s.walkers = keep;
}

const buildingOf = (s: GameState, kind: BuildingKind) => s.buildings.find((b) => b.kind === kind)!;

describe("identity", () => {
  it("has 80+ name parts, all distinct, and a joke for every rival", () => {
    expect(FIRST_NAMES.length + LAST_NAMES.length).toBeGreaterThanOrEqual(80);
    expect(new Set(FIRST_NAMES).size).toBe(FIRST_NAMES.length);
    expect(new Set(LAST_NAMES).size).toBe(LAST_NAMES.length);
    expect(RIVAL_SHORT).toHaveLength(RIVALS.length);
    expect(AGENT_NICKNAMES.length).toBeGreaterThan(10);
  });

  it("names every walker in a new game: researchers, agents ('Agent-0042 'Sparky''), visitors with a job", () => {
    const s = createInitialState(3);
    for (const w of s.walkers) {
      expect(w.name.length).toBeGreaterThan(3);
      expect(w.role.length).toBeGreaterThan(3);
      expect(THEIR[w.pro]).toBeDefined();
    }
    for (const w of s.walkers.filter((x) => x.kind === "researcher")) expect(w.name).toMatch(/^(Dr\. )?[A-Z][a-z]+ [A-Z][A-Za-z-]+$/);
    const agents = s.walkers.filter((x) => x.kind === "agent");
    for (const w of agents) expect(w.name).toMatch(/^Agent-\d{4} '.+'$/);
    expect(new Set(agents.map((w) => w.name.slice(0, 10))).size).toBe(agents.length);
    for (const w of s.walkers.filter((x) => x.kind === "visitor")) expect(VISITOR_ROLES as readonly string[]).toContain(w.role);
  });

  it("turns up more investors when the vibes are good", () => {
    const investors = (vibes: number) => {
      const s = createInitialState(9);
      s.vibes.value = vibes;
      const rng = createRng(2);
      s.walkers = [];
      seedWalkers(s, "visitor", 600, rng);
      return s.walkers.filter((w) => w.role === "Venture Capitalist").length;
    };
    expect(investors(950)).toBeGreaterThan(investors(50));
  });
});

describe("needs", () => {
  it("drain over time: researchers lose energy and focus, fomo fades, visitors lose patience, agents drift", () => {
    const s = createInitialState(1);
    const r = researchers(s)[0]!;
    Object.assign(r, { energy: 1, focus: 1, fomo: 0.5 });
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    v.patience = 1;
    const a = s.walkers.find((w) => w.kind === "agent")!;
    a.drift = 0;
    for (let i = 0; i < 100; i++) {
      tickNeeds(r, 10);
      tickNeeds(v, 10);
      tickNeeds(a, 10);
    }
    expect(r.energy).toBeCloseTo(0.75, 5);
    expect(r.focus).toBeCloseTo(0.84, 5);
    expect(r.fomo).toBeCloseTo(0.35, 5);
    expect(v.patience).toBeCloseTo(0.78, 5);
    expect(a.drift).toBeGreaterThan(0.05);
    expect(a.drift).toBeLessThan(0.1);
    for (let i = 0; i < 2000; i++) tickNeeds(r, 10);
    expect([r.energy, r.focus, r.fomo]).toEqual([0, 0, 0]);
  });

  it("wear a visitor's patience down three times as fast in a queue", () => {
    const s = createInitialState(1);
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    v.patience = 1;
    v.machine = { value: "queuing", context: {} };
    tickNeeds(v, 0);
    expect(1 - v.patience).toBeCloseTo(0.0022 * 3, 6);
  });

  it("refill from a stay: a nap restores energy, a Snack Wall focus, the Training Hall calms fomo, and it never overflows", () => {
    const s = createInitialState(1);
    const r = researchers(s)[0]!;
    Object.assign(r, { energy: 0.1, focus: 0.1, fomo: 0.8 });
    applyServes(r, BUILDINGS.nap);
    expect(r.energy).toBeCloseTo(1, 5);
    applyServes(r, BUILDINGS.snack);
    expect(r.focus).toBeCloseTo(0.8, 5);
    applyServes(r, BUILDINGS.hall);
    expect(r.fomo).toBeCloseTo(0.5, 5);
    applyServes(r, BUILDINGS.snack);
    expect(r.focus).toBe(1);
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    v.impressed = 0.2;
    applyServes(v, BUILDINGS.demo);
    expect(v.impressed).toBeCloseTo(0.7, 5);
    applyServes(v, BUILDINGS.demo, FLOP_SCALE);
    expect(v.impressed).toBeCloseTo(0.5, 5);
  });

  it("derives happiness from the needs", () => {
    const s = createInitialState(1);
    const r = researchers(s)[0]!;
    Object.assign(r, { energy: 1, focus: 1, fomo: 0 });
    expect(happinessOf(r)).toBeCloseTo(1, 6);
    Object.assign(r, { energy: 0, focus: 0, fomo: 1 });
    expect(happinessOf(r)).toBe(0);
    Object.assign(r, { energy: 0.5, focus: 1, fomo: 0 });
    expect(happinessOf(r)).toBeCloseTo(0.8, 6);
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    Object.assign(v, { patience: 1, impressed: 0 });
    expect(happinessOf(v)).toBe(0.5);
  });

  it("gives every researcher fomo when a rival ships, and some a call they turn down", () => {
    const s = createInitialState(1);
    for (const r of researchers(s)) r.fomo = 0;
    s.flags.rivalShippedDay = s.day;
    s.flags.rivalIndex = 2;
    dailyCrowd(s, createRng(4));
    for (const r of researchers(s)) expect(r.fomo).toBeCloseTo(RIVAL_FOMO, 6);
    expect(count(s, "researcher")).toBe(11);
    const called = createInitialState(1);
    called.flags.rivalShippedDay = called.day;
    called.flags.rivalIndex = 2;
    seedWalkers(called, "researcher", 200, createRng(6));
    dailyCrowd(called, createRng(4));
    const calls = researchers(called).filter((r) => r.stats.offers > 0);
    expect(calls.length).toBeGreaterThan(5);
    expect(calls.every((r) => RIVAL_SHORT[r.stats.rival] === "MetaMeta")).toBe(true);
  });

  it("does not shock anyone on a day no rival shipped", () => {
    const s = createInitialState(1);
    for (const r of researchers(s)) r.fomo = 0;
    s.flags.rivalShippedDay = s.day - 1;
    dailyCrowd(s, createRng(4));
    expect(researchers(s).every((r) => r.fomo === 0)).toBe(true);
  });
});

describe("destination choice", () => {
  const tired = (s: GameState, x: number, z: number) => {
    const w = researchers(s)[0]!;
    Object.assign(w, { x, z, px: x, pz: z, energy: 0.1, focus: 1, fomo: 0, targetId: TARGET_WANDER, route: [], step: 1 });
    return w;
  };

  it("sends a tired researcher to the Nap Pods, which beat the Kombucha Bar on how much they give", () => {
    const s = campus("nap");
    const w = tired(s, 8.5, 16.5);
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) expect(chooseTarget(s, w, rng)!.kind).toBe("nap");
    expect(w.need).toBe("energy");
    expect(w.lost).toBe("");
  });

  it("weighs distance: of two Kombucha Bars, a tired researcher takes the near one", () => {
    const s = createInitialState(1);
    s.cash = 100_000_000;
    applyCommands(s, [{ type: "placeBuilding", kind: "kombucha", x: 17, z: 17 }], createRng(1));
    const near = s.buildings.find((b) => b.kind === "kombucha" && b.x === 12)!;
    const w = tired(s, 11.5, 20.5);
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) expect(chooseTarget(s, w, rng)!.id).toBe(near.id);
    const far = tired(s, 17.5, 16.5);
    for (let i = 0; i < 20; i++) expect(chooseTarget(s, far, rng)!.x).toBe(17);
  });

  it("scores by the most urgent need: scattered researchers go for the Snack Wall, tired ones for a nap", () => {
    const s = campus("nap", "snack");
    const w = tired(s, 8.5, 16.5);
    Object.assign(w, { energy: 0.9, focus: 0.05 });
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) expect(chooseTarget(s, w, rng)!.kind).toBe("snack");
    expect(w.need).toBe("focus");
    Object.assign(w, { energy: 0.05, focus: 0.9 });
    for (let i = 0; i < 20; i++) expect(chooseTarget(s, w, rng)!.kind).toBe("nap");
  });

  it("says it can't find a snack when nothing reachable gives focus, and stops once one is built", () => {
    const s = createInitialState(1);
    const w = researchers(s)[0]!;
    Object.assign(w, { energy: 1, focus: 0.05, fomo: 0, x: 8.5, z: 16.5, targetId: TARGET_WANDER, route: [] });
    chooseTarget(s, w, createRng(3));
    expect(w.lost).toBe("focus");
    expect(w.need).toBe("work");
    expect(causeOf(w)).toBe("researcher.lost.focus");
    expect(thoughtOf(s, w)).toMatch(/snack/i);
    s.cash = 100_000_000;
    applyCommands(s, [{ type: "placeBuilding", kind: "snack", x: 9, z: 17 }], createRng(1));
    expect(chooseTarget(s, w, createRng(3))!.kind).toBe("snack");
    expect(w.lost).toBe("");
  });

  it("says where's the demo when visitors want to be impressed and there is no stage", () => {
    const s = createInitialState(1);
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    Object.assign(v, { impressed: 0.2, patience: 1, targetId: TARGET_WANDER });
    chooseTarget(s, v, createRng(3));
    expect(v.lost).toBe("impressed");
    expect(causeOf(v)).toBe("visitor.lost.impressed");
    const built = campus("demo");
    const v2 = built.walkers.find((w) => w.kind === "visitor")!;
    Object.assign(v2, { impressed: 0.2, patience: 1, targetId: TARGET_WANDER, x: 14.5, z: 16.5 });
    for (let i = 0; i < 10; i++) expect(chooseTarget(built, v2, createRng(i))!.kind).toBe("demo");
    expect(v2.lost).toBe("");
  });

  it("stops saying it can't find something the moment a building that helps is connected", () => {
    const s = createInitialState(1);
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    Object.assign(v, { impressed: 0.2, lost: "impressed", x: 11.5, z: 16.5, route: [], targetId: TARGET_WANDER });
    const r = researchers(s)[0]!;
    Object.assign(r, { focus: 0.05, lost: "focus" });
    s.cash = 100_000_000;
    applyCommands(s, [{ type: "placeBuilding", kind: "demo", x: 14, z: 17 }, { type: "placeBuilding", kind: "snack", x: 9, z: 17 }], createRng(1));
    tick(s); // the new buildings bump the version; walkers re-check on the next tick
    expect(v.lost).toBe("");
    expect(r.lost).toBe("");
  });

  it("sends a bored visitor for a seat and a snack before the next sight", () => {
    const s = campus("snack");
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    Object.assign(v, { impressed: 0.5, patience: 0.1, targetId: TARGET_WANDER, x: 9.5, z: 16.5 });
    const rng = createRng(3);
    for (let i = 0; i < 10; i++) expect(["snack", "kombucha"]).toContain(chooseTarget(s, v, rng)!.kind);
    expect(v.need).toBe("patience");
  });

  it("keeps agents to workplaces and the stage: no queues at the nap pods", () => {
    const s = campus("nap", "snack", "demo");
    const a = s.walkers.find((w) => w.kind === "agent")!;
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      a.targetId = TARGET_WANDER;
      expect(["cluster", "hall", "gateway", "demo"]).toContain(chooseTarget(s, a, rng)!.kind);
    }
  });
});

describe("queues", () => {
  it("makes a fourth researcher wait at a full Snack Wall, lets them in when a spot frees, and gives up after a while", () => {
    const s = campus("snack");
    const wall = buildingOf(s, "snack");
    const four = researchers(s).slice(0, 4);
    only(s, ...four);
    const [a, b, c, d] = four as [Walker, Walker, Walker, Walker];
    for (const w of [a, b, c]) {
      Object.assign(w, { x: 9.5, z: 16.5, px: 9.5, pz: 16.5, route: [], targetId: wall.id, timer: 500, energy: 1, focus: 1, fomo: 0 });
      w.machine = { value: "inside", context: {} };
    }
    Object.assign(d, { x: 9.5, z: 16.5, px: 9.5, pz: 16.5, route: [], targetId: wall.id, energy: 1, focus: 1, fomo: 0 });
    d.machine = { value: "seeking", context: {} };
    tick(s);
    expect(d.machine.value).toBe("queuing");
    expect(thoughtOf(s, d)).toBe(CAUSES["researcher.queue"].lines[Math.floor(s.day / 2) % CAUSES["researcher.queue"].lines.length]);

    a.timer = 1;
    for (let i = 0; i < 4 && d.machine.value === "queuing"; i++) tick(s);
    expect(d.machine.value).toBe("inside");
    expect(d.stats.snacks).toBe(1);

    // A second time round, nobody leaves and patience runs out.
    d.machine = { value: "seeking", context: {} };
    d.targetId = wall.id;
    d.timer = 0;
    d.route = [];
    for (const w of [a, b, c]) {
      w.machine = { value: "inside", context: {} };
      w.targetId = wall.id;
      w.timer = 500;
    }
    tick(s);
    expect(d.machine.value).toBe("queuing");
    d.timer = 1;
    tick(s);
    expect(d.machine.value).not.toBe("queuing");
    expect(d.targetId).not.toBe(wall.id);
  });

  it("does not count agents against a building's capacity, and never makes them queue", () => {
    const s = campus("demo");
    const stage = buildingOf(s, "demo");
    const agents = s.walkers.filter((w) => w.kind === "agent").slice(0, 3);
    only(s, ...agents);
    for (const a of agents) {
      Object.assign(a, { x: 14.5, z: 16.5, px: 14.5, pz: 16.5, route: [], targetId: stage.id, timer: 500 });
      a.machine = { value: "seeking", context: {} };
    }
    tick(s);
    expect(agents.every((a) => a.machine.value === "inside")).toBe(true);
  });
});

describe("leaving", () => {
  const miserable = (s: GameState) => {
    const w = researchers(s)[0]!;
    Object.assign(w, { energy: 0, focus: 0, fomo: 1 });
    return w;
  };

  it("walks a researcher out the gate with a box after five days below 0.2, with a headline", () => {
    const s = createInitialState(1);
    const w = miserable(s);
    const rng = createRng(8);
    const name = w.name;
    for (let day = 1; day <= 4; day++) {
      dailyCrowd(s, rng);
      expect(w.mood.value).toBe("miserable");
      expect(w.machine.value).not.toBe("quitting");
    }
    dailyCrowd(s, rng);
    expect(w.mood.value).toBe("resigned");
    expect(w.machine.value).toBe("quitting");
    expect(w.route.length).toBeGreaterThan(0);
    const before = s.vibes.incidents;
    for (let i = 0; i < 600 && s.walkers.includes(w); i++) tick(s);
    expect(s.walkers.includes(w)).toBe(false);
    expect(s.toasts.some((t) => t.text.includes(name))).toBe(true);
    expect(s.vibes.incidents).toBeGreaterThan(before * 0.5);
    expect(s.news.some((n) => /(leaves|quits|walks out|loses)/.test(n.text) && (n.text.includes(name) || n.text.startsWith("Researcher leaves")))).toBe(true);
  });

  it("uses her, his or their in the headline, whichever the walker has", () => {
    for (const pro of [0, 1, 2]) {
      const s = createInitialState(1);
      const w = miserable(s);
      w.pro = pro;
      s.news = [];
      for (let i = 0; i < 5; i++) dailyCrowd(s, createRng(30 + pro));
      for (let i = 0; i < 600 && s.walkers.includes(w); i++) tick(s);
      const line = s.news.find((n) => n.text.includes("GPUs"));
      if (line) expect(line.text).toContain(THEIR[pro]);
    }
    expect(THEIR).toEqual(["her", "his", "their"]);
  });

  it("wants five days in a row: a good day in between resets the count", () => {
    const s = createInitialState(1);
    const w = miserable(s);
    const rng = createRng(8);
    for (let i = 0; i < 3; i++) dailyCrowd(s, rng);
    expect(w.mood.context.days).toBe(3);
    Object.assign(w, { energy: 1, focus: 1, fomo: 0 });
    dailyCrowd(s, rng);
    expect(w.mood.value).toBe("content");
    Object.assign(w, { energy: 0, focus: 0, fomo: 1 });
    for (let i = 0; i < 4; i++) dailyCrowd(s, rng);
    expect(w.machine.value).not.toBe("quitting");
    dailyCrowd(s, rng);
    expect(w.machine.value).toBe("quitting");
  });

  it("only researchers resign: a miserable visitor is just a visitor", () => {
    const s = createInitialState(1);
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    Object.assign(v, { patience: 0, impressed: 0 });
    for (let i = 0; i < 8; i++) dailyCrowd(s, createRng(i));
    expect(v.machine.value).not.toBe("quitting");
  });

  it("slumps under 0.4 and lifts above 0.5 (no flicker in between); miserable under 0.2", () => {
    expect(moodFor(0.39, "content")).toBe("slumped");
    expect(moodFor(0.45, "content")).toBe("content");
    expect(moodFor(0.45, "slumped")).toBe("slumped");
    expect(moodFor(0.5, "slumped")).toBe("content");
    expect(moodFor(0.19, "slumped")).toBe("miserable");
    expect(moodFor(0.3, "miserable")).toBe("slumped");
    expect(moodFor(0.45, "miserable")).toBe("slumped");
    const s = createInitialState(1);
    const w = researchers(s)[0]!;
    Object.assign(w, { energy: 0.2, focus: 0.2, fomo: 0.5 });
    dailyCrowd(s, createRng(1));
    expect(w.mood.value).toBe("slumped");
  });
});

describe("Vibes", () => {
  const parts = { happiness: 0, impressed: 0, cleanliness: 0, hype: 0, incident: 0, protest: 0 };

  it("weighs happiness 40%, impressed 20%, cleanliness 15%, hype 15%, and keeps 10% for no penalties", () => {
    expect(vibesTarget({ happiness: 1, impressed: 1, cleanliness: 1, hype: 1, incident: 0, protest: 0 })).toBeCloseTo(999, 6);
    // With no penalties the last 10% is banked, so an empty lab still sits at 10%.
    expect(vibesTarget(parts)).toBeCloseTo(0.1 * 999, 6);
    expect(vibesTarget({ ...parts, happiness: 1 })).toBeCloseTo((0.1 + 0.4) * 999, 6);
    expect(vibesTarget({ ...parts, impressed: 1 })).toBeCloseTo((0.1 + 0.2) * 999, 6);
    expect(vibesTarget({ ...parts, cleanliness: 1 })).toBeCloseTo((0.1 + 0.15) * 999, 6);
    expect(vibesTarget({ ...parts, hype: 1 })).toBeCloseTo((0.1 + 0.15) * 999, 6);
  });

  it("takes up to the last 10% away for incidents and protests, half each", () => {
    const perfect = { happiness: 1, impressed: 1, cleanliness: 1, hype: 1 };
    expect(vibesTarget({ ...perfect, incident: 1, protest: 0 })).toBeCloseTo(999 - 0.05 * 999, 6);
    expect(vibesTarget({ ...perfect, incident: 0, protest: 1 })).toBeCloseTo(999 - 0.05 * 999, 6);
    expect(vibesTarget({ ...perfect, incident: 1, protest: 1 })).toBeCloseTo(999 * 0.9, 6);
    expect(vibesTarget({ ...parts, incident: 1, protest: 1 })).toBe(0);
  });

  it("reads the room: average happiness of researchers and visitors, visitor wonder, hype, protesters, cleanliness stubbed at 1", () => {
    const s = createInitialState(1);
    for (const w of s.walkers) {
      if (w.kind === "researcher") Object.assign(w, { energy: 1, focus: 1, fomo: 0 });
      if (w.kind === "visitor") Object.assign(w, { patience: 1, impressed: 0.6 });
    }
    const r = researchers(s).length;
    const v = count(s, "visitor");
    const p = readVibes(s);
    expect(p.happiness).toBeCloseTo((r * 1 + v * 0.8) / (r + v), 6);
    expect(p.impressed).toBeCloseTo(0.6, 6);
    expect(p.cleanliness).toBe(1);
    expect(p.hype).toBeCloseTo(0.3, 6);
    expect(p.protest).toBe(0);
    s.waterDiscourse = 100;
    syncProtesters(s, createRng(1), true);
    expect(readVibes(s).protest).toBeCloseTo(Math.min(1, 25 / 25), 6);
    s.vibes.incidents = 0.4;
    expect(readVibes(s).incident).toBeCloseTo(0.4, 6);
  });

  it("starts at its target, eases toward a new one by a quarter a day, and reports the trend", () => {
    const s = createInitialState(1);
    expect(s.vibes.value).toBe(s.vibes.target);
    expect(s.vibes.value).toBeGreaterThan(400);
    expect(s.vibes.value).toBeLessThanOrEqual(999);
    for (const w of researchers(s)) Object.assign(w, { energy: 0, focus: 0, fomo: 1 });
    const from = s.vibes.value;
    dailyVibes(s);
    expect(s.vibes.value).toBeLessThan(from);
    expect(s.vibes.value).toBeCloseTo(from + (s.vibes.target - from) * 0.25, 6);
    expect(s.vibes.delta).toBeCloseTo(s.vibes.value - from, 6);
    expect(trendOf(s.vibes)).toBe("down");
    expect(trendOf({ ...s.vibes, delta: 3 })).toBe("up");
    expect(trendOf({ ...s.vibes, delta: 0.2 })).toBe("flat");
    const again = initialVibes(s);
    expect(again.value).toBe(again.target);
  });

  it("fades incidents by 10% a day", () => {
    const s = createInitialState(1);
    s.vibes.incidents = 1;
    dailyVibes(s);
    expect(s.vibes.incidents).toBeCloseTo(0.9, 6);
  });

  it("drives the crowd: more visitors and a bigger cap at high Vibes", () => {
    expect(visitorCapFor(900)).toBeGreaterThan(visitorCapFor(300));
    expect(visitorChanceFor(900)).toBeGreaterThan(visitorChanceFor(300));
    const arrivals = (vibes: number) => {
      const s = createInitialState(4);
      s.walkers = [];
      s.vibes.value = vibes;
      let seen = 0;
      const ids = new Set<number>();
      for (let i = 0; i < 400; i++) {
        tick(s);
        s.vibes.value = vibes;
        for (const w of s.walkers) if (w.kind === "visitor" && !ids.has(w.id)) (ids.add(w.id), seen++);
      }
      return seen;
    };
    expect(arrivals(950)).toBeGreaterThan(arrivals(60));
  });

  it("brings applicants to the gate when Vibes are above 350 and a hall has room, and only then", () => {
    const withRoom = () => campus("hall");
    const s = withRoom();
    expect(researcherTarget(s)).toBe(10 + 8);
    expect(count(s, "researcher")).toBe(11);
    s.vibes.value = 300;
    for (let i = 0; i < 20; i++) dailyWalkers(s, createRng(i));
    expect(count(s, "researcher")).toBe(11);

    const g = withRoom();
    g.vibes.value = 700;
    const rng = createRng(2);
    for (let i = 0; i < 10; i++) dailyWalkers(g, rng);
    expect(count(g, "researcher")).toBeGreaterThan(11);
    expect(count(g, "researcher")).toBeLessThanOrEqual(researcherTarget(g));
    const newcomer = researchers(g).find((w) => w.machine.value === "arriving")!;
    expect(newcomer).toBeDefined();
    expect(newcomer.stats.joined).toBe(g.day);
    expect(newcomer.route.length).toBeGreaterThan(0);
    // They come from the gate, not out of a Training Hall.
    expect(Math.abs(newcomer.x - (g.gate.x + g.gate.w / 2))).toBeLessThan(3);
    expect(newcomer.z).toBeGreaterThan(g.gate.z - 4);

    // Applicants keep coming until the halls are full, and then they stop.
    const full = createInitialState(1);
    full.vibes.value = 900;
    for (let i = 0; i < 40; i++) dailyWalkers(full, createRng(i));
    expect(count(full, "researcher")).toBe(researcherTarget(full));
    expect(researcherTarget(full)).toBe(14);
  });
});

describe("the Demo Stage", () => {
  it("succeeds or fails by capability", () => {
    expect(demoOdds(0)).toBeCloseTo(0.3, 6);
    expect(demoOdds(36)).toBeCloseTo(0.6, 6);
    expect(demoOdds(500)).toBe(0.95);
    const rate = (capability: number) => {
      let ok = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const s = campus("demo");
        s.capability = capability;
        showFor(s, createRng(seed), buildingOf(s, "demo"));
        ok += s.flags[`showOk:${buildingOf(s, "demo").id}`]!;
      }
      return ok / 300;
    };
    expect(rate(0)).toBeGreaterThan(0.2);
    expect(rate(0)).toBeLessThan(0.4);
    expect(rate(100)).toBeGreaterThan(0.85);
  });

  it("gives a whole audience the same show for SHOW_TICKS, then rolls a new one", () => {
    const s = campus("demo");
    const stage = buildingOf(s, "demo");
    const rng = createRng(3);
    const first = showFor(s, rng, stage);
    for (let i = 0; i < 5; i++) expect(showFor(s, rng, stage)).toBe(first);
    expect([1, FLOP_SCALE]).toContain(first);
    s.tick += SHOW_TICKS;
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      s.tick += SHOW_TICKS;
      seen.add(showFor(s, rng, stage));
    }
    expect(seen.size).toBe(2);
  });

  it("writes a headline and, for a flop, dents the Vibes", () => {
    let flops = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = campus("demo");
      s.capability = 0;
      s.news = [];
      const scale = showFor(s, createRng(seed), buildingOf(s, "demo"));
      expect(s.news).toHaveLength(1);
      if (scale === FLOP_SCALE) {
        flops++;
        expect(s.vibes.incidents).toBeCloseTo(0.1, 6);
      } else expect(s.vibes.incidents).toBe(0);
    }
    expect(flops).toBeGreaterThan(10);
  });

  it("impresses visitors who walk in, or the opposite", () => {
    const s = campus("demo");
    const stage = buildingOf(s, "demo");
    const v = s.walkers.find((w) => w.kind === "visitor")!;
    only(s, v);
    Object.assign(v, { x: 14.5, z: 16.5, px: 14.5, pz: 16.5, route: [], targetId: stage.id, impressed: 0.3, patience: 1 });
    v.machine = { value: "seeking", context: {} };
    tick(s);
    expect(v.machine.value).toBe("inside");
    expect(v.stats.demos).toBe(1);
    const worked = s.flags[`showOk:${stage.id}`] === 1;
    expect(v.impressed).toBeCloseTo(worked ? 0.8 : 0.1, 5);
  });

  it("makes investors write cheques only when they leave properly impressed", () => {
    for (const [impressed, pays] of [[0.9, true], [0.4, false]] as const) {
      const s = createInitialState(1);
      const v = s.walkers.find((w) => w.kind === "visitor")!;
      only(s, v);
      Object.assign(v, { role: "Venture Capitalist", impressed, visits: 0, x: 11.5, z: 16.5, px: 11.5, pz: 16.5, route: [], targetId: TARGET_WANDER, timer: 1 });
      v.machine = { value: "wandering", context: {} };
      const cash = s.cash;
      const ledger = s.pops.length;
      tick(s);
      expect(v.machine.value).toBe("leaving");
      expect(s.cash > cash).toBe(pays);
      expect(s.pops.length > ledger).toBe(pays);
      expect(s.news.some((n) => n.text.includes(v.name))).toBe(pays);
    }
  });
});

describe("thoughts", () => {
  it("has 60+ need-keyed lines, and every cause has at least as many lines as it spreads over", () => {
    const total = CAUSE_KEYS.reduce((n, k) => n + CAUSES[k].lines.length, 0);
    expect(total).toBeGreaterThanOrEqual(60);
    for (const k of CAUSE_KEYS) {
      expect(CAUSES[k].lines.length, k).toBeGreaterThanOrEqual(CAUSES[k].spread);
      for (const line of CAUSES[k].lines) expect(line.length).toBeGreaterThan(10);
    }
  });

  it("aggregates the crowd: 23 tired researchers all think the same thing, and the panel says so", () => {
    const s = createInitialState(1);
    seedWalkers(s, "researcher", 30, createRng(9));
    const rs = researchers(s);
    rs.slice(0, 23).forEach((w) => Object.assign(w, { energy: 0.08, focus: 1, fomo: 0, lost: "" }));
    rs.slice(23).forEach((w) => Object.assign(w, { energy: 1, focus: 1, fomo: 0, lost: "" }));
    const board = thoughtBoard(s);
    expect(board[0]!.count).toBe(23);
    expect(board[0]!.kind).toBe("researcher");
    expect(CAUSES["researcher.tired"].lines).toContain(board[0]!.text);
    expect(board.map((r) => r.count)).toEqual([...board.map((r) => r.count)].sort((a, b) => b - a));
    expect(walkersThinking(s, board[0]!.key).size).toBe(23);
    // Every walker is in exactly one row.
    expect(board.reduce((n, r) => n + r.count, 0)).toBe(s.walkers.length);
  });

  it("rotates the line every couple of days and follows the rival's name", () => {
    const s = createInitialState(1);
    const w = researchers(s)[0]!;
    Object.assign(w, { energy: 0.05, focus: 1, fomo: 0, lost: "" });
    const a = thoughtOf(s, w);
    s.day += 2;
    expect(thoughtOf(s, w)).not.toBe(a);
    Object.assign(w, { energy: 1, focus: 1, fomo: 0.9 });
    s.flags.rivalIndex = 2;
    const lines = new Set<string>();
    for (let d = 0; d < 10; d++) {
      s.day = d * 2;
      lines.add(thoughtOf(s, w));
    }
    expect([...lines].some((l) => l.startsWith("MetaMeta just shipped"))).toBe(true);
  });

  it("gives every kind of walker a thought, including agents by drift", () => {
    const s = createInitialState(1);
    const a = s.walkers.find((w) => w.kind === "agent")!;
    a.drift = 0.1;
    expect(causeOf(a)).toBe("agent.aligned");
    a.drift = 0.5;
    expect(causeOf(a)).toBe("agent.drifting");
    a.drift = 0.9;
    expect(causeOf(a)).toBe("agent.drifted");
    for (const w of s.walkers) expect(thoughtOf(s, w).length).toBeGreaterThan(5);
  });
});

describe("determinism and scale", () => {
  it("replays the crowd exactly: names, needs, moods, queues and quits included", () => {
    const run = () => {
      const s = campus("nap", "snack", "demo");
      for (let i = 0; i < 1600; i++) {
        if (i === 400) for (const r of researchers(s).slice(0, 2)) Object.assign(r, { energy: 0, focus: 0, fomo: 1 });
        tick(s);
      }
      return s;
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.walkers.every((w) => w.name.length > 0)).toBe(true);
  });

  it("keeps 800 walkers under 0.5 ms per tick", () => {
    const s = campus("nap", "snack", "demo");
    const rng = createRng(11);
    s.capability = 4000; // agentTarget caps at 400
    fillAgents(s, rng);
    s.waterDiscourse = 160;
    syncProtesters(s, rng, true);
    // Three small buildings for 300 researchers is a queue and a half: an unfair fight on purpose. Visitors leave and
    // unhappy researchers quit, so the crowd is topped back up before each timed batch.
    const topUp = () => {
      seedWalkers(s, "researcher", Math.max(0, 300 - count(s, "researcher")), rng);
      seedWalkers(s, "visitor", Math.max(0, 110 - count(s, "visitor")), rng);
    };
    topUp();
    expect(count(s, "agent")).toBe(400);
    // (An event card stops the clock until it is answered, so every tick answers whatever is open: otherwise a card that
    // happens to open in the first fifteen days would turn this into a test of doing nothing.)
    for (let i = 0; i < 100; i++) tick(s, answer(s)); // warm up the JIT and spread the crowd out
    let best = Infinity;
    let smallest = Infinity;
    for (let attempt = 0; attempt < 3; attempt++) {
      topUp();
      smallest = Math.min(smallest, s.walkers.length);
      const t0 = performance.now();
      const day = s.day;
      for (let i = 0; i < 200; i++) tick(s, answer(s));
      best = Math.min(best, (performance.now() - t0) / 200);
      expect(s.day).toBeGreaterThan(day); // it really ran
    }
    console.log(`800-walker tick: ${best.toFixed(3)} ms (best of 3 x 200 ticks), never fewer than ${smallest} walkers at the start of a batch`);
    expect(smallest).toBeGreaterThanOrEqual(800);
    expect(best).toBeLessThan(0.5);
  });
});
