// FLT-39: `remembered(machine)` must answer exactly as `step(machine, ...)` does, first time and every time after.
import { remembered, step } from "./run";
import { arcMachine, stepArc, type ArcStored } from "./arc";
import { moodMachine, QUIT_DAYS, stepMood, type MoodStored } from "./mood";
import { staffMachine, stepStaff, type StaffStored } from "./staff";

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
