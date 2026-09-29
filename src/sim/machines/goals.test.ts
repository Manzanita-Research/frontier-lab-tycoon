// The goals machine on its own: transition() only.
import { initialStored, step } from "./run";
import { goalsMachine } from "./goals";

const goals = [
  { id: "release", value: 0, target: 3, met: false },
  { id: "revenue", value: 0, target: 250_000, met: false },
  { id: "hype", value: 0, target: 60, met: false },
];
const fresh = () => initialStored(goalsMachine, { goals, outcomeDay: null });
const day = (stored: ReturnType<typeof fresh>, d: number, cash: number, values: Record<string, number>) => step(goalsMachine, stored, { type: "DAY", day: d, cash, values });

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
  });

  it("wins the day the last milestone lands, and records the day", () => {
    const r = day(fresh(), 200, 1e6, { release: 3, revenue: 300_000, hype: 70 });
    expect(r.stored.value).toBe("won");
    expect(r.stored.context.outcomeDay).toBe(200);
    expect(r.effects).toEqual([{ type: "WON", day: 200 }]);
  });

  it("loses at the deadline unless it was already won", () => {
    expect(day(fresh(), 359, 1e6, {}).stored.value).toBe("tracking");
    const r = day(fresh(), 360, 1e6, {});
    expect(r.stored.value).toBe("lost");
    expect(r.effects).toEqual([{ type: "LOST", day: 360 }]);
    expect(day(fresh(), 360, 1e6, { release: 3, revenue: 250_000, hype: 60 }).stored.value).toBe("won");
  });

  it("loses when cash sinks below the floor", () => {
    expect(day(fresh(), 40, -2_000_001, {}).stored.value).toBe("lost");
    expect(day(fresh(), 40, -2_000_000, {}).stored.value).toBe("tracking");
  });
});
