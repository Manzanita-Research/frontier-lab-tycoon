import { describe, expect, it } from "vitest";
import { CAP, coinFountain, confettiBurst, dustBurst, Kind, ParticlePool, smokePuff, sparkle } from "./particles";

const boring = { kind: Kind.Puff, x: 0, y: 1, z: 0, life: 1, size: 0.1, r: 1, g: 1, b: 1 } as const;

describe("particle pool", () => {
  it("caps at 2,000 particles no matter how hard the emitters push", () => {
    const pool = new ParticlePool();
    expect(pool.cap).toBe(2000);
    expect(CAP).toBe(2000);
    for (let i = 0; i < 30; i++) confettiBurst(pool, 0, 2, 0, 200);
    expect(pool.count).toBe(2000);
    coinFountain(pool, 0, 0, 0, 80);
    expect(pool.count).toBe(2000);
    pool.update(0.016);
    expect(pool.count).toBeLessThanOrEqual(2000);
  });

  it("drops ambient particles when full so a confetti burst always gets in", () => {
    const pool = new ParticlePool(50);
    for (let i = 0; i < 50; i++) pool.spawn({ ...boring });
    expect(pool.spawn({ ...boring }, true)).toBe(false);
    expect(pool.spawn({ ...boring })).toBe(true);
    expect(pool.count).toBe(50);
  });

  it("retires particles at the end of their life and keeps the live ones packed at the front", () => {
    const pool = new ParticlePool(10);
    pool.spawn({ ...boring, x: 1, life: 0.1 });
    pool.spawn({ ...boring, x: 2, life: 5 });
    pool.spawn({ ...boring, x: 3, life: 0.1 });
    pool.spawn({ ...boring, x: 4, life: 5 });
    pool.update(0.2);
    expect(pool.count).toBe(2);
    expect([...pool.pos.slice(0, 6)].filter((_, i) => i % 3 === 0).sort()).toEqual([2, 4]);
    pool.update(10);
    expect(pool.count).toBe(0);
  });

  it("confetti falls and lands, and coins bounce before they settle", () => {
    const pool = new ParticlePool(4);
    pool.spawn({ kind: Kind.Confetti, x: 0, y: 3, z: 0, vy: 0, life: 6, size: 0.1, gravity: 7, drag: 0.5, r: 1, g: 0, b: 0, bounce: 0 });
    for (let i = 0; i < 300; i++) pool.update(1 / 60);
    // Landed and faded out of the pool inside its 6 seconds.
    expect(pool.count).toBe(0);

    const coin = new ParticlePool(4);
    coin.spawn({ kind: Kind.Coin, x: 0, y: 0.5, z: 0, vy: -6, life: 3, size: 0.1, gravity: 14, r: 1, g: 1, b: 0, bounce: 0.5 });
    let rose = false;
    let last = 0.5;
    for (let i = 0; i < 90 && coin.count > 0; i++) {
      coin.update(1 / 60);
      if (coin.count > 0 && coin.pos[1]! > last + 0.001) rose = true;
      if (coin.count > 0) last = coin.pos[1]!;
    }
    expect(rose).toBe(true);
  });

  it("smoke rises and swells; sparkles twinkle out; dust is ambient", () => {
    const pool = new ParticlePool(64);
    smokePuff(pool, 0, 1, 0);
    const y0 = pool.pos[1]!;
    const s0 = pool.data[0]!;
    pool.update(0.5);
    expect(pool.pos[1]!).toBeGreaterThan(y0);
    expect(pool.data[0]!).toBeGreaterThan(s0);
    sparkle(pool, 0, 0.3, 0);
    dustBurst(pool, 0, 0, 1);
    expect(pool.count).toBe(1 + 1 + 12);
    pool.update(3);
    expect(pool.count).toBe(0);
  });

  it("is deterministic: the same emitter calls give the same particles", () => {
    const a = new ParticlePool(200);
    const b = new ParticlePool(200);
    for (const p of [a, b]) {
      confettiBurst(p, 1, 2, 3, 40);
      p.update(0.3);
    }
    expect([...a.pos.slice(0, 120)]).toEqual([...b.pos.slice(0, 120)]);
  });
});
