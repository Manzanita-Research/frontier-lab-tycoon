import { describe, expect, it } from "vitest";
import { createInitialState } from "../../sim/state";
import { perfBudget } from "../../sim/testkit";
import { tick } from "../../sim/tick";
import { ambience } from "./clock";
import { CAP, coinFountain, confettiBurst, ParticlePool } from "./particles";
import { createWatch } from "./watch";

/** Median of `runs` timings, in milliseconds. */
function median(runs: number, f: () => void): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    f();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

// Per-frame budgets for the juice layer's CPU work (the GPU side is one instanced draw call). Loose on purpose: they
// exist to catch an accidental O(n^2), not to race the machine.
describe("juice per-frame cost", () => {
  it("a full pool of 2,000 particles updates in well under a millisecond", () => {
    const pool = new ParticlePool();
    for (let i = 0; i < 12; i++) confettiBurst(pool, 0, 2, 0, 200);
    coinFountain(pool, 0, 0, 0, 100);
    expect(pool.count).toBe(CAP);
    // Refill each run so nothing dies mid-measurement.
    const ms = median(200, () => {
      for (let i = 0; i < 5 && pool.count < CAP; i++) confettiBurst(pool, 0, 2, 0, 50);
      pool.update(1 / 60);
    });
    expect(ms).toBeLessThan(perfBudget(1.5));
  });

  it("watching a busy World (500 walkers) costs a fraction of a millisecond per frame", () => {
    const w = createInitialState(7);
    w.agentBonus = 400;
    for (let i = 0; i < 200; i++) tick(w);
    const watch = createWatch();
    watch.poll(w);
    const ms = median(200, () => void watch.poll(w));
    expect(ms).toBeLessThan(perfBudget(0.3));
  });

  it("the ambient light is a handful of multiplications", () => {
    const ms = median(200, () => {
      for (let h = 0; h < 24; h += 0.1) ambience(h);
    });
    expect(ms).toBeLessThan(perfBudget(1));
  });
});
