// The goals machine on its own: transition() only.
import { initialStored, step } from "./run";
import { SCENARIO } from "../../content/goals";
import { goalsMachine } from "./goals";

const goals = [
  { id: "release", value: 0, target: 3, met: false },
  { id: "revenue", value: 0, target: 250_000, met: false },
  { id: "hype", value: 0, target: 60, met: false },
];
const DEADLINE = SCENARIO.deadlineDay;
const fresh = () => initialStored(goalsMachine, { goals, outcomeDay: null });
const day = (stored: ReturnType<typeof fresh>, d: number, cash: number, values: Record<string, number>) => step(goalsMachine, stored, { type: "DAY", day: d, broke: cash < 0, values });

describe("goals machine", () => {
  it("starts tracking with nothing met", () => {
    expect(fresh().value).toBe("tracking");
    expect(fresh().context.goals.every((g) => !g.met)).toBe(true);
  });

  it("tracks metric values and latches a milestone once met, even if the metric falls back", () => {
    const a = day(fresh(), 10, 1e6, { release: 1, revenue: 1000, hype: 65 });
    expect(a.stored.value).toBe("tracking");
    expect(a.stored.context.goals.map((g) => [g.value, g.met])).toEqual([[1, false], [1000, false], [65, true]]);
    const b = day(a.stored, 11, 1e6, { release: 1, revenue: 1000, hype: 20 });
    expect(b.stored.context.goals[2]).toMatchObject({ value: 65, met: true }); // latched: never drops below what it reached
    expect(b.effects).toEqual([]);
    expect(a.effects).toEqual([{ type: "MET", id: "hype", done: 1, total: 3 }]);
  });

  it("wins the day the last milestone lands, and records the day", () => {
    const r = day(fresh(), 200, 1e6, { release: 3, revenue: 300_000, hype: 70 });
    expect(r.stored.value).toBe("won");
    expect(r.stored.context.outcomeDay).toBe(200);
    expect(r.effects.at(-1)).toEqual({ type: "WON", day: 200 });
  });

  it("loses at the deadline unless it was already won", () => {
    expect(day(fresh(), DEADLINE - 1, 1e6, {}).stored.value).toBe("tracking");
    const r = day(fresh(), DEADLINE, 1e6, {});
    expect(r.stored.value).toBe("lost");
    expect(r.effects).toEqual([{ type: "LOST", day: DEADLINE }]);
    expect(day(fresh(), DEADLINE, 1e6, { release: 3, revenue: 250_000, hype: 60 }).stored.value).toBe("won");
  });

  it("loses the day the economy goes bankrupt (FLT-86: the bank called), not at any cash floor", () => {
    expect(step(goalsMachine, fresh(), { type: "DAY", day: 40, broke: true, values: {} }).stored.value).toBe("lost");
    expect(step(goalsMachine, fresh(), { type: "DAY", day: 40, broke: false, values: {} }).stored.value).toBe("tracking");
  });

  it("says when each goal lands and when only one is left: the final stretch", () => {
    const a = day(fresh(), 10, 1, { release: 3 });
    expect(a.effects).toEqual([{ type: "MET", id: "release", done: 1, total: 3 }]);
    const b = day(a.stored, 11, 1, { hype: 60 });
    expect(b.effects).toEqual([{ type: "MET", id: "hype", done: 2, total: 3 }, { type: "STRETCH", id: "revenue" }]);
    expect(day(b.stored, 12, 1, {}).effects).toEqual([]); // said once
    // Two at once still gets the stretch; all three at once is just the win.
    expect(day(fresh(), 10, 1, { release: 3, hype: 60 }).effects.at(-1)).toEqual({ type: "STRETCH", id: "revenue" });
    expect(day(fresh(), 10, 1, { release: 3, hype: 60, revenue: 250_000 }).effects.map((e) => e.type)).toEqual(["MET", "MET", "MET", "WON"]);
  });
});

describe("a goal held for days (FLT-86)", () => {
  const held = () => initialStored(goalsMachine, { goals: [{ id: "arena", value: 0, target: 5, met: false, hold: 3, held: 0 }], outcomeDay: null });
  const at = (stored: ReturnType<typeof held>, d: number, v: number) => step(goalsMachine, stored, { type: "DAY", day: d, broke: false, values: { arena: v } });

  it("counts the days in a row at the target and is met on the last", () => {
    const one = at(held(), 1, 5);
    expect(one.effects).toEqual([{ type: "HOLDING", id: "arena", hold: 3 }]);
    expect(one.stored.context.goals[0]).toMatchObject({ held: 1, met: false });
    const two = at(one.stored, 2, 6);
    expect(two.stored.context.goals[0]).toMatchObject({ held: 2, met: false });
    const three = at(two.stored, 3, 5);
    expect(three.stored.value).toBe("won");
    expect(three.effects).toEqual([{ type: "MET", id: "arena", done: 1, total: 1 }, { type: "WON", day: 3 }]);
  });

  it("slipping off the target starts the count again, and says so", () => {
    const two = at(at(held(), 1, 5).stored, 2, 5).stored;
    const slip = at(two, 3, 4);
    expect(slip.effects).toEqual([{ type: "SLIPPED", id: "arena", held: 2 }]);
    expect(slip.stored.context.goals[0]).toMatchObject({ held: 0, met: false });
    expect(at(slip.stored, 4, 2).effects).toEqual([]); // still off: said once
  });
});
