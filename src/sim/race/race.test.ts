// The Race at World level: the multiplier, the Arena, eras, the open-weights drop, the compute auction, funding.
import { BUILDINGS } from "../../content/buildings";
import { ERAS } from "../../content/eras";
import { EVENTS } from "../../content/events";
import { THOUGHTS } from "../../content/thoughts";
import { RIVAL_DEFS, YOU } from "../../content/rivals";
import { dailyEvents, openEventOf } from "../events";
import { canPlace, applyCommands } from "../commands";
import { computePerDay, dailyTraining } from "../training";
import { hypeResting } from "../economy";
import { dailyDiscourse } from "../protest";
import { createRng, type Rng } from "../rng";
import { createInitialState } from "../state";
import { answer, layPaths } from "../testkit";
import { TICKS_PER_DAY, tick } from "../tick";
import type { GameState } from "../types";
import { refreshBoard } from "./arena";
import { bidAmount, auctionUnit, fundingDue, openDropActive, raiseAmount, revenueFactor, valuation } from "./finance";
import { datacenterCompute, gasDiscourse, powerOf, solarHype } from "./power";
import { dailyRace, eraOfState, weekly } from "./race";
import { rdMultiplier, multiplierFor, releaseBoost, workingCapability } from "./rd";
import { rankBoard } from "./state";
import { stageMoment } from "./demo";
import { raceView } from "./view";
import { resolveAuction, winChance } from "./actions";
import { eraNumber } from "./era";

/** A dice roll that never varies: `next()` is always `v`. */
const fixed = (v: number): Rng => ({ next: () => v, int: (lo) => lo, chance: (p) => v < p, pick: (items) => items[0]!, state: () => 1 });
const choose = (s: GameState, index: number) => applyCommands(s, [{ type: "chooseEvent", eventId: openEventOf(s)!.id, choiceIndex: index }], createRng(9));
const rival = (s: GameState, id: string) => s.race.rivals.find((r) => r.context.id === id)!;
const setRival = (s: GameState, id: string, value: string, context: Record<string, unknown>) => {
  const i = s.race.rivals.findIndex((r) => r.context.id === id);
  s.race.rivals[i] = { value, context: { ...s.race.rivals[i]!.context, ...context } } as never;
};

describe("the R&D multiplier", () => {
  it("is 1 + agents x skill / (researchers x 10), and never divides by less than one researcher", () => {
    expect(multiplierFor(20, 10, 40)).toBeCloseTo(2); // 20 agents at skill 5 (capability / 8), over 100
    expect(multiplierFor(0, 10, 50)).toBe(1);
    expect(multiplierFor(10, 0, 24)).toBeCloseTo(1 + 10 * 3); // no researchers: divided by 1, not by 0 (skill 3)
  });

  it("reads the agents and researchers walking the campus, and counts the training already done on the next release", () => {
    const s = createInitialState(1);
    const agents = s.walkers.filter((w) => w.kind === "agent").length;
    const researchers = s.walkers.filter((w) => w.kind === "researcher").length;
    const shown = rdMultiplier(s);
    expect(shown).toBeCloseTo(multiplierFor(agents, researchers, workingCapability(s)));
    expect(shown).toBeGreaterThan(1);
    expect(shown).toBeLessThan(2); // the opening lab is in Era 1
    // More of the run done = a higher working capability = a higher multiplier.
    const before = rdMultiplier(s);
    s.training = { ...s.training, context: { ...s.training.context, progress: s.training.context.cost * 0.99 } };
    expect(rdMultiplier(s)).toBeGreaterThan(before);
  });

  it("speeds up training: the same compute, more progress, once the agents are doing the research", () => {
    const run = (extraAgents: number) => {
      const s = createInitialState(1);
      s.agentBonus = 0;
      s.capability = 60;
      s.compute = 100;
      for (let i = 0; i < extraAgents; i++) s.walkers.push({ ...s.walkers.find((w) => w.kind === "agent")!, id: 9000 + i });
      s.training = { ...s.training, context: { ...s.training.context, progress: 0, cost: 1e12 } }; // never releases mid-test
      dailyTraining(s, createRng(2));
      return s.training.context.progress;
    };
    expect(run(60)).toBeGreaterThan(run(0) * 1.5);
  });

  it("makes each release a bigger leap from Era 2 on, up to a cap", () => {
    expect(releaseBoost(1)).toBe(1);
    expect(releaseBoost(2)).toBe(1);
    expect(releaseBoost(10)).toBeGreaterThan(2);
    expect(releaseBoost(10_000)).toBe(4);
  });
});

describe("the Frontier Arena", () => {
  it("ranks the six labs and you by a score from capability and hype, best first, ties going to the rival", () => {
    const s = createInitialState(1);
    expect(s.race.board).toHaveLength(RIVAL_DEFS.length + 1);
    expect(s.race.board.map((r) => r.score)).toEqual([...s.race.board.map((r) => r.score)].sort((a, b) => b - a));
    const tied = rankBoard({ capability: 28, hype: 42 }, s.race.rivals); // exactly Anthropomorphic's start
    const anthro = tied.findIndex((r) => r.id === "anthro");
    expect(tied.findIndex((r) => r.id === YOU)).toBeGreaterThan(anthro);
  });

  it("is re-ranked once a week, not every day, and remembers where everyone was", () => {
    const s = createInitialState(1);
    const startBoard = s.race.board;
    for (let d = 1; d <= 6; d++) {
      s.day = d;
      dailyRace(s, createRng(d));
    }
    expect(s.race.board).toBe(startBoard);
    expect(s.race.week).toBe(0);
    s.day = 7;
    dailyRace(s, createRng(7));
    expect(s.race.week).toBe(1);
    expect(s.race.board).not.toBe(startBoard);
  });

  it("shows the move: you jump to #1 with a release, and your rank chip says how many places", () => {
    const s = createInitialState(1);
    const before = s.race.rank;
    expect(before).toBeGreaterThan(1);
    s.capability = 500;
    refreshBoard(s);
    expect(s.race.rank).toBe(1);
    expect(s.race.rankDelta).toBe(before - 1);
    expect(raceView(s).board[0]).toMatchObject({ id: YOU, rank: 1, delta: before - 1, you: true });
  });

  it("drops you to #4 when three rivals overtake you in one week, with a headline and a toast", () => {
    const s = createInitialState(2);
    s.capability = 60;
    s.hype = 60;
    refreshBoard(s);
    expect(s.race.rank).toBe(1);
    for (const id of ["openish", "metameta", "sirocco"]) setRival(s, id, "training", { capability: 70, weeks: 9 });
    s.day = 7;
    s.news = [];
    s.toasts = [];
    weekly(s, createRng(5));
    expect(s.race.rank).toBe(4);
    expect(s.race.rankDelta).toBe(-3);
    expect(s.news.some((n) => n.text.includes("#4"))).toBe(true);
    expect(s.toasts.some((t) => t.text.includes("Down 3"))).toBe(true);
  });
});

describe("eras", () => {
  it("opens a full-screen title card the day the multiplier crosses 2x, with the spec's one-liner", () => {
    const s = createInitialState(1);
    s.capability = 200; // eleven agents at skill 20 over eleven researchers: 3x
    s.day = 3;
    dailyRace(s, createRng(1));
    expect(eraOfState(s)).toBe(2);
    expect(s.flags["offer:era2"]).toBe(3);
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("era2");
    const card = EVENTS.find((e) => e.id === "era2")!;
    expect(card.kind).toBe("era");
    expect(card.title).toBe("ERA 2: CODING AUTOMATION");
    expect(card.body).toBe("The interns have been automated. The interns are fine.");
    choose(s, 0);
    expect(openEventOf(s)).toBeNull();
    expect(s.flags["offer:era2"]).toBeUndefined();
    expect(s.thoughts.some((t) => t.text.includes("intern"))).toBe(true);
  });

  it("has four eras with the names and thresholds from the spec, each with its own agent look", () => {
    expect(ERAS.map((e) => e.name)).toEqual(["Stumbling Agents", "Coding Automation", "Superhuman Coder", "Intelligence Explosion"]);
    expect(ERAS.map((e) => Math.round(e.from))).toEqual([0, 2, 5, 25]);
    expect(new Set(ERAS.map((e) => e.agents.glow)).size).toBe(4);
    // Later eras: faster events, more aggressive rivals.
    for (let i = 1; i < 4; i++) {
      expect(ERAS[i]!.pace).toBeLessThan(ERAS[i - 1]!.pace);
      expect(ERAS[i]!.rivalGrowth).toBeGreaterThan(ERAS[i - 1]!.rivalGrowth);
    }
  });

  it("has thought and headline pools per era, including the burrito agent", () => {
    for (const era of [1, 2, 3, 4]) expect(THOUGHTS.filter((t) => t.when === (`era${era}` as never)).length).toBeGreaterThanOrEqual(6);
    expect(THOUGHTS.some((t) => t.when === "era1" && t.kind === "agent" && t.text === "I ordered 400 burritos to the office. Was that the task?")).toBe(true);
  });

  it("makes the rivals more aggressive: the same week, bigger releases in a later era", () => {
    const gainIn = (era: number) => {
      const s = createInitialState(4);
      s.race.era = { value: `era${era}`, context: { peak: [1, 2, 5, 30][era - 1]! } } as never;
      setRival(s, "sirocco", "training", { weeks: 1, momentum: 1 });
      const cap = rival(s, "sirocco").context.capability;
      weekly(s, fixed(0.5));
      return rival(s, "sirocco").context.capability - cap;
    };
    expect(gainIn(4)).toBeGreaterThan(gainIn(1) * 1.5);
  });

  it("makes event cooldowns shorter in later eras", () => {
    const s = createInitialState(1);
    s.day = 70;
    s.waterDiscourse = 34;
    dailyEvents(s);
    choose(s, 0);
    // Cooldown is 60 days at pace 1; at Era 4's 0.4 the card is due again after 24.
    s.race.era = { value: "era4", context: { peak: 30 } } as never;
    s.waterDiscourse = 60;
    s.day = 70 + 25;
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("waterDiscourse");
    const t = createInitialState(1);
    t.day = 70;
    t.waterDiscourse = 34;
    dailyEvents(t);
    choose(t, 0);
    t.waterDiscourse = 60;
    t.day = 95;
    dailyEvents(t);
    expect(openEventOf(t)).toBeNull();
  });
});

describe("the open-weights drop", () => {
  /** A lab with revenue and a rival about to ship a free model at `theirs` capability (Sirocco is always open). */
  function dropSetup(theirs: number, income = 50_000) {
    const s = createInitialState(3);
    s.capability = 100;
    s.ledger = { income, expenses: 20_000, net: income - 20_000 };
    setRival(s, "sirocco", "training", { capability: theirs, weeks: 1, momentum: 1 });
    s.day = 70;
    return s;
  }

  it("fires when an open-weights rival lands within 10% of your capability: a card, and -30% revenue for 30 days", () => {
    const s = dropSetup(95);
    weekly(s, fixed(0.5));
    expect(s.race.openDrop).toMatchObject({ rival: "sirocco", until: 100 });
    expect(openDropActive(s)).toBe(true);
    expect(revenueFactor(s)).toBeCloseTo(0.7);
    expect(s.news.some((n) => n.text.includes("Sirocco") || n.text.includes("Zephyr"))).toBe(true);
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull(); // a day's grace: the leaderboard shuffles first
    s.day++;
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("openWeights");
    // 30 days later the hit is over.
    s.day = 100;
    dailyRace(s, fixed(0.5));
    expect(openDropActive(s)).toBe(false);
    expect(revenueFactor(s)).toBe(1);
  });

  it("does not fire for a rival far behind you, far ahead of you, or with nothing to lose (no revenue)", () => {
    for (const s of [dropSetup(40), dropSetup(400), dropSetup(95, 0)]) {
      weekly(s, fixed(0.5));
      expect(s.race.openDrop).toBeNull();
      expect(s.flags["offer:openWeights"]).toBeUndefined();
    }
  });

  it("does not fire for a lab that keeps its weights closed, or twice in a row", () => {
    const closed = dropSetup(95);
    setRival(closed, "macrohard", "training", { capability: 95, weeks: 1 });
    setRival(closed, "sirocco", "idle", { capability: 10 });
    weekly(closed, fixed(0.5));
    expect(closed.race.openDrop).toBeNull();
    const twice = dropSetup(95);
    weekly(twice, fixed(0.5));
    const until = twice.race.openDrop!.until;
    setRival(twice, "sirocco", "training", { capability: 95, weeks: 1 });
    twice.day = 77;
    weekly(twice, fixed(0.5));
    expect(twice.race.openDrop!.until).toBe(until);
  });

  it("Cut prices: -15% for good, and the -30% ends early", () => {
    const s = dropSetup(95);
    weekly(s, fixed(0.5));
    s.day++; // the card comes a day after the drop
    dailyEvents(s);
    const hype = s.hype;
    choose(s, 0);
    expect(s.race.priceCuts).toBe(1);
    expect(openDropActive(s)).toBe(false);
    expect(revenueFactor(s)).toBeCloseTo(0.85);
    expect(s.hype).toBeGreaterThan(hype);
    expect(s.flags["offer:openWeights"]).toBeUndefined();
  });

  it('Release last year\'s model as "open": hype up a lot, the dropping lab loses momentum, the -30% stays', () => {
    const s = dropSetup(95);
    weekly(s, fixed(0.5));
    s.day++; // the card comes a day after the drop
    dailyEvents(s);
    const hype = s.hype;
    const momentum = rival(s, "sirocco").context.momentum;
    choose(s, 1);
    expect(s.hype).toBeGreaterThanOrEqual(hype + 11);
    expect(rival(s, "sirocco").context.momentum).toBeLessThan(momentum - 0.3);
    expect(openDropActive(s)).toBe(true);
    expect(s.flags.openModel).toBeDefined();
  });

  it('"Raise safety concerns" sets the flag the Capture arc will read', () => {
    const s = dropSetup(95);
    weekly(s, fixed(0.5));
    s.day++;
    dailyEvents(s);
    choose(s, 2);
    expect(s.flags.raisedSafety).toBe(71);
    expect(openDropActive(s)).toBe(true);
  });
});

describe("poaching", () => {
  it("a lab that rolls under its poaching rate takes a researcher out of the gate, and sends the bill", () => {
    const s = createInitialState(1);
    for (let i = 0; i < 6; i++) s.walkers.push({ ...s.walkers.find((w) => w.kind === "researcher")!, id: 8000 + i });
    const cash = s.cash;
    s.day = 7;
    weekly(s, fixed(0)); // every roll is 0: everyone who poaches at all does
    expect(s.race.poached).toBeGreaterThanOrEqual(1);
    expect(s.cash).toBeLessThan(cash);
    expect(s.walkers.some((w) => w.kind === "researcher" && w.machine.value === "quitting")).toBe(true); // out of the gate with the box
  });

  it("never takes the last few researchers", () => {
    const s = createInitialState(1);
    s.walkers = s.walkers.filter((w) => w.kind !== "researcher");
    s.day = 7;
    weekly(s, fixed(0));
    expect(s.race.poached).toBe(0);
  });
});

describe("the compute auction", () => {
  const due = (seed = 1) => {
    const s = createInitialState(seed);
    layPaths(s);
    s.cash = 40_000_000;
    s.day = 40;
    dailyRace(s, createRng(1));
    return s;
  };

  it("is called about every 40 days: a card, three bids scaled to what the lab burns", () => {
    const s = createInitialState(1);
    s.day = 39;
    dailyRace(s, createRng(1));
    expect(s.flags["offer:auction"]).toBeUndefined();
    s.day = 40;
    dailyRace(s, createRng(1));
    expect(s.flags["offer:auction"]).toBe(40);
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("computeAuction");
    expect(bidAmount(s, "low")).toBeLessThan(bidAmount(s, "mid"));
    expect(bidAmount(s, "mid")).toBeLessThan(bidAmount(s, "all"));
    s.ledger = { income: 0, expenses: 400_000, net: -400_000 };
    expect(auctionUnit(s)).toBe(4_000_000);
    expect(winChance("low")).toBeLessThan(winChance("mid"));
    expect(winChance("all")).toBeGreaterThan(0.9);
  });

  it("winning unlocks the Datacenter, a Gas Turbine and a Solar Farm, and places a free 4x4 Datacenter", () => {
    const s = due();
    dailyEvents(s);
    const cash = s.cash;
    choose(s, 2); // all-in
    // (the real dice may lose an all-in about one time in twenty: settle it with a sure roll)
    if (powerOf(s).datacenters === 0) resolveAuction(s, fixed(0.01), "all");
    expect(powerOf(s).datacenters).toBe(1);
    expect(s.flags["unlocked:datacenter"]).toBeDefined();
    expect(s.flags["unlocked:gas"]).toBeDefined();
    expect(s.flags["unlocked:solar"]).toBeDefined();
    const dc = s.buildings.find((b) => b.kind === "datacenter")!;
    expect([dc.w, dc.d]).toEqual([4, 4]);
    expect(s.cash).toBeLessThan(cash); // only the winner pays
    expect(s.flags["free:datacenter"]).toBeUndefined(); // the voucher was spent on the placement
    expect(s.race.nextAuction).toBe(40 + 40);
  });

  it("losing costs nothing but the pride: no Datacenter, the rival gets stronger, the vault is untouched", () => {
    const s = due();
    const cash = s.cash;
    const before = Math.max(...s.race.rivals.map((r) => r.context.capability));
    resolveAuction(s, fixed(0.999), "low"); // the rivals' best bid tops out
    expect(powerOf(s).datacenters).toBe(0);
    expect(s.cash).toBe(cash);
    expect(s.flags["unlocked:datacenter"]).toBeUndefined();
    expect(Math.max(...s.race.rivals.map((r) => r.context.capability))).toBeGreaterThan(before);
    expect(s.news.at(-1)!.text.length).toBeGreaterThan(10);
  });

  it("hands over a free voucher when the campus has no room", () => {
    const s = due();
    s.grid.paths.fill(true); // nothing can be placed on a path: no room anywhere
    resolveAuction(s, fixed(0.01), "all");
    expect(powerOf(s).datacenters).toBe(0);
    expect(s.flags["free:datacenter"]).toBe(1);
    // ...and it is redeemable: free to place once there is room.
    s.grid.paths.fill(false);
    layPaths(s);
    expect(canPlace(s, "datacenter", 6, 5).ok || s.cash >= BUILDINGS.datacenter.price).toBe(true);
    s.cash = 0;
    let spot: [number, number] | null = null;
    for (let z = 0; z < 20 && !spot; z++) for (let x = 0; x < 20 && !spot; x++) if (canPlace(s, "datacenter", x, z).ok) spot = [x, z];
    expect(spot).not.toBeNull();
  });

  it("locked buildings can't be placed before an auction is won", () => {
    const s = createInitialState(1);
    layPaths(s);
    s.cash = 50_000_000;
    expect(canPlace(s, "datacenter", 6, 5)).toEqual({ ok: false, reason: "Win a compute auction to unlock this" });
    expect(canPlace(s, "gas", 6, 5).ok).toBe(false);
  });

  it("a Datacenter needs power: +60 compute a day with a Gas Turbine or Solar Farm, nothing without", () => {
    const s = createInitialState(1);
    const base = computePerDay(s);
    s.buildings.push({ id: 900, kind: "datacenter", x: 1, z: 1, w: 4, d: 4, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    expect(powerOf(s)).toMatchObject({ datacenters: 1, powered: 0 });
    expect(computePerDay(s)).toBe(base);
    s.buildings.push({ id: 901, kind: "gas", x: 8, z: 1, w: 2, d: 2, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    expect(datacenterCompute(s)).toBe(60);
    expect(computePerDay(s)).toBe(base + 60);
    s.buildings.push({ id: 902, kind: "datacenter", x: 1, z: 8, w: 4, d: 4, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    expect(computePerDay(s)).toBe(base + 60); // the second one has no plant yet
    s.buildings.push({ id: 903, kind: "solar", x: 12, z: 1, w: 3, d: 3, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    expect(computePerDay(s)).toBe(base + 120);
  });

  it("Gas Turbines are cheap and add to the water discourse; Solar Farms cost more and lift the hype", () => {
    expect(BUILDINGS.gas.price).toBeLessThan(BUILDINGS.solar.price);
    const s = createInitialState(1);
    const d0 = s.waterDiscourse;
    dailyDiscourse(s, createRng(1));
    const plain = s.waterDiscourse - d0;
    const g = createInitialState(1);
    g.buildings.push({ id: 901, kind: "gas", x: 8, z: 1, w: 2, d: 2, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    dailyDiscourse(g, createRng(1));
    expect(g.waterDiscourse - d0).toBeCloseTo(plain + gasDiscourse(g));
    expect(gasDiscourse(g)).toBeGreaterThan(0);
    const v = createInitialState(1);
    const rest = hypeResting(v);
    v.buildings.push({ id: 902, kind: "solar", x: 12, z: 1, w: 3, d: 3, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    expect(hypeResting(v)).toBe(rest + solarHype(v));
    expect(solarHype(v)).toBeGreaterThan(0);
  });
});

describe("funding rounds", () => {
  /** Short on runway, popular enough. */
  function broke(seed = 1) {
    const s = createInitialState(seed);
    s.cash = 600_000;
    s.hype = 55;
    s.vibes = { ...s.vibes, value: 550 };
    s.capability = 46;
    s.ledger = { income: 20_000, expenses: 90_000, net: -70_000 };
    s.day = 50;
    return s;
  }

  it("is offered when runway is under three months and the Vibes are over 400", () => {
    expect(fundingDue(broke())).toBe(true);
    const flush = broke();
    flush.cash = 40_000_000;
    expect(fundingDue(flush)).toBe(false); // runway is fine
    const meh = broke();
    meh.vibes = { ...meh.vibes, value: 300 };
    expect(fundingDue(meh)).toBe(false); // nobody wants a lab with no vibes
    const profitable = broke();
    profitable.ledger = { income: 90_000, expenses: 20_000, net: 70_000 };
    expect(fundingDue(profitable)).toBe(false);
  });

  it("puts a card on the table with a valuation from capability, hype and rank, and spaces the offers out", () => {
    const s = broke();
    dailyRace(s, createRng(1));
    expect(s.flags["offer:funding"]).toBe(50);
    dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("fundingRound");
    choose(s, 2);
    s.day = 70;
    dailyRace(s, createRng(1));
    expect(s.flags["offer:funding"]).toBeUndefined(); // 60 days between offers
    s.day = 111;
    dailyRace(s, createRng(1));
    expect(s.flags["offer:funding"]).toBe(111);

    const base = broke();
    const v0 = valuation(base);
    const smart = broke();
    smart.capability = 92;
    expect(valuation(smart)).toBeGreaterThan(v0 * 3);
    const hyped = broke();
    hyped.hype = 90;
    expect(valuation(hyped)).toBeGreaterThan(v0);
    const top = broke();
    top.capability = 600;
    refreshBoard(top);
    const low = broke();
    low.capability = 600;
    refreshBoard(low);
    low.race.board = [...low.race.board.filter((r) => r.id !== YOU), low.race.board.find((r) => r.id === YOU)!]; // same lab, but last place
    expect(valuation(top)).toBeGreaterThan(valuation(low));
  });

  it("signing brings the cash and a headline in the spec's words; the circular deal brings 60% and more hype; declining is free hype", () => {
    const sign = broke();
    sign.day = 50;
    dailyRace(sign, createRng(1));
    dailyEvents(sign);
    const raise = raiseAmount(sign);
    const cash = sign.cash;
    choose(sign, 0);
    expect(sign.cash).toBe(cash + raise);
    const line = sign.news.at(-1)!.text;
    expect(line).toMatch(/raises at \$[\d.]+[KMB] valuation on \$[\d.]+[KMB] revenue; 'it's about the future'/);
    expect(line).toContain(sign.labName);

    const circle = broke();
    dailyRace(circle, createRng(1));
    dailyEvents(circle);
    const cash2 = circle.cash;
    const hype2 = circle.hype;
    const circular = Math.round(raiseAmount(circle) * 0.6);
    choose(circle, 1);
    expect(circle.cash).toBe(cash2 + circular);
    expect(circle.hype).toBeGreaterThan(hype2 + 8);

    const no = broke();
    dailyRace(no, createRng(1));
    dailyEvents(no);
    const cash3 = no.cash;
    choose(no, 2);
    expect(no.cash).toBe(cash3);
    expect(no.hype).toBeGreaterThan(55);
  });
});

describe("the race in a running game", () => {
  it("a played game with every card answered stays deterministic: same seed, same World, and it survives JSON", () => {
    const run = () => {
      const s = createInitialState(5);
      layPaths(s);
      for (let i = 0; i < 160 * TICKS_PER_DAY; i++) tick(s, i === 30 ? [{ type: "placeBuilding", kind: "gateway", x: 6, z: 14 }] : answer(s));
      return s;
    };
    const a = run();
    expect(a.race.week).toBe(22);
    expect(run()).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(eraNumber(a.race.era)).toBeGreaterThanOrEqual(1);
  });

  it("the HUD view carries everything the panel draws", () => {
    const s = createInitialState(1);
    const v = raceView(s);
    expect(v).toMatchObject({ era: 1, eraName: "Stumbling Agents", nextAt: 2, total: 7, week: 0 });
    expect(v.board).toHaveLength(7);
    expect(v.board.filter((r) => r.you)).toHaveLength(1);
    expect(v.unlocked).toEqual([]);
    expect(v.vars.bidMid).toMatch(/^\$/);
  });
});

describe("debug moments (?moment=)", () => {
  const stageAndRun = (moment: Parameters<typeof stageMoment>[1], ticks: number) => {
    const s = createInitialState(3);
    stageMoment(s, moment);
    for (let i = 0; i < ticks; i++) tick(s);
    return s;
  };

  it("shuffle: you are #1, then a week turns, three labs pass you and Sirocco's free model opens the card", () => {
    const s = createInitialState(3);
    stageMoment(s, "shuffle");
    expect(s.race.rank).toBe(1);
    expect(s.day).toBe(13);
    for (let i = 0; i < 20; i++) tick(s);
    expect(s.race.rank).toBeGreaterThanOrEqual(3);
    expect(s.race.rankDelta).toBeLessThan(0);
    expect(s.race.openDrop?.rival).toBe("sirocco");
    for (let i = 0; i < 40 && !openEventOf(s); i++) tick(s);
    expect(openEventOf(s)?.id).toBe("openWeights");
  });

  it("era, era3, auction and funding each open their card within a second or two", () => {
    expect(openEventOf(stageAndRun("era", 20))?.id).toBe("era2");
    expect(openEventOf(stageAndRun("era3", 20))?.id).toBe("era3");
    expect(openEventOf(stageAndRun("auction", 20))?.id).toBe("computeAuction");
    expect(openEventOf(stageAndRun("funding", 20))?.id).toBe("fundingRound");
  });
});

