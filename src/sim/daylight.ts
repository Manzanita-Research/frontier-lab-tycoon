// The campus clock, the part the sim needs: which hour it is and whether it is night. Pure. The lighting that hangs
// off it (colours, lamps, the sky) stays in render/fx/clock.ts, which re-exports these.
//
// One day/night cycle lasts CYCLE_DAYS game days (FLT-10 slowed it from 10 to 30: at one day every two seconds the lamps
// were flipping too often). The game opens at 8am. Everything is a smooth function of the hour.
import { TICKS_PER_DAY } from "./constants";

export const CYCLE_DAYS = 30;
export const CYCLE_TICKS = CYCLE_DAYS * TICKS_PER_DAY;
export const START_HOUR = 8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Hour of day in [0, 24) for a (fractional) sim tick. */
export function hourAt(tick: number): number {
  const h = (START_HOUR + (tick / CYCLE_TICKS) * 24) % 24;
  return h < 0 ? h + 24 : h;
}

/** 0 in daylight, 1 at night: dusk 18:30 to 21:00, dawn 4:30 to 7:00. */
export function nightAmount(hour: number): number {
  return hour >= 12 ? smooth(18.5, 21, hour) : 1 - smooth(4.5, 7, hour);
}

/** Night is when the thought pool changes its tune (the campus is lit and someone is still shipping). */
export const isNight = (hour: number) => nightAmount(hour) > 0.6;
