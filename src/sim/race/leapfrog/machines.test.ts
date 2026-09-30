// Release Leapfrog's five machines on their own: transition() only, no World, no rng. Plus xstate/graph reachability.
import type { AnyStateMachine } from "xstate";
import { getAdjacencyMap } from "xstate/graph";
import { initialStored, step } from "../../machines/run";
import { rivalMachine } from "../rival";
import { benchMachine, scoreFor } from "./benchmark";
import { calendarMachine, nextGap } from "./calendar";
import { livestreamMachine } from "./livestream";
import { responseMachine } from "./response";
import { sharesOf, shareOf, voiceMachine } from "./voice";

const byValue = { serializeState: (s: { value: unknown }) => JSON.stringify(s.value) };

/** Explore `machine` and return what it reaches and which reached, non-final states lead nowhere. */
function explore(machine: AnyStateMachine, options: Record<string, unknown>) {
  const map = getAdjacencyMap(machine as never, { ...byValue, ...options } as never) as unknown as Record<string, { state: { value: string }; transitions: Record<string, { state: { value: string } }> }>;
  const reached = Object.values(map).map((n) => n.state.value);
  const deadEnds = Object.values(map)
    .filter((n) => (machine.states[n.state.value] as { type?: string } | undefined)?.type !== "final")
    .filter((n) => Object.values(n.transitions).every((t) => t.state.value === n.state.value))
    .map((n) => n.state.value);
  return { reached, deadEnds, unreachable: Object.keys(machine.states).filter((s) => !reached.includes(s)) };
}

describe("the release calendar", () => {
  const input = { daysLeft: 3, gapMin: 8, gapMax: 12, minGap: 3, leads: 0, answers: 0 };
  const day = (over: Record<string, number> = {}) => ({ type: "DAY" as const, gapRoll: 0.5, pairRoll: 0.99, pace: 1, pairChance: 0.5, ...over });

  it("counts down at midnight and launches on the last day, then starts a new countdown of eight to twelve days", () => {
    let s = initialStored(calendarMachine, input);
    let r = step(calendarMachine, s, day());
    expect(r.effects).toEqual([]);
    expect(r.stored.context.daysLeft).toBe(2);
    s = r.stored;
    r = step(calendarMachine, s, day());
    s = r.stored;
    r = step(calendarMachine, s, day({ gapRoll: 0 }));
    expect(r.effects).toEqual([{ type: "DROP", slot: "lead" }]);
    expect(r.stored.value).toBe("quiet");
    expect(r.stored.context.daysLeft).toBe(8);
    expect(r.stored.context.leads).toBe(1);
    expect(step(calendarMachine, initialStored(calendarMachine, { ...input, daysLeft: 1 }), day({ gapRoll: 0.999 })).stored.context.daysLeft).toBe(12);
  });

  it("answers the next day when the pair die says so: one lab drops, the next day another one does", () => {
    const first = step(calendarMachine, initialStored(calendarMachine, { ...input, daysLeft: 1 }), day({ pairRoll: 0.1 }));
    expect(first.effects).toEqual([{ type: "DROP", slot: "lead" }]);
    expect(first.stored.value).toBe("answering");
    const second = step(calendarMachine, first.stored, day({ gapRoll: 0.5 }));
    expect(second.effects).toEqual([{ type: "DROP", slot: "answer" }]);
    expect(second.stored.value).toBe("quiet");
    expect(second.stored.context).toMatchObject({ leads: 1, answers: 1, daysLeft: 10 });
  });

  it("tightens with the era, and never runs faster than the floor", () => {
    const c = { ...input, leads: 0, answers: 0, daysLeft: 0 };
    const gaps = [1, 0.85, 0.7, 0.55].map((pace) => nextGap(c, { gapRoll: 0.5, pace }));
    expect(gaps).toEqual([10, 9, 7, 6]);
    expect(nextGap(c, { gapRoll: 0, pace: 0.1 })).toBe(3);
  });

  it("reaches both states and loops forever (no dead ends)", () => {
    const events = [0, 0.99].flatMap((pairRoll) => [0, 0.5, 0.99].map((gapRoll) => ({ type: "DAY" as const, gapRoll, pairRoll, pace: 1, pairChance: 0.5 })));
    const r = explore(calendarMachine, { input: { ...input, daysLeft: 1 }, events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });
});

describe("a benchmark", () => {
  const input = { id: "mmlu", best: 60, holder: "openish", introduced: 0, crowdedAt: 91, solvedAt: 96.5, retireAfter: 3, solvedDay: -1, claims: 0 };
  const fresh = () => initialStored(benchMachine, input);

  it("a record is a SOTA claim (beating your own score counts, a rounding error does not)", () => {
    const r = step(benchMachine, fresh(), { type: "SCORES", best: 66, holder: "anthro", day: 5 });
    expect(r.effects).toEqual([{ type: "SOTA", id: "mmlu", lab: "anthro", score: 66, prev: 60, prevHolder: "openish" }]);
    expect(r.stored.context).toMatchObject({ best: 66, holder: "anthro", claims: 1 });
    expect(step(benchMachine, fresh(), { type: "SCORES", best: 60.01, holder: "openish", day: 5 }).effects).toEqual([]);
    const own = step(benchMachine, fresh(), { type: "SCORES", best: 64, holder: "openish", day: 5 });
    expect(own.effects).toMatchObject([{ type: "SOTA", lab: "openish", prevHolder: "openish" }]);
  });

  it("goes live -> crowded -> saturated as the best score nears 100, announcing each once", () => {
    let s = fresh();
    let r = step(benchMachine, s, { type: "SCORES", best: 92, holder: "a", day: 10 });
    expect(r.stored.value).toBe("crowded");
    expect(r.effects.map((e) => e.type)).toEqual(["SOTA", "CROWDED"]);
    s = r.stored;
    r = step(benchMachine, s, { type: "SCORES", best: 93, holder: "b", day: 11 });
    expect(r.effects.map((e) => e.type)).toEqual(["SOTA"]); // already crowded: not news again
    r = step(benchMachine, r.stored, { type: "SCORES", best: 97, holder: "b", day: 12 });
    expect(r.stored.value).toBe("saturated");
    expect(r.effects.map((e) => e.type)).toEqual(["SOTA", "SATURATED"]);
    expect(r.stored.context.solvedDay).toBe(12);
  });

  it("can jump straight to saturated, and a solved benchmark takes no more claims and retires after its moment", () => {
    let r = step(benchMachine, fresh(), { type: "SCORES", best: 99, holder: "x", day: 20 });
    expect(r.stored.value).toBe("saturated");
    r = step(benchMachine, r.stored, { type: "SCORES", best: 99.9, holder: "y", day: 21 });
    expect(r.effects).toEqual([]);
    expect(r.stored.context.holder).toBe("x");
    r = step(benchMachine, r.stored, { type: "DAY", day: 22 });
    expect(r.stored.value).toBe("saturated");
    r = step(benchMachine, r.stored, { type: "DAY", day: 23 });
    expect(r.stored.value).toBe("retired");
    expect(r.effects).toEqual([{ type: "RETIRED", id: "mmlu" }]);
  });

  it("a claim that was beaten or withdrawn can lower the best, without taking a state back", () => {
    const crowded = step(benchMachine, fresh(), { type: "SCORES", best: 92, holder: "a", day: 3 }).stored;
    const r = step(benchMachine, crowded, { type: "SCORES", best: 80, holder: "b", day: 4 });
    expect(r.stored.value).toBe("crowded");
    expect(r.stored.context.best).toBe(80);
    expect(r.effects).toEqual([]);
  });

  it("scores rise with capability: 50% at the difficulty, toward 100 as it grows; Elo keeps climbing", () => {
    const d = { difficulty: 50, kind: "score" as const };
    expect(scoreFor(d, 2, 50, 1, 0)).toBeCloseTo(50);
    expect(scoreFor(d, 2, 100, 1, 0)).toBeCloseTo(80);
    expect(scoreFor(d, 2, 500, 1, 0)).toBeGreaterThan(98);
    expect(scoreFor(d, 2, 50, 1.2, 0)).toBeGreaterThan(scoreFor(d, 2, 50, 1, 0)); // a lab that is good at it
    const elo = { difficulty: 0, kind: "elo" as const };
    expect(scoreFor(elo, 2, 100, 1, 50)).toBe(1475);
    expect(scoreFor(elo, 2, 1000, 1, 50)).toBeGreaterThan(5000);
  });

  it("reaches live, crowded, saturated and retired, and only retired is a dead end", () => {
    const events = [10, 65, 92, 97, 99].flatMap((best) => [5, 30].map((day) => ({ type: "SCORES" as const, best, holder: "x", day })));
    events.push(...[5, 30, 500].map((day) => ({ type: "DAY", day }) as never));
    const r = explore(benchMachine, { input, events });
    expect(r.unreachable).toEqual([]);
    expect(Object.entries(benchMachine.states).filter(([, s]) => (s as { type?: string }).type === "final").map(([k]) => k)).toEqual(["retired"]);
  });
});

describe("the news cycle", () => {
  const rules = { decay: 0.85, ownShare: 0.32, ownLead: 1.3, keepShare: 0.24 };
  // Five labs: with an even split each has 20%, under the 24% it takes to keep the room.
  const base = { a: 3, b: 3, c: 3, d: 3, e: 3 };
  const fresh = () => initialStored(voiceMachine, { attention: { a: 20, b: 20, c: 20, d: 20, e: 20 }, owner: "", streak: 0 });
  const day = () => ({ type: "DAY" as const, ...rules, baselines: base });

  it("shares add up to one; a push moves attention and a negative push cannot go below zero", () => {
    let s = fresh();
    expect(sharesOf(s.context).reduce((n, x) => n + x.share, 0)).toBeCloseTo(1);
    s = step(voiceMachine, s, { type: "PUSH", lab: "a", amount: 60 }).stored;
    expect(shareOf(s.context, "a")).toBeCloseTo(80 / 160); // 20 + 60 of 5 x 20 + 60
    s = step(voiceMachine, s, { type: "PUSH", lab: "b", amount: -500 }).stored;
    expect(s.context.attention.b).toBe(0);
  });

  it("a big launch owns the cycle, keeps it while the share holds, and loses it as attention decays", () => {
    let s = step(voiceMachine, fresh(), { type: "PUSH", lab: "a", amount: 120 }).stored;
    let r = step(voiceMachine, s, day());
    expect(r.effects).toEqual([{ type: "OWNED", lab: "a", share: expect.any(Number), from: "" }]);
    expect(r.stored.value).toBe("owned");
    s = r.stored;
    const held: string[] = [];
    for (let i = 0; i < 20 && s.value === "owned"; i++) {
      r = step(voiceMachine, s, day());
      s = r.stored;
      held.push(s.value as string);
    }
    expect(held.filter((v) => v === "owned").length).toBeGreaterThan(2); // it lasts a few days
    expect(s.value).toBe("contested");
    expect(r.effects).toEqual([{ type: "LOST", lab: "a" }]);
  });

  it("another lab with a clear lead takes the cycle over on the day", () => {
    let s = step(voiceMachine, fresh(), { type: "PUSH", lab: "a", amount: 120 }).stored;
    s = step(voiceMachine, s, day()).stored;
    s = step(voiceMachine, s, { type: "PUSH", lab: "b", amount: 600 }).stored;
    const r = step(voiceMachine, s, day());
    expect(r.effects.map((e) => e.type)).toEqual(["LOST", "OWNED"]);
    expect(r.stored.context.owner).toBe("b");
  });

  it("reaches both states (the explorer keys states by value alone, so the loop back is covered by the tests above)", () => {
    const r = explore(voiceMachine, { input: { attention: { a: 200, b: 20, c: 20, d: 20, e: 20 }, owner: "", streak: 0 }, events: [day()] });
    expect(r.unreachable).toEqual([]);
    expect(Object.keys(voiceMachine.states).sort()).toEqual(["contested", "owned"]);
  });
});

describe("the forced response", () => {
  const input = { lastOffer: -999, holdUntil: 0, offers: 0, ships: 0, holds: 0, leaks: 0, counters: 0 };
  const drop = (over: Record<string, unknown> = {}) => ({ type: "DROP" as const, day: 40, eligible: true, gapDays: 14, ...over });
  const fresh = () => initialStored(responseMachine, input);

  it("offers a card on a drop when you are mid-run, and only then", () => {
    expect(step(responseMachine, fresh(), drop({ eligible: false })).effects).toEqual([]);
    const r = step(responseMachine, fresh(), drop());
    expect(r.effects).toEqual([{ type: "OFFER" }]);
    expect(r.stored.value).toBe("offered");
    expect(r.stored.context).toMatchObject({ lastOffer: 40, offers: 1 });
  });

  it("spaces the cards out: not again within the gap", () => {
    const s = step(responseMachine, step(responseMachine, fresh(), drop()).stored, { type: "PICK", pick: "leak", day: 40, holdDays: 45 }).stored;
    expect(s.value).toBe("idle");
    expect(step(responseMachine, s, drop({ day: 50 })).effects).toEqual([]);
    expect(step(responseMachine, s, drop({ day: 54 })).effects).toEqual([{ type: "OFFER" }]);
  });

  it("ship and leak go back to idle; hold waits for your next launch", () => {
    const offered = step(responseMachine, fresh(), drop()).stored;
    const ship = step(responseMachine, offered, { type: "PICK", pick: "ship", day: 40, holdDays: 45 });
    expect(ship.effects).toEqual([{ type: "SHIPPED" }]);
    expect(ship.stored.value).toBe("idle");
    const hold = step(responseMachine, offered, { type: "PICK", pick: "hold", day: 40, holdDays: 45 });
    expect(hold.effects).toEqual([{ type: "HELD", until: 85 }]);
    expect(hold.stored.value).toBe("holding");
    const counter = step(responseMachine, hold.stored, { type: "RELEASED", day: 60, strong: true });
    expect(counter.effects).toEqual([{ type: "COUNTER", strong: true }]);
    expect(counter.stored.value).toBe("idle");
    expect(step(responseMachine, hold.stored, { type: "RELEASED", day: 60, strong: false }).effects).toEqual([{ type: "COUNTER", strong: false }]);
  });

  it("a hold that runs out is over; a run that finishes before the card is answered withdraws the offer; a stale pick does nothing", () => {
    const held = step(responseMachine, step(responseMachine, fresh(), drop()).stored, { type: "PICK", pick: "hold", day: 40, holdDays: 45 }).stored;
    expect(step(responseMachine, held, { type: "DAY", day: 84 }).effects).toEqual([]);
    expect(step(responseMachine, held, { type: "DAY", day: 85 })).toMatchObject({ effects: [{ type: "EXPIRED" }], stored: { value: "idle" } });
    const offered = step(responseMachine, fresh(), drop()).stored;
    expect(step(responseMachine, offered, { type: "RELEASED", day: 41, strong: false })).toMatchObject({ effects: [{ type: "WITHDRAWN" }], stored: { value: "idle" } });
    expect(step(responseMachine, fresh(), { type: "PICK", pick: "ship", day: 1, holdDays: 45 }).effects).toEqual([]);
  });

  it("reaches idle, offered and holding, and loops (no dead ends)", () => {
    const events = [
      drop(),
      drop({ eligible: false }),
      { type: "PICK" as const, pick: "ship" as const, day: 40, holdDays: 45 },
      { type: "PICK" as const, pick: "hold" as const, day: 40, holdDays: 45 },
      { type: "PICK" as const, pick: "leak" as const, day: 40, holdDays: 45 },
      { type: "RELEASED" as const, day: 50, strong: true },
      { type: "DAY" as const, day: 500 },
    ];
    const r = explore(responseMachine, { input, events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });
});

describe("the launch livestream", () => {
  const input = { since: -1, streams: 0, mishaps: 0, kind: "" };
  it("airs when you launch, remembers the mishap, and is over a day later", () => {
    const flawless = step(livestreamMachine, initialStored(livestreamMachine, input), { type: "GO", day: 10, ok: true, kind: "dog" });
    expect(flawless.effects).toEqual([{ type: "AIRED", ok: true, kind: "dog" }]);
    expect(flawless.stored.context).toMatchObject({ streams: 1, mishaps: 0, kind: "" });
    const mishap = step(livestreamMachine, initialStored(livestreamMachine, input), { type: "GO", day: 10, ok: false, kind: "dog" });
    expect(mishap.stored.context).toMatchObject({ streams: 1, mishaps: 1, kind: "dog" });
    expect(mishap.stored.value).toBe("live");
    expect(step(livestreamMachine, mishap.stored, { type: "GO", day: 10, ok: false, kind: "hotMic" }).effects).toEqual([]); // one stream at a time
    expect(step(livestreamMachine, mishap.stored, { type: "DAY", day: 10 }).stored.value).toBe("live");
    expect(step(livestreamMachine, mishap.stored, { type: "DAY", day: 11 }).stored.value).toBe("idle");
  });

  it("reaches idle and live and loops (no dead ends)", () => {
    const events = [{ type: "GO" as const, day: 10, ok: false, kind: "dog" }, { type: "DAY" as const, day: 12 }];
    const r = explore(livestreamMachine, { input, events });
    expect(r.unreachable).toEqual([]);
    expect(r.deadEnds).toEqual([]);
  });
});

describe("a rival's model held for its launch date", () => {
  const ctx = { id: "sirocco", personality: { cadence: 5, growth: 7, openness: 1, poaching: 0, hypeHunger: 1.1 }, capability: 20, hype: 40, baseHype: 40, weeks: 1, releases: 2, open: false, momentum: 1, model: "Zephyr-2", lastRelease: 3 };
  const week = (hold: boolean) => ({ type: "WEEK" as const, week: 9, aggro: 1, pace: 1, chase: 1, lengthRoll: 0.5, gainRoll: 0.5, openRoll: 0.5, poachRoll: 0.99, name: "Zephyr-3", hold });

  it("finishes training without shipping: FINISHED carries the gain, and nothing about the lab changes", () => {
    const s = { value: "training", context: ctx } as never;
    const r = step(rivalMachine, s, week(true));
    expect(r.effects).toEqual([{ type: "FINISHED", id: "sirocco", model: "Zephyr-3", gain: 7, open: true, hype: 9 * 1.1 }]);
    expect(r.stored.context).toMatchObject({ capability: 20, hype: 40, model: "Zephyr-2", releases: 2, lastRelease: 3 });
    expect(r.stored.value).toBe("releasing");
    // Not held: it ships, as it always did.
    const shipped = step(rivalMachine, s, week(false));
    expect(shipped.effects).toMatchObject([{ type: "RELEASED", model: "Zephyr-3" }]);
    expect(shipped.stored.context.capability).toBe(27);
  });

  it("LAUNCH ships it from any state: capability, hype, model, release count and open weights all update", () => {
    for (const value of ["idle", "training", "releasing", "cooldown"]) {
      const r = step(rivalMachine, { value, context: ctx } as never, { type: "LAUNCH", week: 10, model: "Zephyr-3", gain: 7, hype: 9.9, open: true });
      expect(r.stored.value).toBe(value);
      expect(r.stored.context).toMatchObject({ capability: 27, hype: 49.9, model: "Zephyr-3", releases: 3, open: true, lastRelease: 10 });
      expect(r.effects).toEqual([{ type: "RELEASED", id: "sirocco", model: "Zephyr-3", gain: 7, open: true, capability: 27 }]);
    }
  });
});
