// The campus clock, the part the sim needs: which hour it is and whether it is night. Pure. The lighting that hangs
// off it (colours, lamps, the sky) stays in render/fx/clock.ts, which re-exports these.
//
// One day/night cycle lasts CYCLE_DAYS game days (FLT-10 slowed it from 10 to 30: at one day every two seconds the lamps
// were flipping too often). FLT-16 makes each game day six seconds. The game opens at 8am.
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

/** Six-hour dawn and dusk: each gently blends over a quarter of the cycle. */
export function nightAmount(hour: number): number {
  return hour >= 12 ? smooth(16, 22, hour) : 1 - smooth(2, 8, hour);
}

/** Night is when the thought pool changes its tune (the campus is lit and someone is still shipping). */
export const isNight = (hour: number) => nightAmount(hour) > 0.6;
