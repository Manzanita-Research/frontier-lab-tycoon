// A WCAG 2.3.1 "three flashes" check (FLT-105), for anything that animates colour over the whole screen. Feed it
// one colour's value over time (sampled at the frame rate) and it counts flashes the way the guideline defines them:
//
// * A general flash is a pair of opposing changes in relative luminance of 10% or more of the maximum, where the
//   darker state is below 0.80.
// * A red flash is a pair of opposing transitions involving a saturated red: R / (R + G + B) ≥ 0.8 (linear light),
//   with the (R − G − B) × 320 value changing by more than 20.
//
// A screen-wide effect is always over the "small area" exemption, so every flash counts. Pure; unit-tested.

export type Rgb = readonly [number, number, number];

const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Relative luminance of an sRGB colour (0 to 1 per channel). */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** A saturated red, by WCAG's definition. */
export function saturatedRed([r, g, b]: Rgb): boolean {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const sum = R + G + B;
  return sum > 0 && R / sum >= 0.8;
}

const redValue = ([r, g, b]: Rgb) => Math.max(0, linear(r) - linear(g) - linear(b)) * 320;

/**
 * The moments a value turns: each monotonic run (from one turning point to the next) that rises or falls by at least
 * `step` is a transition, stamped at the moment it has moved `step` from where it started. It counts if `ok` holds for
 * its two ends (the darker end under 0.8, or a saturated red at either end); two that count make a flash.
 *
 * The runs are found by the value alone and only then judged, so a transition is dated by when the change happens
 * (pass 2). Judging while scanning dated a slow red swell's rise at the moment it first touched saturated red, its
 * peak, so a rise of two seconds and a fall of two seconds read as a pair a quarter of a second apart.
 */
function transitions(times: readonly number[], values: readonly number[], step: number, ok: (from: number, to: number, i: number, j: number) => boolean): number[] {
  // Each run: where it started (the turning point), where it ended (the next one), and when it reached `step`.
  const runs: { from: number; to: number; at: number }[] = [];
  let dir = 0;
  // Before the first run, the lowest and highest seen so far (and where); after it, the extreme in the current direction.
  let lo = 0;
  let hi = 0;
  let ext = 0;
  const start = (from: number, i: number, d: number) => {
    if (runs.length > 0) runs[runs.length - 1]!.to = from;
    runs.push({ from, to: i, at: times[i]! });
    dir = d;
    ext = i;
  };
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (dir === 0) {
      if (v < values[lo]!) lo = i;
      if (v > values[hi]!) hi = i;
      if (v - values[lo]! >= step) start(lo, i, 1);
      else if (values[hi]! - v >= step) start(hi, i, -1);
    } else if (dir > 0) {
      if (v > values[ext]!) ext = i;
      else if (values[ext]! - v >= step) start(ext, i, -1);
    } else if (v < values[ext]!) ext = i;
    else if (v - values[ext]! >= step) start(ext, i, 1);
  }
  if (runs.length > 0) runs[runs.length - 1]!.to = ext;
  return runs.filter((r) => ok(values[r.from]!, values[r.to]!, r.from, r.to)).map((r) => r.at);
}

/** The most flashes (pairs of transitions) inside any window of `seconds`. */
function worstWindow(at: readonly number[], seconds: number): number {
  let worst = 0;
  let from = 0;
  for (let to = 0; to < at.length; to++) {
    while (at[to]! - at[from]! > seconds) from++;
    worst = Math.max(worst, Math.floor((to - from + 1) / 2));
  }
  return worst;
}

export interface FlashReport {
  /** The most general flashes in any one second. WCAG 2.3.1 allows three. */
  flashes: number;
  /** The most red flashes in any one second. */
  red: number;
  /** Luminance transitions over the whole run (a slow colour cycle has a few; a strobe has hundreds). */
  transitions: number;
}

/** Count the flashes in one colour's samples (`times` in seconds, ascending). */
export function flashReport(times: readonly number[], colours: readonly Rgb[]): FlashReport {
  const lum = colours.map(luminance);
  const general = transitions(times, lum, 0.1, (a, b) => Math.min(a, b) < 0.8);
  const reds = transitions(times, colours.map(redValue), 20, (_a, _b, i, j) => saturatedRed(colours[i]!) || saturatedRed(colours[j]!));
  return { flashes: worstWindow(general, 1), red: worstWindow(reds, 1), transitions: general.length };
}
