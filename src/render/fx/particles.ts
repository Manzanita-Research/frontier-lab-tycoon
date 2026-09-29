// One pooled particle system for the whole game: confetti, coins, smoke, dust, water droplets and sparkles all live
// in the same struct-of-arrays pool (cap 2,000) and are drawn by one instanced mesh (ParticleLayer.tsx).
// This file is pure: no three, no React. It is a render-side toy and never touches the sim, so it keeps its own rng.
import { createRng } from "../../sim/rng";

export const CAP = 2000;

export const Kind = { Puff: 0, Confetti: 1, Coin: 2, Drop: 3, Spark: 4 } as const;
export type KindId = (typeof Kind)[keyof typeof Kind];

export interface Spawn {
  kind: KindId;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  /** Size at the end of life (puffs grow, sparks shrink). */
  size1?: number;
  gravity?: number;
  drag?: number;
  /** Linear sRGB. */
  r: number;
  g: number;
  b: number;
  alpha?: number;
  spin?: number;
  /** When set, the particle can't fall below the floor: it lands, and a bouncy one bounces. */
  bounce?: number;
}

const F = (n: number) => new Float32Array(n);

/** The GPU-facing arrays are exactly the ones the pool writes, so a frame is `update()` and a buffer upload. */
export class ParticlePool {
  readonly cap: number;
  count = 0;
  readonly pos: Float32Array; // x y z
  /** size, rotation, kind, flutter phase */
  readonly data: Float32Array;
  /** r g b a */
  readonly color: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size0: Float32Array;
  private size1: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private alpha0: Float32Array;
  private spin: Float32Array;
  private bounce: Float32Array;
  private phaseSpeed: Float32Array;
  private rng = createRng(0xf1_7e);
  /** Next slot to overwrite when the pool is full. */
  private cursor = 0;

  constructor(cap = CAP) {
    this.cap = cap;
    this.pos = F(cap * 3);
    this.data = F(cap * 4);
    this.color = F(cap * 4);
    this.vel = F(cap * 3);
    this.life = F(cap);
    this.maxLife = F(cap);
    this.size0 = F(cap);
    this.size1 = F(cap);
    this.grav = F(cap);
    this.drag = F(cap);
    this.alpha0 = F(cap);
    this.spin = F(cap);
    this.bounce = F(cap);
    this.phaseSpeed = F(cap);
  }

  /** Uniform in [lo, hi). Exposed so emitters and tests share one seeded stream. */
  rand(lo = 0, hi = 1) {
    return lo + this.rng.next() * (hi - lo);
  }

  /**
   * Add a particle. When the pool is full, `ambient` particles (sparkle trails, dust) are dropped so a confetti
   * burst always wins; everything else recycles the oldest slot.
   */
  spawn(s: Spawn, ambient = false): boolean {
    let i: number;
    if (this.count < this.cap) i = this.count++;
    else if (ambient) return false;
    else {
      i = this.cursor++ % this.cap;
    }
    const p = i * 3;
    this.pos[p] = s.x;
    this.pos[p + 1] = s.y;
    this.pos[p + 2] = s.z;
    this.vel[p] = s.vx ?? 0;
    this.vel[p + 1] = s.vy ?? 0;
    this.vel[p + 2] = s.vz ?? 0;
    this.life[i] = 0;
    this.maxLife[i] = s.life;
    this.size0[i] = s.size;
    this.size1[i] = s.size1 ?? s.size;
    this.grav[i] = s.gravity ?? 0;
    this.drag[i] = s.drag ?? 0;
    this.alpha0[i] = s.alpha ?? 1;
    this.spin[i] = s.spin ?? 0;
    this.bounce[i] = s.bounce ?? -1;
    this.phaseSpeed[i] = 6 + this.rng.next() * 8;
    const d = i * 4;
    this.data[d] = s.size;
    this.data[d + 1] = this.rng.next() * 6.283;
    this.data[d + 2] = s.kind;
    this.data[d + 3] = this.rng.next() * 6.283;
    this.color[d] = s.r;
    this.color[d + 1] = s.g;
    this.color[d + 2] = s.b;
    this.color[d + 3] = this.alpha0[i]!;
    return true;
  }

  /** Step every live particle by `dt` seconds; dead ones are swapped out so `[0, count)` is always live. */
  update(dt: number) {
    for (let i = 0; i < this.count; ) {
      const life = (this.life[i] = this.life[i]! + dt);
      if (life >= this.maxLife[i]!) {
        this.kill(i);
        continue;
      }
      const p = i * 3;
      const d = i * 4;
      const kind = this.data[d + 2]!;
      const drag = Math.exp(-this.drag[i]! * dt);
      this.vel[p] = this.vel[p]! * drag;
      this.vel[p + 2] = this.vel[p + 2]! * drag;
      this.vel[p + 1] = (this.vel[p + 1]! - this.grav[i]! * dt) * (kind === Kind.Confetti ? Math.exp(-0.8 * dt) : drag);
      if (kind === Kind.Confetti) {
        // Flutter: a sideways sway that makes the flakes drift instead of dropping like stones.
        const sway = Math.sin(life * 5 + this.data[d + 3]!) * 0.9;
        this.vel[p] = this.vel[p]! + sway * dt;
        this.vel[p + 2] = this.vel[p + 2]! - sway * dt * 0.6;
      }
      this.pos[p] = this.pos[p]! + this.vel[p]! * dt;
      this.pos[p + 1] = this.pos[p + 1]! + this.vel[p + 1]! * dt;
      this.pos[p + 2] = this.pos[p + 2]! + this.vel[p + 2]! * dt;
      const floor = 0.06;
      if (this.pos[p + 1]! < floor && this.bounce[i]! >= 0) {
        this.pos[p + 1] = floor;
        if (this.bounce[i]! > 0 && this.vel[p + 1]! < -0.8) {
          this.vel[p + 1] = -this.vel[p + 1]! * this.bounce[i]!;
          this.vel[p] = this.vel[p]! * 0.7;
          this.vel[p + 2] = this.vel[p + 2]! * 0.7;
        } else {
          this.vel[p] = this.vel[p + 1] = this.vel[p + 2] = 0;
          // Landed: let it fade quickly rather than lie there as a billboard.
          if (this.maxLife[i]! - life > 0.35) this.maxLife[i] = life + 0.35;
        }
      }
      const u = life / this.maxLife[i]!;
      const s0 = this.size0[i]!;
      this.data[d] = s0 + (this.size1[i]! - s0) * u;
      this.data[d + 1] = this.data[d + 1]! + this.spin[i]! * dt;
      this.data[d + 3] = this.data[d + 3]! + this.phaseSpeed[i]! * dt;
      this.color[d + 3] = this.alpha0[i]! * fade(kind, u, this.data[d + 3]!);
      i++;
    }
  }

  private kill(i: number) {
    const last = --this.count;
    if (i !== last) {
      const move = (a: Float32Array, n: number) => {
        for (let k = 0; k < n; k++) a[i * n + k] = a[last * n + k]!;
      };
      move(this.pos, 3);
      move(this.vel, 3);
      move(this.data, 4);
      move(this.color, 4);
      for (const a of [this.life, this.maxLife, this.size0, this.size1, this.grav, this.drag, this.alpha0, this.spin, this.bounce, this.phaseSpeed]) a[i] = a[last]!;
    }
    if (this.cursor > this.count) this.cursor = 0;
  }

  clear() {
    this.count = 0;
    this.cursor = 0;
  }
}

/** Opacity over a particle's life `u` (0 to 1). Sparks twinkle; everything else fades in fast and out slow. */
function fade(kind: number, u: number, phase: number): number {
  if (kind === Kind.Spark) return Math.sin(Math.PI * u) * (0.65 + 0.35 * Math.sin(phase * 1.7));
  const inn = Math.min(1, u * 12);
  const out = kind === Kind.Puff ? 1 - u : Math.min(1, (1 - u) * 4);
  return inn * out;
}

/** The one pool the game draws. */
export const particles = new ParticlePool();

// ---- Emitters: each is a recipe for one visual moment. Colours are linear-ish sRGB triples. ----

const rgb = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const CONFETTI = ["#ff6b5e", "#ffd24a", "#4fd0ff", "#8b6cf0", "#5fe08a", "#ff8ac7"].map(rgb);
const GOLD = rgb("#ffcf3f");
const SMOKE = rgb("#c9ccd8");
const DUST = rgb("#e8d5a8");
const WATER = rgb("#9fe3ff");
const CYAN = rgb("#5ff5ff");

const TAU = Math.PI * 2;

/** Confetti out of a point: a fan that goes up, hangs, and flutters down. */
export function confettiBurst(pool: ParticlePool, x: number, y: number, z: number, n = 120, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = pool.rand(0, TAU);
    const out = pool.rand(0.6, 3.4) * power;
    const c = CONFETTI[i % CONFETTI.length]!;
    pool.spawn({ kind: Kind.Confetti, x, y, z, vx: Math.cos(a) * out, vy: pool.rand(4.5, 9.5) * power, vz: Math.sin(a) * out, life: pool.rand(2.2, 3.2), size: pool.rand(0.09, 0.15), gravity: 7, drag: 0.5, r: c[0], g: c[1], b: c[2], spin: pool.rand(-14, 14), bounce: 0 });
  }
}

/** Coins that hop out and bounce: `n` of them, spread up and around. */
export function coinFountain(pool: ParticlePool, x: number, y: number, z: number, n = 30, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = pool.rand(0, TAU);
    const out = pool.rand(0.3, 1.9) * power;
    pool.spawn({ kind: Kind.Coin, x, y, z, vx: Math.cos(a) * out, vy: pool.rand(5.5, 9) * power, vz: Math.sin(a) * out, life: pool.rand(1.5, 2.2), size: 0.13, gravity: 14, drag: 0.15, r: GOLD[0], g: GOLD[1], b: GOLD[2], bounce: 0.45 });
  }
}

/** One puff of smoke that rises and swells. */
export function smokePuff(pool: ParticlePool, x: number, y: number, z: number) {
  pool.spawn({ kind: Kind.Puff, x: x + pool.rand(-0.06, 0.06), y, z: z + pool.rand(-0.06, 0.06), vx: pool.rand(-0.15, 0.35), vy: pool.rand(0.7, 1.2), vz: pool.rand(-0.25, 0.15), life: pool.rand(1.4, 2.2), size: 0.16, size1: 0.75, drag: 0.5, r: SMOKE[0], g: SMOKE[1], b: SMOKE[2], alpha: 0.6 });
}

/** A ring of dust kicked up around a tile footprint. */
export function dustBurst(pool: ParticlePool, x: number, z: number, radius: number, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + pool.rand(-0.2, 0.2);
    const r = radius * pool.rand(0.55, 1);
    pool.spawn({ kind: Kind.Puff, x: x + Math.cos(a) * r, y: 0.12, z: z + Math.sin(a) * r, vx: Math.cos(a) * pool.rand(0.6, 1.4), vy: pool.rand(0.35, 0.8), vz: Math.sin(a) * pool.rand(0.6, 1.4), life: pool.rand(0.55, 0.95), size: 0.14, size1: pool.rand(0.42, 0.62), drag: 3.2, r: DUST[0], g: DUST[1], b: DUST[2], alpha: 0.7 }, true);
  }
}

/** A droplet thrown up over a protester, falling back down. */
export function droplet(pool: ParticlePool, x: number, y: number, z: number) {
  pool.spawn({ kind: Kind.Drop, x, y, z, vx: pool.rand(-0.7, 0.7), vy: pool.rand(2.2, 3.8), vz: pool.rand(-0.7, 0.7), life: pool.rand(0.7, 1.1), size: pool.rand(0.05, 0.075), gravity: 9, drag: 0.2, r: WATER[0], g: WATER[1], b: WATER[2], alpha: 0.95, bounce: 0 }, true);
}

/** A cyan twinkle left behind an agent. */
export function sparkle(pool: ParticlePool, x: number, y: number, z: number, color: readonly [number, number, number] = CYAN) {
  pool.spawn({ kind: Kind.Spark, x: x + pool.rand(-0.08, 0.08), y, z: z + pool.rand(-0.08, 0.08), vx: pool.rand(-0.1, 0.1), vy: pool.rand(0.15, 0.5), vz: pool.rand(-0.1, 0.1), life: pool.rand(0.55, 0.95), size: pool.rand(0.11, 0.17), size1: 0.03, drag: 1, r: color[0], g: color[1], b: color[2] }, true);
}

/** A firefly or a star: slow, warm, twinkling. */
export function firefly(pool: ParticlePool, x: number, y: number, z: number) {
  pool.spawn({ kind: Kind.Spark, x, y, z, vx: pool.rand(-0.3, 0.3), vy: pool.rand(-0.05, 0.2), vz: pool.rand(-0.3, 0.3), life: pool.rand(2.8, 4.6), size: pool.rand(0.13, 0.22), size1: 0.08, drag: 0.6, r: 1, g: 0.93, b: 0.55, alpha: 0.85 }, true);
}

/** A star: high up, still, twinkling. */
export function star(pool: ParticlePool, x: number, y: number, z: number) {
  pool.spawn({ kind: Kind.Spark, x, y, z, life: pool.rand(1.6, 3.2), size: pool.rand(0.12, 0.22), size1: 0.1, r: 0.85, g: 0.92, b: 1, alpha: 0.8 }, true);
}
