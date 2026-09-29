// The mood machine on its own: transition() only.
import { initialStored, step } from "./run";
import { CONTENT, moodMachine, QUIT_DAYS, type MoodStored } from "./mood";

const send = (from: MoodStored, type: "LIFT" | "SLUMP" | "CRASH" | "DAY") => step(moodMachine, from, { type });

describe("mood machine", () => {
  it("starts content", () => {
    expect(initialStored(moodMachine, {})).toEqual(CONTENT);
  });

  it("slumps and lifts with happiness, and crashes to miserable from either", () => {
    const slumped = send(CONTENT, "SLUMP").stored;
    expect(slumped.value).toBe("slumped");
    expect(send(slumped, "LIFT").stored.value).toBe("content");
    expect(send(slumped, "CRASH").stored.value).toBe("miserable");
    expect(send(CONTENT, "CRASH").stored.value).toBe("miserable");
  });

  it("resigns on the fifth miserable day, and says so once", () => {
    let m = send(CONTENT, "CRASH").stored;
    for (let day = 1; day < QUIT_DAYS; day++) {
      const r = send(m, "DAY");
      expect(r.effects).toEqual([]);
      m = r.stored;
      expect(m.value).toBe("miserable");
      expect(m.context.days).toBe(day);
    }
    const last = send(m, "DAY");
    expect(last.stored.value).toBe("resigned");
    expect(last.effects).toEqual([{ type: "RESIGNED" }]);
  });

  it("wants five miserable days in a row: getting out of misery clears the count", () => {
    let m = send(CONTENT, "CRASH").stored;
    for (let i = 0; i < 3; i++) m = send(m, "DAY").stored;
    expect(m.context.days).toBe(3);
    m = send(m, "SLUMP").stored;
    expect(m).toEqual({ value: "slumped", context: { days: 0 } });
    m = send(m, "CRASH").stored;
    expect(m.context.days).toBe(0);
  });

  it("ignores days that aren't miserable", () => {
    expect(send(CONTENT, "DAY").stored).toEqual(CONTENT);
  });
});
