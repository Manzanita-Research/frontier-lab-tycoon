import { describe, expect, it } from "vitest";
import { applyNow } from "../../sim/tick";
import { createInitialState } from "../../sim/state";
import { currentLoad, fanSpeed, loadOf } from "./utilisation";

describe("cluster utilisation", () => {
  it("the opening campus is over capacity: one hall wants 15, one cluster makes 10, and the stockpile is empty", () => {
    const w = createInitialState(1);
    const load = loadOf(w);
    expect(load).toMatchObject({ clusters: 1, halls: 1, supply: 10, demand: 15, over: true });
    expect(fanSpeed(load)).toBeGreaterThan(12);
  });

  it("a second cluster (or a full stockpile) calms it down", () => {
    const w = createInitialState(1);
    applyNow(w, [{ type: "placeBuilding", kind: "cluster", x: 7, z: 14 }]);
    expect(w.buildings.filter((b) => b.kind === "cluster")).toHaveLength(2);
    expect(loadOf(w).over).toBe(false);
    const w2 = createInitialState(1);
    w2.compute = 200;
    expect(loadOf(w2).over).toBe(false);
  });

  it("no hall, no demand: the fans idle", () => {
    const w = createInitialState(1);
    w.buildings = w.buildings.filter((b) => b.kind !== "hall");
    const load = loadOf(w);
    expect(load.over).toBe(false);
    expect(fanSpeed(load)).toBeCloseTo(1.5);
  });

  it("memoises per tick", () => {
    const w = createInitialState(1);
    expect(currentLoad(w)).toBe(currentLoad(w));
  });
});
