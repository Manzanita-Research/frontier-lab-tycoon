// The arc machine on its own: transition() only.
import { initialStored, step } from "./run";
import { arcMachine } from "./arc";

const fresh = () => initialStored(arcMachine, { choices: 3, cooldownDays: 60, openedDay: null });
const day = (stored: ReturnType<typeof fresh>, d: number, ready: boolean, slotFree = true) => step(arcMachine, stored, { type: "DAY", day: d, ready, slotFree });

describe("event arc machine", () => {
  it("waits in calm until its condition holds", () => {
    expect(day(fresh(), 10, false).stored.value).toBe("calm");
  });

  it("opens its card the day the condition holds and the screen is free, and remembers the day", () => {
    expect(day(fresh(), 61, true).stored).toEqual({ value: "cardOpen", context: { choices: 3, cooldownDays: 60, openedDay: 61 } });
  });

  it("brews when another card has the screen, opens once it is free, and drops back if the condition fades", () => {
    const brewing = day(fresh(), 70, true, false).stored;
    expect(brewing.value).toBe("brewing");
    expect(day(brewing, 71, true, true).stored).toMatchObject({ value: "cardOpen", context: { openedDay: 71 } });
    expect(day(brewing, 71, false, true).stored.value).toBe("calm");
  });

  it("ignores the daily check while its card is open", () => {
    const open = day(fresh(), 61, true).stored;
    expect(day(open, 62, true).stored).toEqual(open);
  });

  it("resolves a valid pick into a cooldown and emits it; ignores a pick that does not exist", () => {
    const open = day(fresh(), 61, true).stored;
    const bad = [-1, 3, 1.5, 7].map((choiceIndex) => step(arcMachine, open, { type: "CHOOSE", choiceIndex }));
    for (const r of bad) {
      expect(r.stored).toEqual(open);
      expect(r.effects).toEqual([]);
    }
    const ok = step(arcMachine, open, { type: "CHOOSE", choiceIndex: 2 });
    expect(ok.stored.value).toBe("cooldown");
    expect(ok.effects).toEqual([{ type: "RESOLVED", choiceIndex: 2 }]);
  });

  it("stays quiet for the cooldown, then re-arms and can open again the very same day", () => {
    const cooling = step(arcMachine, day(fresh(), 70, true).stored, { type: "CHOOSE", choiceIndex: 0 }).stored;
    expect(day(cooling, 129, true).stored.value).toBe("cooldown");
    expect(day(cooling, 130, true).stored).toMatchObject({ value: "cardOpen", context: { openedDay: 130 } });
    expect(day(cooling, 130, false).stored.value).toBe("calm");
  });

  it("ignores a pick when no card is open", () => {
    expect(step(arcMachine, fresh(), { type: "CHOOSE", choiceIndex: 0 }).effects).toEqual([]);
  });
});
