// FLT-105 (pass 2): the trip's tape wow bends the whole band together, clearly (most of a semitone), and the calm
// version less. The maths of a swinging delay line, checked against itself.
import { describe, expect, it } from "vitest";
import { WOW_CALM, WOW_CENTRE, WOW_FULL, wowCentsAt, wowDelay } from "./wobble";

const peakCents = (cents: number, rate: number) => {
  const swing = wowDelay(cents, rate);
  let up = 0;
  let down = 0;
  for (let t = 0; t < 1 / rate; t += 0.001) {
    const c = wowCentsAt(swing, rate, t);
    up = Math.max(up, c);
    down = Math.min(down, c);
  }
  return { up, down };
};

describe("the tape wow", () => {
  it("bends by the cents it is asked for (sharp exactly, flat a few cents more: 1 − x is further from 1 than 1 + x)", () => {
    for (const s of [WOW_FULL, WOW_CALM]) {
      const { up, down } = peakCents(s.cents, s.rate);
      expect(up).toBeCloseTo(s.cents, 0);
      expect(-down).toBeGreaterThan(s.cents);
      expect(-down).toBeLessThan(s.cents * 1.06);
    }
  });

  it("is clearly audible on the full trip, gentler on the calm one, and slow enough to stay musical", () => {
    // Most of a semitone either way (the first pass detuned new notes by 45 cents and read as "slightly off").
    expect(WOW_FULL.cents).toBeGreaterThanOrEqual(70);
    expect(WOW_CALM.cents).toBeLessThan(WOW_FULL.cents / 2);
    expect(WOW_CALM.flutter).toBe(0);
    // A warped record, not a siren: the wow swings over seconds, the flutter is light.
    expect(1 / WOW_FULL.rate).toBeGreaterThanOrEqual(3);
    expect(WOW_FULL.flutter).toBeLessThanOrEqual(15);
  });

  it("has room in the delay line: the swing never reaches zero delay or the line's end", () => {
    for (const s of [WOW_FULL, WOW_CALM]) {
      const swing = wowDelay(s.cents, s.rate) + wowDelay(s.flutter, s.flutterRate);
      expect(WOW_CENTRE - swing).toBeGreaterThan(0.005);
      expect(WOW_CENTRE + swing).toBeLessThan(0.2);
    }
  });
});
