// FLT-98: the lawn, painted once into a texture. The lot inside the fence is freshly mowed, RCT-style: a stripe per
// column of tiles, light and dark, running up from the gate, with a faint checker so the rows still read, a slow drift
// of tint across it, and the odd patch of clover or flowers. The verge outside the fence is left unmowed. All of it is
// texture: nothing here is geometry, nothing is in the World, and the dice are this file's own.

import { createRng } from "../sim/rng";
import { GRID_SIZE } from "../sim/state";

/** The board is the lot plus a two-tile verge on every side. */
export const BOARD = 28;
export const RIM = (BOARD - GRID_SIZE) / 2;
/** Texels per tile: about one per screen pixel at the default zoom. */
export const LAWN_PX = 32;
const N = BOARD * LAWN_PX;

type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** The two greens the lot used to be checkered in (and still averages), and the verge's. */
const LOT: RGB = hex("#76bc52");
const VERGE: RGB = hex("#68aa4a");
/** How far a mowed stripe is pushed light or dark, per channel. Paths, ghosts and the No path! marks are far louder. */
export const STRIPE: RGB = [13, 14, 9];
/** The faint checker along each stripe, so you can still count rows. */
const CHECK = 3;
/** The tint drifts between a sunnier and a cooler green, this much either way. */
const DRIFT: RGB = [9, 4, -5];

const CLOVER = hex("#5e9f47");
const CLOVER_LIGHT = hex("#86c463");
const FLOWERS: { petal: RGB; eye: RGB }[] = [
  { petal: hex("#fffaf0"), eye: hex("#ffcf3a") }, // daisies
  { petal: hex("#ffd84a"), eye: hex("#e8a417") }, // buttercups
  { petal: hex("#ff9ec4"), eye: hex("#fff3d0") }, // pink
  { petal: hex("#c9a6ff"), eye: hex("#fff3d0") }, // lilac
];

/** Patches per board: enough to catch the eye on an empty lot, few enough to stay a lawn. */
export const PATCHES = { clover: 22, flowers: 16, wild: 10 } as const;

const inLot = (tx: number, tz: number) => tx >= RIM && tz >= RIM && tx < BOARD - RIM && tz < BOARD - RIM;

/** A smooth 0..1 field over the board: random values on a coarse lattice, eased between. */
function field(rng: ReturnType<typeof createRng>, cells: number) {
  const n = cells + 2;
  const v = Array.from({ length: n * n }, () => rng.next());
  const ease = (t: number) => t * t * (3 - 2 * t);
  return (u: number, w: number) => {
    const x = (u / BOARD) * cells;
    const z = (w / BOARD) * cells;
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = ease(x - x0);
    const fz = ease(z - z0);
    const at = (i: number, j: number) => v[j * n + i]!;
    const a = at(x0, z0) + (at(x0 + 1, z0) - at(x0, z0)) * fx;
    const b = at(x0, z0 + 1) + (at(x0 + 1, z0 + 1) - at(x0, z0 + 1)) * fx;
    return a + (b - a) * fz;
  };
}

/**
 * The lawn as RGBA bytes, `BOARD * LAWN_PX` square. Row r, column c is the texel at board (c, r) / LAWN_PX: row 0 is
 * the north edge (z = 0), as on the old canvas. `Ground.tsx` flips it into a texture.
 */
export function lawnPixels(): Uint8ClampedArray {
  const rng = createRng(20260929);
  const drift = field(rng, 5);
  const out = new Uint8ClampedArray(N * N * 4);
  // A little grain, fixed per texel, and streaks along each stripe where the mower's blades left their mark.
  const streak = Array.from({ length: N }, () => (rng.next() - 0.5) * 4);
  for (let r = 0; r < N; r++) {
    const tz = Math.floor(r / LAWN_PX);
    for (let c = 0; c < N; c++) {
      const tx = Math.floor(c / LAWN_PX);
      const lot = inLot(tx, tz);
      const d = drift(c / LAWN_PX, r / LAWN_PX) * 2 - 1;
      const grain = (rng.next() - 0.5) * 3;
      const base = lot ? LOT : VERGE;
      const stripe = lot ? ((tx - RIM) % 2 === 0 ? 1 : -1) : 0;
      const check = lot ? ((tz - RIM) % 2 === 0 ? CHECK : -CHECK) : (tx + tz) % 2 === 0 ? 2 : -2;
      const lines = lot ? streak[c]! : 0;
      const o = (r * N + c) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = base[k]! + stripe * STRIPE[k]! + check + DRIFT[k]! * d * (lot ? 1 : 1.4) + grain + lines;
      out[o + 3] = 255;
    }
  }
  const dot = (cx: number, cz: number, rad: number, color: RGB, mix = 1) => {
    for (let r = Math.floor(cz - rad); r <= Math.ceil(cz + rad); r++) {
      for (let c = Math.floor(cx - rad); c <= Math.ceil(cx + rad); c++) {
        if (r < 0 || c < 0 || r >= N || c >= N || (c - cx) ** 2 + (r - cz) ** 2 > rad * rad) continue;
        const o = (r * N + c) * 4;
        for (let k = 0; k < 3; k++) out[o + k] = out[o + k]! + (color[k]! - out[o + k]!) * mix;
      }
    }
  };
  /** A spot somewhere on the lot (or, for the wild ones, the verge), in texels. */
  const spot = (verge: boolean): [number, number] => {
    for (;;) {
      const x = rng.next() * BOARD;
      const z = rng.next() * BOARD;
      if (inLot(Math.floor(x), Math.floor(z)) !== verge) return [x * LAWN_PX, z * LAWN_PX];
    }
  };
  // Clover: a soft darker patch, then three-leaf sprigs scattered over it.
  for (let i = 0; i < PATCHES.clover; i++) {
    const [cx, cz] = spot(false);
    const rad = (0.35 + rng.next() * 0.4) * LAWN_PX;
    dot(cx, cz, rad, CLOVER, 0.28);
    const sprigs = 10 + rng.int(0, 10);
    for (let j = 0; j < sprigs; j++) {
      const a = rng.next() * Math.PI * 2;
      const m = Math.sqrt(rng.next()) * rad;
      const sx = cx + Math.cos(a) * m;
      const sz = cz + Math.sin(a) * m;
      const turn = rng.next() * Math.PI * 2;
      for (let l = 0; l < 3; l++) dot(sx + Math.cos(turn + (l * Math.PI * 2) / 3) * 1.3, sz + Math.sin(turn + (l * Math.PI * 2) / 3) * 1.3, 1.1, l === 0 ? CLOVER_LIGHT : CLOVER);
    }
  }
  // Flowers: a clump of one or two kinds, each a cross of petals round a bright eye.
  const flowers = (count: number, verge: boolean) => {
    for (let i = 0; i < count; i++) {
      const [cx, cz] = spot(verge);
      const rad = (0.25 + rng.next() * 0.3) * LAWN_PX;
      const kinds = [FLOWERS[rng.int(0, FLOWERS.length - 1)]!, FLOWERS[rng.int(0, FLOWERS.length - 1)]!];
      const n = 7 + rng.int(0, 8);
      for (let j = 0; j < n; j++) {
        const a = rng.next() * Math.PI * 2;
        const m = Math.sqrt(rng.next()) * rad;
        const fx = cx + Math.cos(a) * m;
        const fz = cz + Math.sin(a) * m;
        const f = kinds[j % 2]!;
        for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]] as const) dot(fx + dx, fz + dz, 1.05, f.petal);
        dot(fx, fz, 0.9, f.eye);
      }
    }
  };
  flowers(PATCHES.flowers, false);
  flowers(PATCHES.wild, true);
  return out;
}

/** The lawn's average colour over a rect of tiles (board coordinates), for the tests. */
export function lawnAverage(px: Uint8ClampedArray, x0: number, z0: number, w: number, d: number): RGB {
  const sum: RGB = [0, 0, 0];
  let n = 0;
  for (let r = z0 * LAWN_PX; r < (z0 + d) * LAWN_PX; r++) {
    for (let c = x0 * LAWN_PX; c < (x0 + w) * LAWN_PX; c++) {
      const o = (r * N + c) * 4;
      for (let k = 0; k < 3; k++) sum[k] = sum[k]! + px[o + k]!;
      n++;
    }
  }
  return sum.map((s) => s / n) as RGB;
}
