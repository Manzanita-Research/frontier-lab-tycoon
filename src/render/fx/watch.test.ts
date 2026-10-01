import { describe, expect, it } from "vitest";
import { applyNow, tick } from "../../sim/tick";
import { createTestCampus as createInitialState } from "../../sim/testkit";
import { TICKS_PER_DAY } from "../../sim/constants";
import { escapeLab } from "../../sim/escape/demo";
import { catchAgent, startEscape } from "../../sim/escape/driver";
import { answer } from "../../sim/testkit";
import { createWatch, type FxEvent } from "./watch";

describe("watching the sim for juice", () => {
  it("records a baseline on the first poll and is quiet while nothing changes", () => {
    const w = createInitialState(3);
    const watch = createWatch();
    expect(watch.poll(w)).toEqual([]);
    expect(watch.poll(w)).toEqual([]);
    tick(w);
    expect(watch.poll(w).filter((e) => e.type !== "earned")).toEqual([]);
  });

  it("reports a placed building, a bulldozed one and painted paths", () => {
    const w = createInitialState(3);
    const watch = createWatch();
    watch.poll(w);
    applyNow(w, [{ type: "placeBuilding", kind: "gateway", x: 13, z: 17 }]);
    const placed = watch.poll(w);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ type: "placed", kind: "gateway", w: 2, d: 2 });

    applyNow(w, [{ type: "placePath", x: 5, z: 16 }]);
    expect(watch.poll(w)).toEqual([expect.objectContaining({ type: "path", added: true })]);

    applyNow(w, [{ type: "bulldoze", x: 13, z: 17 }]);
    expect(watch.poll(w)).toEqual([expect.objectContaining({ type: "removed", kind: "gateway" })]);
    applyNow(w, [{ type: "bulldoze", x: 5, z: 16 }]);
    expect(watch.poll(w)).toEqual([expect.objectContaining({ type: "path", added: false })]);
  });

  it("reports a release once, at the Training Hall, when a training run finishes", () => {
    const w = createInitialState(3);
    const watch = createWatch();
    watch.poll(w);
    w.compute = 400;
    (w.training.context as { progress: number }).progress = w.training.context.cost - 1;
    for (let i = 0; i < TICKS_PER_DAY; i++) tick(w);
    expect(w.models.length).toBe(1);
    const release = watch.poll(w).filter((e) => e.type === "release");
    expect(release).toHaveLength(1);
    expect(release[0]).toMatchObject({ type: "release", count: 1 });
    expect(watch.poll(w).filter((e) => e.type === "release")).toEqual([]);
  });

  it("opens and closes an incident with the event card, and pays out per gateway", () => {
    const w = createInitialState(3);
    const watch = createWatch();
    watch.poll(w);
    w.arcs[Object.keys(w.arcs)[0]!]!.value = "cardOpen";
    (w.arcs[Object.keys(w.arcs)[0]!]!.context as { openedDay: number | null }).openedDay = w.day;
    expect(watch.poll(w)).toEqual([expect.objectContaining({ type: "incident" })]);
    w.arcs[Object.keys(w.arcs)[0]!]!.value = "cooldown";
    expect(watch.poll(w)).toEqual([{ type: "incidentClosed" }]);

    w.pops.push({ id: 9999, x: 14, z: 18, amount: 80_000, tick: w.tick });
    expect(watch.poll(w)).toEqual([expect.objectContaining({ type: "earned", amount: 80_000 })]);
    expect(watch.poll(w)).toEqual([]);
  });

  it("starts over when the World is replaced", () => {
    const watch = createWatch();
    watch.poll(createInitialState(1));
    expect(watch.poll(createInitialState(2))).toEqual([{ type: "reset" }]);
  });

  it("never mutates the World it watches", () => {
    const w = createInitialState(5);
    for (let i = 0; i < 120; i++) tick(w);
    const before = JSON.stringify(w);
    const watch = createWatch();
    watch.poll(w);
    watch.poll(w);
    expect(JSON.stringify(w)).toBe(before);
  });

  it("reports the Sandbox Escape's beats: the bolt, the grab and the drop (FLT-59)", () => {
    const w = createInitialState(3);
    escapeLab(w);
    const watch = createWatch();
    watch.poll(w);
    const [r] = startEscape(w, { pace: true });
    const seen: FxEvent[] = [];
    for (let i = 0; i < 400 && r!.machine.value !== "running"; i++) {
      tick(w, answer(w));
      seen.push(...watch.poll(w));
    }
    expect(seen.filter((e) => e.type === "escape")).toEqual([expect.objectContaining({ beat: "bolt", walker: r!.walker })]);
    catchAgent(w, r!.walker);
    expect(watch.poll(w)).toEqual([expect.objectContaining({ type: "escape", beat: "grab" })]);
    const after: FxEvent[] = [];
    for (let i = 0; i < 40; i++) {
      tick(w, answer(w));
      after.push(...watch.poll(w));
    }
    expect(after.filter((e) => e.type === "escape")).toEqual([expect.objectContaining({ beat: "drop", walker: r!.walker })]);
  });
});
