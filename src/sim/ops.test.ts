// FLT-10, Operations: slop, staff (and their patrol zones), breakdowns, queues, and the night thoughts that came with them.
import { BUILDINGS, type BuildingKind } from "../content/buildings";
import { HEADLINES } from "../content/headlines";
import { CAUSES } from "../content/needThoughts";
import { NIGHT_THOUGHTS, FIRST_NIGHT_LINE } from "../content/night";
import { MAX_PER_JOB, MAX_STAFF, STAFF } from "../content/staff";
import { applyCommands, type Command } from "./commands";
import { BREAKDOWN_FACTOR, breakdownChance, CONTRACTOR_DAYS, CONTRACTOR_FEE, CONTRACTOR_REPAIRED_TO, dailyBreakdowns, REPAIRED_TO, RELIABILITY_LOSS, brokenBuildings } from "./breakdowns";
import { CYCLE_TICKS } from "./daylight";
import { dailyDiscourse, protesterCount, syncProtesters } from "./protest";
import { dailyEconomy } from "./economy";
import { causeOf, thoughtBoard, thoughtOf } from "./mind";
import { happinessOf } from "./needs";
import { chainFor, faceDoor, SLOT_SPACING, slotPoint } from "./queues";
import { createRng, type Rng } from "./rng";
import { cleanlinessOf, dailySlop, mopTile, slopInterval, slopStats, SLOP_DRIFT, MESS_DECAY, MESS_THOUGHT, MESS_UNHAPPINESS } from "./slop";
import { commsRelief, guardsOn, payroll, staffOf } from "./staff";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { activeConditions, dailyThoughts } from "./thoughts";
import { tick, TICKS_PER_DAY } from "./tick";
import { TARGET_WANDER, type GameState, type Walker } from "./types";
import { readVibes } from "./vibes";
import { computePerDay } from "./training";

const rng = () => createRng(9);
/** An rng that never rolls a hit: wear without breakdowns. */
const never = (): Rng => ({ ...createRng(1), chance: () => false });
/** An rng that always rolls a hit. */
const always = (): Rng => ({ ...createRng(1), chance: () => true });

const idx = (s: GameState, x: number, z: number) => z * s.grid.w + x;
/** Event cards stop the clock until they are answered, so every tick here answers whatever is open. */
const step = (s: GameState, cmds: Command[] = []) => tick(s, [...cmds, ...answer(s)]);
const run = (s: GameState, ticks: number, cmds: Command[] = []) => {
  for (let i = 0; i < ticks; i++) step(s, i === 0 ? cmds : []);
};
/** The starting campus with nobody walking around to get in the way of a staged scene. */
function empty(): GameState {
  const s = createInitialState(1);
  s.walkers = [];
  s.cash = 100_000_000;
  // Nobody new turns up mid-test: no visitors, and no agents to drift and make their own slop.
  s.vibes.value = 0;
  s.agentBonus = -100;
  return s;
}
const buildingOf = (s: GameState, kind: BuildingKind) => s.buildings.find((b) => b.kind === kind)!;

describe("slop", () => {
  it("is dropped on the path by agents that have drifted past 0.6, about one per 8 game hours, and by nobody else", () => {
    const s = empty();
    const agents = createInitialState(1).walkers.filter((w) => w.kind === "agent").slice(0, 2);
    const [drifted, aligned] = agents as [Walker, Walker];
    for (const a of agents) Object.assign(a, { x: 11.5, z: 14.5, px: 11.5, pz: 14.5, route: [], targetId: TARGET_WANDER, timer: 9999 });
    drifted.drift = 0.97;
    aligned.drift = SLOP_DRIFT - 0.1;
    a_inPhase(drifted, "wandering");
    a_inPhase(aligned, "wandering");
    s.walkers = [drifted, aligned];
    expect(slopStats(s).depth).toBe(0);
    // 8.4 game hours is 7 ticks: a puddle deeper each seven ticks from the drifted agent (standing still, so it piles up on one tile),
    // none at all from the aligned one (whose drift creeps up 0.0005 a tick, nowhere near 0.6).
    run(s, 7);
    expect(slopStats(s).depth).toBe(1);
    run(s, 7);
    expect(slopStats(s).depth).toBe(2);
    run(s, 21);
    const { depth, tiles } = slopStats(s);
    expect(depth).toBe(3); // three deep is as deep as it gets
    expect(tiles).toBe(1);
    expect(s.slop[idx(s, 11, 14)]).toBe(3);
    for (let i = 0; i < s.slop.length; i++) if (s.slop[i]! > 0) expect(s.grid.paths[i], `tile ${i} is a path`).toBe(true);
    expect(slopInterval(0.95)).toBe(7);
    expect(slopInterval(0.65)).toBeGreaterThan(slopInterval(0.95));
  });

  it("stops at three levels a tile, and mopping takes a level off at a time", () => {
    const s = empty();
    const i = idx(s, 11, 14);
    s.slop[i] = 3;
    expect(mopTile(s, i)).toBe(true);
    expect(s.slop[i]).toBe(2);
    s.slop[i] = 0;
    expect(mopTile(s, i)).toBe(false);
  });

  it("makes a researcher who steps in it unhappy and grumble 'This path is covered in slop.'", () => {
    const s = empty();
    const r = createInitialState(1).walkers.find((w) => w.kind === "researcher")!;
    Object.assign(r, { x: 11.5, z: 14.5, px: 11.5, pz: 14.5, route: [], targetId: TARGET_WANDER, timer: 9999, energy: 1, focus: 1, fomo: 0 });
    a_inPhase(r, "wandering");
    s.walkers = [r];
    const before = happinessOf(r);
    s.slop[idx(s, 11, 14)] = 2;
    step(s);
    expect(r.mess).toBeGreaterThan(0);
    expect(happinessOf(r)).toBeLessThan(before);
    // It builds while they stand in it, up to a ceiling, and takes at most MESS_UNHAPPINESS off their happiness.
    run(s, 30);
    expect(r.mess).toBe(1);
    // (Their needs have drained a little in the meantime: compare with the same walker, clean.)
    expect(happinessOf({ ...r, mess: 0 }) - happinessOf(r)).toBeCloseTo(MESS_UNHAPPINESS, 5);
    expect(causeOf(r)).toBe("researcher.slop");
    expect(thoughtOf(s, r)).toBe("This path is covered in slop.");
    expect(thoughtBoard(s).some((row) => row.text === "This path is covered in slop.")).toBe(true);
    // It wears off once they are clear of the puddle, slowly enough that the daily mood check never sees a flicker.
    r.route = [];
    s.slop[idx(s, 11, 14)] = 0;
    run(s, 20);
    expect(r.mess).toBeCloseTo(1 - 20 * MESS_DECAY, 5);
    expect(r.mess).toBeGreaterThan(MESS_THOUGHT);
    run(s, Math.ceil(1 / MESS_DECAY));
    expect(r.mess).toBe(0);
    expect(happinessOf(r)).toBe(happinessOf({ ...r, mess: 0 }));
  });

  it("feeds the Vibes as cleanliness: spotless is 1, half the paths slopped is 0", () => {
    const s = empty();
    expect(readVibes(s).cleanliness).toBe(1);
    const paths = s.grid.paths.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
    for (const i of paths.slice(0, Math.floor(paths.length / 4))) s.slop[i] = 1;
    expect(cleanlinessOf(s)).toBeCloseTo(0.5, 1);
    for (const i of paths.slice(0, Math.ceil(paths.length / 2))) s.slop[i] = 3;
    expect(readVibes(s).cleanliness).toBe(0);
  });

  it("makes the ticker say '{lab} campus now {pct}% slop by volume' once a fifth of the paths are slopped", () => {
    const s = empty();
    const paths = s.grid.paths.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
    for (const i of paths.slice(0, Math.floor(paths.length * 0.15))) s.slop[i] = 1;
    dailySlop(s, rng());
    const quiet = s.news.length;
    expect(s.news).toHaveLength(quiet);
    for (const i of paths.slice(0, Math.floor(paths.length * 0.45))) s.slop[i] = 2;
    dailySlop(s, rng());
    const pct = Math.round(slopStats(s).share * 100);
    expect(pct).toBeGreaterThan(20);
    expect(s.news.at(-1)!.text).toContain(`${pct}%`);
    expect(s.toasts.some((t) => t.text.includes("slop by volume"))).toBe(true);
    // Not every day.
    const n = s.news.length;
    s.day++;
    dailySlop(s, rng());
    expect(s.news).toHaveLength(n);
  });

  it("goes when the path under it is bulldozed", () => {
    const s = empty();
    s.slop[idx(s, 9, 16)] = 3;
    applyCommands(s, [{ type: "bulldoze", x: 9, z: 16 }], rng());
    expect(s.slop[idx(s, 9, 16)]).toBe(0);
  });
});

/** Put a walker straight into a phase, without the world work of getting there. */
function a_inPhase(w: Walker, phase: Walker["machine"]["value"]) {
  w.machine = { value: phase, context: {} };
}

describe("staff", () => {
  it("hires through the gate, pays a salary a day, and lets people go through the gate again", () => {
    const s = empty();
    const before = createInitialState(1);
    run(s, 1, [{ type: "hire", job: "janitor" }, { type: "hire", job: "sre" }]);
    expect(s.staff.map((x) => x.job)).toEqual(["janitor", "sre"]);
    expect(s.staff[0]!.name).toMatch(/^MOP-1 /);
    expect(payroll(s)).toBe(STAFF.janitor.salary + STAFF.sre.salary);
    expect(STAFF.janitor.salary).toBe(2_000);
    expect(STAFF.sre.salary).toBe(4_000);
    expect(STAFF.comms.salary).toBe(3_000);
    expect(STAFF.security.salary).toBe(3_000);
    // A day's bills include them.
    const noStaff = before;
    noStaff.walkers = [];
    s.buildings.length === noStaff.buildings.length && dailyEconomy(s, rng());
    dailyEconomy(noStaff, rng());
    expect(s.ledger.expenses - noStaff.ledger.expenses).toBe(6_000);
    // And out again.
    const who = s.staff[0]!;
    run(s, 1, [{ type: "fire", id: who.id }]);
    expect(who.machine.value).toBe("leaving");
    run(s, 400);
    expect(s.staff.some((x) => x.id === who.id)).toBe(false);
    expect(payroll(s)).toBe(STAFF.sre.salary);
  });

  it("caps the payroll", () => {
    const s = empty();
    const cmds: Command[] = [];
    for (let i = 0; i < MAX_PER_JOB + 3; i++) cmds.push({ type: "hire", job: "janitor" });
    run(s, 1, cmds);
    expect(staffOf(s, "janitor")).toHaveLength(MAX_PER_JOB);
    for (const job of ["sre", "comms", "security"] as const) for (let i = 0; i < MAX_PER_JOB; i++) applyCommands(s, [{ type: "hire", job }], rng());
    expect(s.staff.length).toBeLessThanOrEqual(MAX_STAFF);
  });

  it("has a Janitor Bot walk to the slop and mop it up", () => {
    const s = empty();
    const a = idx(s, 7, 16);
    s.slop[a] = 3;
    run(s, 1, [{ type: "hire", job: "janitor" }]);
    const bot = s.staff[0]!;
    const phases = new Set<string>();
    for (let i = 0; i < 300 && s.slop[a]! > 0; i++) {
      step(s);
      phases.add(bot.machine.value);
    }
    expect(s.slop[a]).toBe(0);
    expect(phases).toContain("going");
    expect(phases).toContain("working");
    expect(s.flags.mopped).toBeGreaterThanOrEqual(1);
    expect(bot.done).toBeGreaterThanOrEqual(1);
  });

  it("keeps a staffer to their painted patrol zone: only slop inside it gets mopped", () => {
    const s = empty();
    const inside = idx(s, 14, 10);
    const outside = idx(s, 7, 16);
    s.slop[inside] = 2;
    s.slop[outside] = 2;
    run(s, 1, [{ type: "hire", job: "janitor" }]);
    const bot = s.staff[0]!;
    const paint: Command[] = [];
    for (const x of [13, 14, 15]) paint.push({ type: "paintZone", id: bot.id, x, z: 10, on: true });
    run(s, 1, paint);
    expect(bot.zone).toEqual([idx(s, 13, 10), idx(s, 14, 10), idx(s, 15, 10)]);
    run(s, 400);
    expect(s.slop[inside]).toBe(0);
    expect(s.slop[outside]).toBe(2);
    // Erase one tile, then the lot: with no zone they cover the whole campus.
    run(s, 1, [{ type: "paintZone", id: bot.id, x: 13, z: 10, on: false }]);
    expect(bot.zone).toHaveLength(2);
    expect(bot.zone).not.toContain(idx(s, 13, 10));
    run(s, 1, [{ type: "clearZone", id: bot.id }]);
    expect(bot.zone).toEqual([]);
    run(s, 500);
    expect(s.slop[outside]).toBe(0);
  });

  it("patrols inside the zone when there is nothing to do (Security walks the fence with no zone)", () => {
    const s = empty();
    run(s, 1, [{ type: "hire", job: "security" }, { type: "hire", job: "comms" }]);
    const [guard, rep] = s.staff as [(typeof s.staff)[number], (typeof s.staff)[number]];
    expect(guardsOn(s)).toBe(1);
    // Fence: the guard ends up round the edge of the map, well away from the middle.
    let far = 0;
    for (let i = 0; i < 700; i++) {
      step(s);
      far = Math.max(far, Math.hypot(guard.x - 12, guard.z - 12));
    }
    expect(far).toBeGreaterThan(10);
    // A zone keeps a stroller in it.
    const cmds: Command[] = [];
    for (const x of [6, 7, 8]) cmds.push({ type: "paintZone", id: rep.id, x, z: 16, on: true });
    run(s, 1, cmds);
    run(s, 300); // walk there
    for (let i = 0; i < 300; i++) {
      step(s);
      expect(Math.floor(rep.z)).toBe(16);
      expect(Math.floor(rep.x)).toBeGreaterThanOrEqual(6);
      expect(Math.floor(rep.x)).toBeLessThanOrEqual(8);
    }
  });

  it("has a Comms Rep walk up to protesters, and takes 2 off the discourse a day for each while they are there", () => {
    const s = createInitialState(1);
    s.cash = 100_000_000;
    s.waterDiscourse = 30;
    syncProtesters(s, rng(), true);
    expect(protesterCount(s)).toBeGreaterThan(0);
    const bare = JSON.parse(JSON.stringify(s)) as GameState;
    run(s, 1, [{ type: "hire", job: "comms" }, { type: "hire", job: "comms" }]);
    expect(commsRelief(s)).toBe(4);
    const rep = staffOf(s, "comms")[0]!;
    // Same day, same rng: the rep's discourse comes out four lower.
    const a = JSON.parse(JSON.stringify(s)) as GameState;
    dailyDiscourse(a, createRng(3));
    dailyDiscourse(bare, createRng(3));
    expect(bare.waterDiscourse - a.waterDiscourse).toBeCloseTo(4, 5);
    // Nobody to talk to, no relief.
    a.walkers = a.walkers.filter((w) => w.kind !== "protester");
    expect(commsRelief(a)).toBe(0);
    // And they do walk over to the crowd.
    for (let i = 0; i < 500 && (s.flags.totes ?? 0) < 1; i++) step(s);
    expect(s.flags.totes).toBeGreaterThanOrEqual(1);
    expect(rep.done + staffOf(s, "comms")[1]!.done).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic: the same seed and commands give the same World, and it survives a JSON round trip", () => {
    const play = () => {
      const s = createInitialState(2);
      s.cash = 100_000_000;
      run(s, 1, [{ type: "hire", job: "janitor" }, { type: "hire", job: "sre" }, { type: "hire", job: "security" }]);
      run(s, 600);
      return s;
    };
    const a = play();
    const b = play();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe("breakdowns", () => {
  it("follows the spec: (1 - reliability) x utilisation x 0.2, and 0.5% of reliability lost a day", () => {
    expect(BREAKDOWN_FACTOR).toBe(0.2);
    expect(RELIABILITY_LOSS).toBe(0.005);
    expect(REPAIRED_TO).toBe(0.9);
    expect(breakdownChance(1, 1)).toBe(0);
    expect(breakdownChance(0.9, 1)).toBeCloseTo(0.02);
    expect(breakdownChance(0.5, 0.5)).toBeCloseTo(0.05);
    const s = createInitialState(1);
    expect(s.buildings.every((b) => b.reliability === 1 && !b.broken)).toBe(true);
    for (let d = 0; d < 10; d++) dailyBreakdowns(s, never());
    expect(s.buildings[0]!.reliability).toBeCloseTo(0.95);
  });

  it("stops a cluster on fire from making compute, with a headline and a status page", () => {
    const s = createInitialState(1);
    s.walkers = [];
    const cluster = buildingOf(s, "cluster");
    const compute = computePerDay(s);
    cluster.reliability = 0;
    const v = s.version;
    dailyBreakdowns(s, always());
    expect(cluster.broken).toBe(true);
    expect(s.version).toBeGreaterThan(v);
    expect(computePerDay(s)).toBe(compute - 10);
    const texts = s.news.map((n) => n.text);
    expect(texts.some((t) => HEADLINES.filter((h) => h.trigger === "breakdown:cluster").some((h) => t.startsWith(h.text.replace("{lab}", s.labName).slice(0, 12))))).toBe(true);
    expect(texts.some((t) => /^Status page: /.test(t))).toBe(true);
    expect(s.toasts.some((t) => t.text.includes("out of order"))).toBe(true);
    // Statistically fixed headline from the spec is in the pool.
    expect(HEADLINES.some((h) => h.text === "GPU fire contained; GPUs less so.")).toBe(true);
    expect(HEADLINES.some((h) => h.text === "Status page: all systems operational.")).toBe(true);
  });

  it("stops a gateway from earning while it is down", () => {
    const s = createInitialState(1);
    s.walkers = [];
    applyCommands(s, [{ type: "placeBuilding", kind: "gateway", x: 13, z: 17 }], rng());
    const gw = buildingOf(s, "gateway");
    dailyEconomy(s, rng());
    expect(s.ledger.income).toBeGreaterThan(0);
    gw.broken = true;
    dailyEconomy(s, rng());
    expect(s.ledger.income).toBe(0);
  });

  it("stops walkers from going into a broken building, and throws out anyone already in", () => {
    const s = createInitialState(1);
    const kombucha = buildingOf(s, "kombucha");
    const r = s.walkers.find((w) => w.kind === "researcher")!;
    s.walkers = [r];
    Object.assign(r, { x: 11.5, z: 19.5, px: 11.5, pz: 19.5, route: [], targetId: kombucha.id, timer: 500, energy: 1, focus: 1, fomo: 0 });
    a_inPhase(r, "inside");
    kombucha.broken = true;
    s.version++;
    step(s);
    expect(r.machine.value).not.toBe("inside");
    for (let i = 0; i < 60; i++) {
      step(s);
      expect(r.machine.value === "inside" && r.targetId === kombucha.id).toBe(false);
    }
  });

  it("has an SRE run to it and fix it (reliability back to 90%), and the contractor stays home", () => {
    const s = createInitialState(1);
    s.walkers = [];
    s.cash = 100_000_000;
    s.vibes.value = 0;
    const cluster = buildingOf(s, "cluster");
    run(s, 1, [{ type: "hire", job: "sre" }]);
    const sre = s.staff[0]!;
    cluster.reliability = 0.2;
    cluster.broken = true;
    cluster.brokenTick = s.tick;
    s.version++;
    const phases = new Set<string>();
    for (let i = 0; i < 400 && cluster.broken; i++) {
      step(s);
      phases.add(sre.machine.value);
    }
    expect(cluster.broken).toBe(false);
    expect(cluster.reliability).toBe(REPAIRED_TO);
    expect(phases).toContain("going");
    expect(phases).toContain("working");
    expect(s.flags.repairs).toBe(1);
    expect(sre.done).toBe(1);
    // It took 2 to 4 game hours (a tick is 1.2h): a couple of ticks of work, not days.
    expect(STAFF.sre.work[0] * 1.2).toBeGreaterThanOrEqual(2);
    expect(STAFF.sre.work[1] * 1.2).toBeLessThanOrEqual(4);
    expect(s.cash).toBeGreaterThan(90_000_000);
  });

  it("calls an emergency contractor if nobody comes for five days, and bills for it", () => {
    const s = createInitialState(1);
    s.walkers = [];
    const kombucha = buildingOf(s, "kombucha");
    kombucha.broken = true;
    kombucha.brokenTick = s.tick;
    const cash = s.cash;
    for (let d = 0; d < CONTRACTOR_DAYS - 1; d++) {
      s.tick += TICKS_PER_DAY;
      dailyBreakdowns(s, never());
    }
    expect(kombucha.broken).toBe(true);
    s.tick += TICKS_PER_DAY;
    dailyBreakdowns(s, never());
    expect(kombucha.broken).toBe(false);
    expect(kombucha.reliability).toBe(CONTRACTOR_REPAIRED_TO);
    expect(s.cash).toBe(cash - CONTRACTOR_FEE);
    expect(brokenBuildings(s)).toHaveLength(0);
  });

  it("wears out everything that is not scenery, and breaks the busy things more often than the idle ones", () => {
    const s = createInitialState(1);
    s.walkers = [];
    let breaks = 0;
    let idle = 0;
    for (let trial = 0; trial < 400; trial++) {
      const t = createInitialState(1);
      t.walkers = [];
      const hall = buildingOf(t, "hall");
      const bar = buildingOf(t, "kombucha");
      hall.reliability = bar.reliability = 0.5;
      dailyBreakdowns(t, createRng(trial + 1));
      if (hall.broken) breaks++;
      if (bar.broken) idle++;
    }
    // The hall is training (utilisation 1, 10% a day); an empty bar sits at the floor (0.3, about 3%).
    expect(breaks).toBeGreaterThan(idle);
    expect(BUILDINGS.fountain.scenery).toBe(true);
  });
});

describe("queues", () => {
  /** Nine researchers at the Kombucha Bar's door (capacity 4): four get in, five wait. */
  function crowdAtTheBar() {
    const s = createInitialState(1);
    const bar = buildingOf(s, "kombucha");
    const rs = s.walkers.filter((w) => w.kind === "researcher").slice(0, 9);
    s.walkers = rs;
    s.vibes.value = 0;
    rs.forEach((w, i) => {
      Object.assign(w, { x: 11.5, z: 19.5, px: 11.5, pz: 19.5, route: [], targetId: bar.id, timer: 500, energy: 1, focus: 1, fomo: 0, id: 1000 + i });
      a_inPhase(w, "seeking");
    });
    // One tick to arrive (four get in, the rest queue); then nobody leaves until a test says so.
    step(s);
    for (const w of rs) w.timer = w.machine.value === "inside" ? 9999 : 500;
    return { s, bar, rs };
  }

  it("has the capacities the spec asks for: Kombucha 4, Nap Pods 6, Snack Wall 3, Demo Stage 12", () => {
    expect(BUILDINGS.kombucha.capacity).toBe(4);
    expect(BUILDINGS.nap.capacity).toBe(6);
    expect(BUILDINGS.snack.capacity).toBe(3);
    expect(BUILDINGS.demo.capacity).toBe(12);
  });

  it("forms a visible line on the path: one place each, in the order they joined, snaking away from the door", () => {
    const { s, rs } = crowdAtTheBar();
    run(s, 25);
    const inside = rs.filter((w) => w.machine.value === "inside");
    const waiting = rs.filter((w) => w.machine.value === "queuing");
    expect(inside).toHaveLength(4);
    expect(waiting).toHaveLength(5);
    const slots = waiting.map((w) => w.qslot).sort((a, b) => a - b);
    expect(slots).toEqual([0, 1, 2, 3, 4]);
    // Each is standing at the place they were given, on a path tile, and no two on the same spot.
    const spots = new Set<string>();
    for (const w of waiting) {
      expect(s.grid.paths[idx(s, Math.floor(w.x), Math.floor(w.z))]).toBe(true);
      spots.add(`${w.x.toFixed(2)},${w.z.toFixed(2)}`);
    }
    expect(spots.size).toBe(5);
    // The line runs away from the door and down the spine toward the gate: a stride between people, the front by the Bar.
    const byRank = [...waiting].sort((a, b) => a.qslot - b.qslot);
    for (let i = 2; i < byRank.length; i++) expect(byRank[i]!.z - byRank[i - 1]!.z).toBeCloseTo(SLOT_SPACING, 1);
    expect(byRank[0]!.z).toBeLessThan(19.8);
    expect(byRank[0]!.z).toBeGreaterThan(19);
  });

  it("lets the front of the line in when someone leaves, and everybody shuffles up", () => {
    const { s, rs } = crowdAtTheBar();
    run(s, 25);
    const waiting = () => rs.filter((w) => w.machine.value === "queuing").sort((a, b) => a.qslot - b.qslot);
    const [front, second, third] = waiting() as [Walker, Walker, Walker];
    const leaver = rs.find((w) => w.machine.value === "inside")!;
    leaver.timer = 1;
    for (let i = 0; i < 6 && front.machine.value === "queuing"; i++) step(s);
    expect(front.machine.value).toBe("inside");
    expect(waiting()).toHaveLength(4 - (leaver.machine.value === "inside" ? 0 : 0));
    run(s, 30);
    expect(second.machine.value === "queuing" ? second.qslot : -1).toBeLessThanOrEqual(1);
    expect(third.machine.value === "queuing" ? third.qslot : -1).toBeLessThanOrEqual(2);
  });

  it("makes people give up when their patience runs out: 'This queue is longer than our context window.'", () => {
    const { s, rs } = crowdAtTheBar();
    run(s, 40);
    const quitter = rs.find((w) => w.machine.value === "queuing" && w.qslot === 4)!;
    expect(CAUSES["researcher.queue"].lines[0]).toBe("This queue is longer than our context window.");
    expect(thoughtOf(s, quitter)).toBe(CAUSES["researcher.queue"].lines[Math.floor(s.day / 2) % CAUSES["researcher.queue"].lines.length]);
    // Everyone inside stays put; the last in line runs out of patience.
    quitter.timer = 2;
    const quits = s.flags.queueQuits ?? 0;
    run(s, 4);
    expect(quitter.machine.value).not.toBe("queuing");
    expect(s.flags.queueQuits).toBe(quits + 1);
    expect(quitter.qslot).toBe(-1);
  });

  it("places the nth person along the path a stride apart, the front one at the door, all facing it", () => {
    const { s, bar } = crowdAtTheBar();
    // The line forms on the spine tile in front of the Bar (11, 19) and runs south, toward the gate.
    const chain = chainFor(s, bar.id, idx(s, 11, 19))!;
    expect(chain.tiles.slice(0, 3)).toEqual([idx(s, 11, 19), idx(s, 11, 20), idx(s, 11, 21)]);
    const p = [0, 1, 2, 3, 4, 5].map((n) => slotPoint(s, chain, n));
    for (let n = 2; n < 5; n++) expect(Math.hypot(p[n]![0] - p[n - 1]![0], p[n]![1] - p[n - 1]![1])).toBeCloseTo(SLOT_SPACING, 1); // (the first stride turns the corner)
    // The front is by the Bar (its door is on the east edge of the tile), and the line runs away from it.
    expect(p[0]![0]).toBeGreaterThan(11);
    expect(p[3]![1]).toBeGreaterThan(p[1]![1]);
    // The front of the line faces the door (east, +x); the rest face the person ahead of them (back up the spine, -z).
    expect(Math.sin(faceDoor(s, chain, 0))).toBeGreaterThan(0.9);
    expect(Math.cos(faceDoor(s, chain, 4))).toBeLessThan(-0.9);
  });
});

describe("night thoughts", () => {
  it("sets the 'night' condition when the lamps are on, and only then", () => {
    const s = createInitialState(1);
    expect(activeConditions(s).has("night")).toBe(false);
    s.tick = Math.round(((23 - 8) / 24) * CYCLE_TICKS);
    expect(activeConditions(s).has("night")).toBe(true);
    s.tick = Math.round(((12 - 8) / 24) * CYCLE_TICKS);
    expect(activeConditions(s).has("night")).toBe(false);
  });

  it("flows through the normal thoughts: the first night is 'It's 2am. Still shipping.', and the panel reads the night pool", () => {
    const s = createInitialState(1);
    s.thoughts = [];
    s.tick = Math.round(((23 - 8) / 24) * CYCLE_TICKS);
    s.day = Math.floor(s.tick / TICKS_PER_DAY);
    dailyThoughts(s, rng(), true);
    expect(s.thoughts.at(-1)!.text).toBe(FIRST_NIGHT_LINE.text);
    expect(s.flags.firstNight).toBe(1);
    // Anybody with nothing else on their mind is at it: night lines on the board for researchers, agents and visitors.
    const board = thoughtBoard(s);
    const night = new Set(NIGHT_THOUGHTS.map((n) => n.text));
    expect(board.some((row) => night.has(row.text))).toBe(true);
    // Ordinary bubbles use the pool too.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      s.thoughts = [];
      dailyThoughts(s, createRng(i + 1), true);
      for (const t of s.thoughts) if (night.has(t.text)) seen.add(t.text);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
