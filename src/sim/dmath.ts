// Deterministic maths for the sim (FLT-106). ECMA-262 leaves Math.sin, cos, atan2, exp, log, pow, tanh, hypot and the
// rest "implementation-approximated", and the engines really do differ: V8 12 (Node 22) and 14 (Node 26) round them
// differently from V8 15 (Chrome 153) and from JavaScriptCore, and Node 26, Chrome and Firefox take Math.pow from the
// operating system's C library, so the same browser can give a different bit on macOS and on Linux. One differing bit
// in a protester's spot or a faction's stance is enough to split a replay.
//
// Everything here is built from +, -, *, /, Math.sqrt, Math.round and Math.floor, which IEEE 754 fixes to the bit on
// every engine, evaluated in a fixed order. So each function gives the same double everywhere. They are accurate to a
// few units in the last place (dmath.test.ts checks against Math), which is plenty for a game; they are not correctly
// rounded and need not be. Use these in src/sim; sim.test.ts fails on a raw Math.sin and friends.

const PI = 3.141592653589793;
const PI_2 = 1.5707963267948966;

// π/2 in three parts (fdlibm's pio2_1, pio2_2, pio2_2t): the first two have 33 significant bits, so n * part is
// exact for |n| < 2^20 and the reduction loses nothing for the angles a game sees.
const PIO2_1 = 1.5707963267341256;
const PIO2_2 = 6.077100506303966e-11;
const PIO2_3 = 2.0222662487959506e-21;

// ln 2 in two parts (fdlibm's ln2_hi, ln2_lo): k * LN2_HI is exact for |k| < 2^11.
const LN2_HI = 0.6931471803691238;
const LN2_LO = 1.9082149292705877e-10;
const LN2 = 0.6931471805599453;
const SQRT2 = 1.4142135623730951;

const SQRT3 = 1.7320508075688772;
const PI_6 = 0.5235987755982988;
const TAN_PI_12 = 0.2679491924311227;

/** 2^n for 0 <= n <= 60, by doubling (exact). */
const TWO: number[] = [1];
for (let i = 1; i <= 60; i++) TWO.push(TWO[i - 1]! * 2);

/** x * 2^k, in exact power-of-two steps (only the last step can round, and only into the subnormals). */
function scale(x: number, k: number): number {
  while (k > 60) { x *= TWO[60]!; k -= 60; }
  while (k < -60) { x /= TWO[60]!; k += 60; }
  return k >= 0 ? x * TWO[k]! : x / TWO[-k]!;
}

/** sin on [-π/4, π/4]: Taylor to r^17 (error < 1e-19 there). */
function kSin(r: number): number {
  const z = r * r;
  return r * (1 + z * (-1 / 6 + z * (1 / 120 + z * (-1 / 5040 + z * (1 / 362880 + z * (-1 / 39916800 + z * (1 / 6227020800 + z * (-1 / 1307674368000 + z * (1 / 355687428096000)))))))));
}

/** cos on [-π/4, π/4]: Taylor to r^18. */
function kCos(r: number): number {
  const z = r * r;
  return 1 + z * (-1 / 2 + z * (1 / 24 + z * (-1 / 720 + z * (1 / 40320 + z * (-1 / 3628800 + z * (1 / 479001600 + z * (-1 / 87178291200 + z * (1 / 20922789888000 + z * (-1 / 6402373705728000)))))))));
}

/** x = n·π/2 + r with |r| <= π/4 (a little over for huge x, where accuracy fades but the result stays deterministic). */
function reduce(x: number): [number, number] {
  const n = Math.round(x / PI_2);
  const r = x - n * PIO2_1 - n * PIO2_2 - n * PIO2_3;
  return [((n % 4) + 4) % 4, r];
}

export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (x === 0) return x;
  const [q, r] = reduce(x);
  return q === 0 ? kSin(r) : q === 1 ? kCos(r) : q === 2 ? -kSin(r) : -kCos(r);
}

export function dcos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  const [q, r] = reduce(x);
  return q === 0 ? kCos(r) : q === 1 ? -kSin(r) : q === 2 ? -kCos(r) : kSin(r);
}

/** atan on [0, 1]. Past tan(π/12), shift by π/6 so the series only ever sees |u| <= 0.268 (17 terms, error < 1e-19). */
function atan01(t: number): number {
  let base = 0;
  if (t > TAN_PI_12) {
    base = PI_6;
    t = (t * SQRT3 - 1) / (t + SQRT3);
  }
  const z = t * t;
  let p = 0;
  for (let k = 16; k >= 0; k--) p = (k % 2 === 0 ? 1 : -1) / (2 * k + 1) + z * p;
  return base + t * p;
}

export function datan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return x;
  const a = x < 0 ? -x : x;
  const r = a > 1 ? PI_2 - atan01(1 / a) : atan01(a);
  return x < 0 ? -r : r;
}

/** atan2 with the spec's quadrants and signed zeros; infinities follow the spec too. */
export function datan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  const negY = y < 0 || Object.is(y, -0);
  if (y === 0) return x > 0 || Object.is(x, 0) ? y : negY ? -PI : PI;
  if (x === 0) return negY ? -PI_2 : PI_2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) return (x > 0 ? PI / 4 : (3 * PI) / 4) * (negY ? -1 : 1);
    return x > 0 ? (negY ? -0 : 0) : negY ? -PI : PI;
  }
  if (!Number.isFinite(y)) return negY ? -PI_2 : PI_2;
  const t = datan(y / x);
  if (x > 0) return t;
  return negY ? t - PI : t + PI;
}

/** 1/1!, 1/2!, ... 1/16!. */
const INV_FACT: number[] = [];
for (let k = 1, f = 1; k <= 16; k++) { f *= k; INV_FACT.push(1 / f); }

/** e^r - 1 for |r| <= 0.35: Taylor to r^16 (error < 1e-21 there). */
function kExpm1(r: number): number {
  let p = 0;
  for (let k = 15; k >= 0; k--) p = INV_FACT[k]! + r * p;
  return r * p;
}

export function dexp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019412) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2_HI - k * LN2_LO;
  return scale(1 + kExpm1(r), k);
}

export function dexpm1(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return x;
  if (x > -0.35 && x < 0.35) return kExpm1(x);
  return dexp(x) - 1;
}

export function dlog(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  // x = m · 2^k with m in [√½, √2), by exact halvings and doublings.
  let k = 0;
  let m = x;
  while (m >= TWO[60]!) { m /= TWO[60]!; k += 60; }
  while (m < 1) { m *= TWO[60]!; k -= 60; }
  while (m >= 2) { m /= 2; k++; }
  if (m > SQRT2) { m /= 2; k++; }
  // log m = 2·atanh(f), f = (m - 1)/(m + 1), |f| <= 0.1716: 13 terms of the odd series (error < 1e-19).
  const f = (m - 1) / (m + 1);
  const z = f * f;
  let p = 0;
  for (let i = 12; i >= 0; i--) p = 1 / (2 * i + 1) + z * p;
  return k * LN2_HI + (2 * f * p + k * LN2_LO);
}

/**
 * x^y. Exact for an integer y (repeated squaring, |y| <= 2^31) and for x = 0 or 1; otherwise e^(y·ln x). Covers what a
 * game needs (x >= 0, or a negative x with an integer y); a negative x with a fractional y is NaN, as in the spec.
 */
export function dpow(x: number, y: number): number {
  if (y === 0) return 1;
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (Number.isInteger(y) && Math.abs(y) <= 2147483647) {
    let n = Math.abs(y);
    let b = x;
    let r = 1;
    while (n > 0) {
      if (n % 2 === 1) r *= b;
      b *= b;
      n = Math.floor(n / 2);
    }
    return y < 0 ? 1 / r : r;
  }
  if (x === 1) return 1;
  if (x === 0) return y > 0 ? 0 : Infinity;
  if (x < 0) return NaN;
  return dexp(y * dlog(x));
}

export function dtanh(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x === 0) return x;
  if (x > 22) return 1;
  if (x < -22) return -1;
  const e = dexpm1(2 * x);
  return e / (e + 2);
}

/** √(a² + b²). Fine for the sim's distances (no overflow guard: nothing on a 30-tile map comes near 1e154). */
export function dhypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

/** x². Use instead of `x ** 2`, which engines may route through their own pow. */
export const sq = (x: number): number => x * x;
