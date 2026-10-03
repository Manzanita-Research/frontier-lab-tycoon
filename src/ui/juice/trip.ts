// The trip (FLT-105): a generic, moddable "the whole screen goes strange for a few days" hook. A mod starts one with
// the `trip.start` verb (ACID MOD(E) is the first); the sim keeps when it starts and ends, in ticks, and everything
// here is presentation: how strong it is right now, and what each effect is doing at this instant.
//
// Every effect is driven by the numbers below, and only by them: the CSS (windows that melt, text that wobbles,
// colour that cycles), the canvas pass (kaleidoscope, swirl, breathing walls), the walkers' trails and the calm
// version's still art. So the photosensitivity test (trip.test.ts) can sample exactly what the player will see. The
// music's tape wow follows the same strength (audio/wobble.ts).
//
// Safety, by construction:
// * No flashing. The colour is a wash that changes each pixel's hue and keeps its brightness (below), turning once
//   in a quarter of a minute; nothing else touches brightness. WCAG 2.3.1 allows three flashes a second; the test
//   asserts this look has none at all.
// * The strength follows the sim's envelope, but slew-limited in wall time, so ▶▶▶ (10×) cannot snap it on or off.
// * "I've had enough" falls fast but still in a fraction of a second: one change, never a flash.
// * Reduced motion (`TRIP_CALM`): still colour and still art (a poster-paint wash that never turns, a mandala on the
//   map), nothing that moves or warps. It fades in and out with the strength, and that is all that changes.

export interface TripLook {
  /** The colour wash's opacity at full strength, and the seconds it takes to turn once (always forward, never back; 0: it stands still). */
  wash: number;
  huePeriod: number;
  /** The still mandala over the map (the calm version's art), its opacity at full strength. */
  art: number;
  /** Breathing walls and windows: scale either way, and the breath's period in seconds. */
  breathe: number;
  breathePeriod: number;
  /** Text wobble, degrees, and its period. */
  wobble: number;
  wobblePeriod: number;
  /** How far windows melt (0 to 1; the CSS scales it), and its period. */
  melt: number;
  meltPeriod: number;
  /** The kaleidoscope's mix over the map (0 to 1; under 0.5 so the map stays readable), segments, and seconds per turn. */
  kaleido: number;
  segments: number;
  spinPeriod: number;
  /** The swirl at the screen's edge, radians, and its period. */
  swirl: number;
  swirlPeriod: number;
  /** Walker trails, 0 (none) to 1. */
  trails: number;
  /** Strength per second, up and down. `enough` is how fast "I've had enough" takes it away. */
  rise: number;
  fall: number;
  enough: number;
}

export const TRIP_LOOK: TripLook = {
  wash: 0.55, huePeriod: 16, art: 0,
  breathe: 0.014, breathePeriod: 6,
  wobble: 2.2, wobblePeriod: 3.4,
  melt: 1, meltPeriod: 9,
  kaleido: 0.42, segments: 6, spinPeriod: 48,
  swirl: 0.24, swirlPeriod: 16,
  trails: 1,
  rise: 0.2, fall: 0.3, enough: 2.5,
};

/** Reduced motion: still colour, still art, and nothing that moves. */
export const TRIP_CALM: TripLook = {
  ...TRIP_LOOK,
  wash: 0.32, huePeriod: 0, art: 0.5, breathe: 0, wobble: 0, melt: 0, kaleido: 0, swirl: 0, trails: 0,
};
/** Where a still wash stands (degrees): magenta at the top, orange and teal down the sides, poster paint. */
export const CALM_TURN = 290;

/** What the sim says about a trip: ticks it starts and ends, and how long it takes to come on and wear off. */
export interface TripSpan {
  start: number;
  end: number;
  rise: number;
  fade: number;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** How strong the trip should be at `tick`, 0 to 1: it comes on over `rise` ticks, holds, and wears off over `fade` after `end`. */
export function tripTarget(span: TripSpan, tick: number): number {
  const on = smooth((tick - span.start) / Math.max(1, span.rise));
  const off = 1 - smooth((tick - span.end) / Math.max(1, span.fade));
  return Math.max(0, Math.min(on, off));
}

/** One frame's step toward `target`, never faster than the look allows (`enough`: the player asked for it to stop). */
export function slew(level: number, target: number, dt: number, look: TripLook, enough = false): number {
  const d = Math.min(Math.max(dt, 0), 0.1);
  if (enough) return Math.max(0, level - look.enough * d);
  return target > level ? Math.min(target, level + look.rise * d) : Math.max(target, level - look.fall * d);
}

export interface TripFrame {
  /** The colour wash: its opacity, and how far it has turned (degrees, always forward). */
  wash: number;
  turn: number;
  /** The still mandala's opacity. */
  art: number;
  /** Scale either way, for breathing walls and windows. */
  breathe: number;
  /** Amplitudes for the CSS animations (their periods are the look's). */
  wobble: number;
  melt: number;
  /** The canvas pass: kaleidoscope mix, its turn (radians), and the swirl. */
  kaleido: number;
  spin: number;
  swirl: number;
  trails: number;
}

const wave = (t: number, period: number) => Math.sin((2 * Math.PI * t) / period);

/** Every effect at wall time `t` (seconds) and strength `level`. */
export function tripFrame(t: number, level: number, look: TripLook): TripFrame {
  const k = Math.max(0, Math.min(1, level));
  return {
    wash: k * look.wash,
    turn: look.huePeriod > 0 ? ((360 * t) / look.huePeriod) % 360 : CALM_TURN,
    art: k * look.art,
    breathe: 1 + k * look.breathe * wave(t, look.breathePeriod),
    wobble: k * look.wobble,
    melt: k * look.melt,
    kaleido: k * look.kaleido,
    spin: look.kaleido > 0 && look.spinPeriod > 0 ? ((2 * Math.PI * t) / look.spinPeriod) % (2 * Math.PI) : 0,
    swirl: k * look.swirl * wave(t, look.swirlPeriod) || 0,
    trails: k * look.trails,
  };
}

/**
 * How fast the kaleidoscope and the swirl slide the picture past a point `radius` pixels from the middle, at most, in
 * pixels a second. The canvas pass only moves the picture about (it never changes its brightness), so the worst it
 * can do is what a camera pan does: edges glide by, at different moments in different places, never the whole screen
 * at once. The test holds it under a slow pan.
 */
export function slideSpeed(look: TripLook, radius: number): number {
  if (look.kaleido <= 0 && look.swirl <= 0) return 0;
  const spin = look.spinPeriod > 0 ? (2 * Math.PI) / look.spinPeriod : 0;
  const swirl = look.swirlPeriod > 0 ? (look.swirl * 2 * Math.PI) / look.swirlPeriod : 0;
  return radius * (spin + swirl);
}

// ---- The colour model: a wash with `mix-blend-mode: color` --------------------------------------------------------
//
// The colour is a rainbow wash over the whole screen (a conic gradient, turning slowly), blended with the W3C
// `color` mode: each pixel takes the wash's hue and saturation and keeps its own luminosity. So the colours cycle
// while the brightness of the picture stays where it was, which is what flashes are made of. These are the
// Compositing and Blending Level 1 formulas, so the test sees what the browser draws.

type C3 = [number, number, number];
const lum = ([r, g, b]: readonly number[]) => 0.3 * r! + 0.59 * g! + 0.11 * b!;
function clipColor(c: C3): C3 {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  let out = c;
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n)) as C3;
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as C3;
  return out;
}
const setLum = (c: readonly number[], l: number): C3 => {
  const d = l - lum(c);
  return clipColor([c[0]! + d, c[1]! + d, c[2]! + d]);
};

/** `hsl(deg, s, l)` (s and l 0 to 1) as sRGB 0 to 1. */
export function hslColour(deg: number, s: number, l: number): C3 {
  const h = (((deg % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
/** The wash's colour at hue `deg`: `hsl(deg, WASH_S, WASH_L)`, as sRGB 0 to 1. */
export const washColour = (deg: number): C3 => hslColour(deg, WASH_S, WASH_L);
export const WASH_S = 0.9;
export const WASH_L = 0.55;

/** A backdrop under a layer of colour `paint` at `opacity`, blended with `mix-blend-mode: color`. */
export function blended(backdrop: readonly [number, number, number], paint: readonly number[], opacity: number): C3 {
  const mixed = setLum(paint, lum(backdrop));
  return [0, 1, 2].map((i) => backdrop[i]! + (mixed[i]! - backdrop[i]!) * opacity) as C3;
}

/** An sRGB backdrop colour under the wash of hue `deg` at `opacity`: `mix-blend-mode: color`, then the layer's opacity. */
export const washed = (backdrop: readonly [number, number, number], deg: number, opacity: number): C3 => blended(backdrop, washColour(deg), opacity);

/** The calm version's still mandala (juice.css `.trip-art`): its paints, `[hue, saturation %, lightness %]`. */
export const ART_PAINTS: readonly (readonly [number, number, number])[] = [[290, 85, 55], [25, 95, 55], [175, 80, 45], [335, 90, 60], [45, 95, 55]];

/** The hue of the wash at a point `angle` degrees round the middle of the screen (the gradient's own angle). */
export const washHueAt = (f: Pick<TripFrame, "turn">, angle: number) => angle + f.turn;
