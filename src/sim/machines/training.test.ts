// The training machine on its own: transition() only, no World, no rng, no actor.
import { initialStored, step } from "./run";
import { trainingMachine, releaseGain } from "./training";

const start = { run: 1, progress: 120, cost: 300, name: "Frontier-2" };
const fresh = () => initialStored(trainingMachine, start);

describe("training machine", () => {
  it("starts in training with the run it was given", () => {
    expect(fresh()).toEqual({ value: "training", context: start });
  });

  it("banks progress each day and stays in training below the cost", () => {
    const { stored, effects } = step(trainingMachine, fresh(), { type: "DAY", halls: 1, gain: 45 });
    expect(stored.value).toBe("training");
    expect(stored.context.progress).toBe(165);
    expect(effects).toEqual([]);
  });

  it("releases when progress reaches the cost, then waits for the next name", () => {
    const { stored, effects } = step(trainingMachine, fresh(), { type: "DAY", halls: 1, gain: 180 });
    expect(stored.value).toBe("releasing");
    expect(effects).toEqual([{ type: "RELEASED", model: "Frontier-2", run: 1, gain: releaseGain(1) }]);
    const named = step(trainingMachine, stored, { type: "NAMED", name: "Frontier-3-Reasoner" });
    expect(named.stored).toEqual({ value: "training", context: { run: 2, progress: 0, cost: 900, name: "Frontier-3-Reasoner" } });
    expect(named.effects).toEqual([{ type: "RUN_STARTED", model: "Frontier-3-Reasoner" }]);
  });

  it("chains releases when one day's compute covers several runs", () => {
    const first = step(trainingMachine, { value: "training", context: { run: 1, progress: 0, cost: 10, name: "A" } }, { type: "DAY", halls: 1, gain: 1000 });
    const second = step(trainingMachine, first.stored, { type: "NAMED", name: "B" });
    expect(second.stored.value).toBe("releasing");
    expect(second.effects.map((e) => e.type)).toEqual(["RUN_STARTED", "RELEASED"]);
    expect(second.effects[1]).toEqual({ type: "RELEASED", model: "B", run: 2, gain: releaseGain(2) });
    expect(second.stored.context).toMatchObject({ run: 2, progress: 990, cost: 30 });
  });

  it("goes idle with no hall, freezes progress, and resumes when a hall returns", () => {
    const idle = step(trainingMachine, fresh(), { type: "DAY", halls: 0, gain: 0 }).stored;
    expect(idle).toEqual({ value: "idle", context: start });
    expect(step(trainingMachine, idle, { type: "DAY", halls: 0, gain: 0 }).stored).toEqual(idle);
    const back = step(trainingMachine, idle, { type: "DAY", halls: 2, gain: 30 }).stored;
    expect(back.value).toBe("training");
    expect(back.context.progress).toBe(150);
  });

  it("ignores a NAME nobody asked for", () => {
    expect(step(trainingMachine, fresh(), { type: "NAMED", name: "Nope" }).stored).toEqual(fresh());
  });
});
