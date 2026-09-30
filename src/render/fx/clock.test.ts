import { describe, expect, it } from "vitest";
import { ambience, brightness, chaseHour, clockLabel, CYCLE_DAYS, CYCLE_TICKS, goldenAmount, hourAt, hourDelta, isNight, lightPosition, nightAmount, START_HOUR } from "./clock";

describe("campus clock", () => {
  it("opens at 8am and completes one cycle every thirty game days", () => {
    expect(CYCLE_DAYS).toBe(30);
    expect(hourAt(0)).toBeCloseTo(START_HOUR);
    expect(hourAt(CYCLE_TICKS)).toBeCloseTo(START_HOUR);
    expect(hourAt(CYCLE_TICKS / 2)).toBeCloseTo((START_HOUR + 12) % 24);
  });

  it("does not flip the lamps more than twice per cycle (FLT-10 slowed the cycle down from 10 days to 30)", () => {
    let flips = 0;
    let on = ambience(hourAt(0)).lampGlow > 0.5;
    for (let tick = 0; tick <= 100 * 20; tick++) {
      const now = ambience(hourAt(tick)).lampGlow > 0.5;
      if (now !== on) flips++;
      on = now;
    }
    // A hundred game days is three and a bit cycles: at most one on and one off each.
    expect(flips).toBeLessThanOrEqual(8);
  });

  it("is bright at noon and dark at 2am, with dusk and dawn in between", () => {
    expect(nightAmount(12)).toBe(0);
    expect(nightAmount(2)).toBe(1);
    expect(nightAmount(23)).toBe(1);
    expect(nightAmount(19.5)).toBeGreaterThan(0.2);
    expect(nightAmount(19.5)).toBeLessThan(0.8);
    expect(nightAmount(5.5)).toBeGreaterThan(0.2);
    expect(nightAmount(5.5)).toBeLessThan(0.8);
    expect(isNight(2)).toBe(true);
    expect(isNight(13)).toBe(false);
  });

  it("is continuous around the clock, so nothing pops (light, tint, glow)", () => {
    const a = ambience(23.999);
    const b = ambience(0);
    expect(a.night).toBeCloseTo(b.night, 3);
    expect(a.sunPos[0]).toBeCloseTo(b.sunPos[0], 1);
    // The sun sets where the moon rises and the moon sets where the sun rises.
    expect(lightPosition(17.999)[0]).toBeCloseTo(lightPosition(18)[0], 1);
    expect(lightPosition(5.999)[0]).toBeCloseTo(lightPosition(6)[0], 1);
    let prev = ambience(0);
    for (let h = 0.05; h <= 24; h += 0.05) {
      const cur = ambience(h);
      expect(Math.abs(cur.sunIntensity - prev.sunIntensity)).toBeLessThan(0.15);
      expect(Math.abs(cur.night - prev.night)).toBeLessThan(0.12);
      prev = cur;
    }
  });

  it("never gets too dark to read: night keeps at least 35% of the noon light", () => {
    const noon = brightness(ambience(12));
    for (let h = 0; h < 24; h += 0.25) expect(brightness(ambience(h))).toBeGreaterThan(noon * 0.35);
  });

  it("golden hour is a sunrise and sunset thing", () => {
    expect(goldenAmount(18.3)).toBeGreaterThan(0.6);
    expect(goldenAmount(6.4)).toBeGreaterThan(0.6);
    expect(goldenAmount(12)).toBeLessThan(0.05);
    expect(goldenAmount(2)).toBeLessThan(0.05);
  });

  it("lamps come on before the windows do", () => {
    const dusk = ambience(19.6);
    expect(dusk.lampGlow).toBeGreaterThan(dusk.windowGlow);
    expect(ambience(12).windowGlow).toBe(0);
    expect(ambience(2).windowGlow).toBe(1);
  });

  it("chases the sim's hour without ever moving faster than the cap, the short way round", () => {
    expect(hourDelta(23, 1)).toBeCloseTo(2);
    expect(hourDelta(1, 23)).toBeCloseTo(-2);
    expect(chaseHour(23, 1, 0.1, 3)).toBeCloseTo(23.3);
    expect(chaseHour(1, 23, 0.1, 3)).toBeCloseTo(0.7);
    // At 10x the target runs away; the display crawls at the cap and never jumps.
    let shown = 8;
    let target = 8;
    for (let i = 0; i < 100; i++) {
      target = (target + 12 * (1 / 60)) % 24;
      const next = chaseHour(shown, target, 1 / 60, 3);
      expect(Math.abs(hourDelta(shown, next))).toBeLessThanOrEqual(3 / 60 + 1e-9);
      shown = next;
    }
  });

  it("formats the wall clock", () => {
    expect(clockLabel(2)).toBe("2:00 am");
    expect(clockLabel(0.5)).toBe("12:30 am");
    expect(clockLabel(13.25)).toBe("1:15 pm");
  });
});
