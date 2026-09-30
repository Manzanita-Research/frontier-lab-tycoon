// FLT-39: the shortcuts past `transition()` must answer exactly as `step(machine, ...)` does: `remembered(machine)`,
// first time and every time after, and the event arcs' quiet day.
import { remembered, step } from "./run";
import { arcMachine, dayArc, quietArcDay, type ArcStored } from "./arc";
import { moodMachine, QUIT_DAYS, stepMood, type MoodStored } from "./mood";
import { staffMachine, stepStaff, type StaffStored } from "./staff";
import { progressionMachine, type ProgressionStored } from "./progression";

/** Ask twice (a miss, then a hit) and compare both with a plain step, including which keys are present. */
function same<M extends Parameters<typeof step>[0]>(machine: M, stepped: ReturnType<typeof remembered<M>>, stored: never, event: never) {
  const want = step(machine, stored, event);
  const snapshot = JSON.stringify(stored);
  for (let i = 0; i < 2; i++) {
    const got = stepped(stored, event);
    expect(got).toStrictEqual(want);
    // A copy every time: changing an answer must not change the next one, or the input.
    (got.stored as { value: unknown }).value = "scribbled";
  }
  expect(JSON.stringify(stored)).toBe(snapshot);
}

describe("remembered steps", () => {
  it("answers as the mood machine does, for every mood, count and event", () => {
    const events = ["LIFT", "SLUMP", "CRASH", "DAY"] as const;
    for (const value of ["content", "slumped", "miserable", "resigned"] as const)
      for (let days = 0; days <= QUIT_DAYS; days++)
        for (const type of events) same(moodMachine, stepMood, { value, context: { days } } satisfies MoodStored as never, { type } as never);
  });

  it("answers as the staff machine does, for every phase and event", () => {
    const events = ["ARRIVED", "TASK", "DONE", "LOST", "FIRED", "EXITED"] as const;
    for (const value of ["arriving", "idle", "going", "working", "leaving", "gone"] as const)
      for (const type of events) {
        const stored: StaffStored = { value, context: {} };
        expect(stepStaff(stored, { type })).toStrictEqual(step(staffMachine, stored, { type }).stored);
        expect(stepStaff(stored, { type })).toStrictEqual(step(staffMachine, stored, { type }).stored);
      }
  });

  it("answers as the arc machine does, for every phase, cooldown and daily check, and for picks", () => {
    const stepArc = remembered(arcMachine);
    for (const value of ["calm", "brewing", "cardOpen", "cooldown"] as const)
      for (const openedDay of [null, 0, 3, 10])
        for (const cooldownDays of [0, 5])
          for (const choices of [1, 3]) {
            const stored: ArcStored = { value, context: { choices, cooldownDays, openedDay } };
            for (const day of [0, 4, 12, 40])
              for (const ready of [false, true])
                for (const slotFree of [false, true])
                  for (const pace of [1, 0.5]) same(arcMachine, stepArc, stored as never, { type: "DAY", day, ready, slotFree, pace } as never);
            for (const choiceIndex of [-1, 0, 1.5, 2, 3]) same(arcMachine, stepArc, stored as never, { type: "CHOOSE", choiceIndex } as never);
          }
  });

  it("takes the arcs' quiet day only when the machine would leave the card as it is", () => {
    let quiet = 0;
    for (const value of ["calm", "brewing", "cardOpen", "cooldown"] as const)
      for (const openedDay of [null, 0, 3, 10])
        for (const cooldownDays of [0, 5, 7])
          for (const choices of [1, 3]) {
            const stored: ArcStored = { value, context: { choices, cooldownDays, openedDay } };
            for (const day of [0, 4, 8, 12, 13, 40])
              for (const ready of [false, true])
                for (const slotFree of [false, true])
                  for (const pace of [1, 0.5, 0.75]) {
                    const event = { type: "DAY", day, ready, slotFree, pace } as const;
                    const want = step(arcMachine, stored, event);
                    const got = quietArcDay(stored, event);
                    if (got) {
                      quiet++;
                      expect(want.effects).toEqual([]);
                      expect(got).toStrictEqual(want.stored);
                    }
                    expect(dayArc(stored, event)).toStrictEqual(want.stored);
                  }
          }
    expect(quiet).toBeGreaterThan(500); // the shortcut is taken, not just never wrong
  });

  it("lets updateProgression skip an unmet goal: the machine stays put and says nothing", () => {
    for (const value of ["growing", "complete"] as const)
      for (let level = 0; level <= 6; level++) {
        const stored: ProgressionStored = { value, context: { level } };
        const { stored: next, effects } = step(progressionMachine, stored, { type: "CHECK", met: false });
        expect(effects).toEqual([]);
        expect(next).toStrictEqual(stored);
      }
  });

  it("keeps undefined, NaN, Infinity and -0 apart in its key", () => {
    const seen: unknown[] = [];
    const echo = remembered(arcMachine);
    const at = (openedDay: number | null) => ({ value: "cooldown", context: { choices: 1, cooldownDays: 5, openedDay } }) as ArcStored;
    for (const day of [0, -0, NaN, Infinity, -Infinity]) {
      const want = step(arcMachine, at(0), { type: "DAY", day, ready: true, slotFree: true, pace: 1 });
      const got = echo(at(0), { type: "DAY", day, ready: true, slotFree: true, pace: 1 });
      expect(Object.is(got.stored.context.openedDay, want.stored.context.openedDay), String(day)).toBe(true);
      seen.push(got.stored.context.openedDay);
    }
    expect(seen).toHaveLength(5);
  });

  it("forgets everything once it is full, and still answers correctly", () => {
    const small = remembered(moodMachine, 2);
    for (let days = 0; days < 10; days++) {
      const stored: MoodStored = { value: "miserable", context: { days } };
      expect(small(stored, { type: "DAY" })).toStrictEqual(step(moodMachine, stored, { type: "DAY" }));
    }
  });
});
