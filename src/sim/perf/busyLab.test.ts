// FLT-39: the tick budget with every pack awake, system by system. `--silent=false` prints the table; FLT_PROFILE=1
// profiles ten times as many ticks, for the numbers in docs/ARCHITECTURE.md.
import { busyLab, profileTable, profileTicks, timeTicks } from "./busyLab";
import { answer, perfBudget } from "../testkit";
import { tick } from "../tick";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** A system's share of the budget: its mean per tick, a daily system's day spread over the day's ticks. */
const SYSTEM_MS = 0.06;
/** The walkers are the one system that is most of the tick. */
const WALKERS_MS = 0.4;

describe("the busy lab: 800 walkers, every pack awake", () => {
  it(`keeps every system under ${SYSTEM_MS} ms a tick but the walkers, and the whole tick under 0.5 ms`, () => {
    const { s, topUp } = busyLab();
    // Warm up. On one vCPU the JIT compiles on the same core as the tick, and with every pack's code to compile the first
    // thousand ticks run up to half as fast again as the rest: the compiler's cost, not the game's (a second lab built in
    // the same, warmed-up process runs its first days about a quarter faster).
    for (let i = 0; i < 1400; i++) {
      if (i % 200 === 0) topUp();
      tick(s, answer(s));
    }
    topUp();
    expect(s.walkers.length).toBeGreaterThanOrEqual(800); // still busy: the topping up keeps up with the quitting
    const best = timeTicks(s, topUp);
    const p = profileTicks(s, env.FLT_PROFILE ? 4000 : 400, topUp);
    console.log(`busy-lab tick: ${best.toFixed(3)} ms (best of 3 x 200 ticks, stopwatch off)\n${s.walkers.length} walkers at the end, day ${s.day}\n\n${profileTable(p)}`);
    expect(p.systems.length).toBeGreaterThan(30); // every pack ran
    for (const t of p.systems) expect(t.meanUs / 1000, t.system).toBeLessThan(perfBudget(t.system === "walkers" ? WALKERS_MS : SYSTEM_MS));
    expect(best).toBeLessThan(perfBudget(0.5));
  });
});
