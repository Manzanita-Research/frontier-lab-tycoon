// The campus clock. Pure: game tick in, lighting out. Nothing here imports three, so it is unit-tested directly.
//
// One day/night cycle lasts CYCLE_DAYS game days. The game opens at 8am. Everything is a smooth function of the
// hour, so a paused game holds still and a 10x game can be low-passed by the caller (see `chaseHour`).
import { TICKS_PER_DAY } from "../../sim/constants";

export const CYCLE_DAYS = 10;
export const CYCLE_TICKS = CYCLE_DAYS * TICKS_PER_DAY;
export const START_HOUR = 8;

export type RGB = readonly [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** "#rrggbb" to 0..1 sRGB. */
export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const css = (c: RGB) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

/** Hour of day in [0, 24) for a (fractional) sim tick. */
export function hourAt(tick: number): number {
  const h = (START_HOUR + (tick / CYCLE_TICKS) * 24) % 24;
  return h < 0 ? h + 24 : h;
}

/** Wall-clock label, "2:05 am". */
export function clockLabel(hour: number): string {
  const total = Math.floor(hour * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** 0 in daylight, 1 at night: dusk 18:30 to 21:00, dawn 4:30 to 7:00. */
export function nightAmount(hour: number): number {
  return hour >= 12 ? smooth(18.5, 21, hour) : 1 - smooth(4.5, 7, hour);
}

/** Bumps at sunrise and sunset, fading as the night takes over. */
export function goldenAmount(hour: number): number {
  const bump = (c: number, w: number) => Math.exp(-(((hour - c) / w) ** 2));
  return Math.max(bump(6.4, 1.1), bump(18.3, 1.4)) * (1 - nightAmount(hour) * 0.7);
}

/** The shortest signed distance from hour `a` to hour `b` around the clock. */
export function hourDelta(a: number, b: number): number {
  return ((((b - a) % 24) + 36) % 24) - 12;
}

/**
 * Low-pass the displayed hour: it follows the sim's hour but never moves faster than `maxRate` hours per second,
 * so at 10x speed the campus drifts through dusk and dawn instead of strobing.
 */
export function chaseHour(shown: number, target: number, dt: number, maxRate: number): number {
  const d = hourDelta(shown, target);
  const step = Math.sign(d) * Math.min(Math.abs(d), maxRate * dt);
  return (shown + step + 24) % 24;
}

export interface Ambience {
  hour: number;
  night: number;
  golden: number;
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;
  sunColor: RGB;
  sunIntensity: number;
  /** The sun by day, the moon by night: one light, so shadows swing round instead of popping. */
  sunPos: [number, number, number];
  skyTop: RGB;
  skyMid: RGB;
  skyBottom: RGB;
  /** Window panes and lanterns: 0 (daytime glass) to 1 (lit). Lamps come on a little before the windows. */
  windowGlow: number;
  lampGlow: number;
}

const DAY = {
  hemiSky: hex("#fff6e0"),
  hemiGround: hex("#7fb266"),
  hemi: 1.05,
  sun: hex("#fff0d2"),
  sunI: 2.1,
  top: hex("#8fd0ee"),
  mid: hex("#bfe6f7"),
  bottom: hex("#fff5d6"),
};
const GOLD = {
  hemiSky: hex("#ffd9a8"),
  hemiGround: hex("#8fa25f"),
  hemi: 1.0,
  sun: hex("#ffb066"),
  sunI: 1.95,
  top: hex("#6fa8dc"),
  mid: hex("#ffc490"),
  bottom: hex("#ffe6b8"),
};
const NIGHT = {
  hemiSky: hex("#8da2ee"),
  hemiGround: hex("#4a5c96"),
  hemi: 1.25,
  sun: hex("#a9bfff"),
  sunI: 1.1,
  top: hex("#0a0f2e"),
  mid: hex("#1d2b63"),
  bottom: hex("#4a3f7c"),
};

/** Where the light is: the sun crosses 6am to 6pm, the moon takes the sky back from 6pm to 6am. */
export function lightPosition(hour: number): [number, number, number] {
  const day = hour >= 6 && hour < 18;
  const u = day ? (hour - 6) / 12 : ((hour < 6 ? hour + 24 : hour) - 18) / 12;
  return day ? [-8 + 28 * u, 6 + 17 * Math.sin(Math.PI * u), -7] : [20 - 28 * u, 6 + 13 * Math.sin(Math.PI * u), -7];
}

export function ambience(hour: number): Ambience {
  const night = nightAmount(hour);
  const golden = goldenAmount(hour);
  // Day, warmed by golden hour, then cooled by night.
  const warm = (pick: (p: typeof DAY) => RGB) => mix(mix(pick(DAY), pick(GOLD), golden), pick(NIGHT), night);
  const num = (pick: (p: typeof DAY) => number) => lerp(lerp(pick(DAY), pick(GOLD), golden), pick(NIGHT), night);
  return {
    hour,
    night,
    golden,
    hemiSky: warm((p) => p.hemiSky),
    hemiGround: warm((p) => p.hemiGround),
    hemiIntensity: num((p) => p.hemi),
    sunColor: warm((p) => p.sun),
    sunIntensity: num((p) => p.sunI),
    sunPos: lightPosition(hour),
    skyTop: warm((p) => p.top),
    skyMid: warm((p) => p.mid),
    skyBottom: warm((p) => p.bottom),
    windowGlow: smooth(0.25, 0.75, night),
    lampGlow: smooth(0.1, 0.5, night),
  };
}

/** Rough brightness of the scene at this hour (hemisphere + light), for the "never too dark to read" test. */
export function brightness(a: Ambience): number {
  const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return a.hemiIntensity * lum(a.hemiSky) + a.sunIntensity * lum(a.sunColor);
}

/** Night is when the thought pool changes its tune (the campus is lit and someone is still shipping). */
export const isNight = (hour: number) => nightAmount(hour) > 0.6;
