// FLT-39: the tick budget with every pack awake, system by system. `--silent=false` prints the table; FLT_PROFILE=1
// profiles ten times as many ticks, for the numbers in docs/ARCHITECTURE.md.
import { busyLab, profileTable, profileTicks, timeTicks, type BusyLab } from "./busyLab";
import { perfBudget } from "../testkit";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** A system's share of the budget: its mean per tick, a daily system's day spread over the day's ticks. */
const SYSTEM_MS = 0.06;
/** The walkers are the one system that is most of the tick. */
const WALKERS_MS = 0.4;

/** Warm up. On one vCPU the JIT compiles on the same core as the tick, and with every pack's code to compile the first
 * thousand ticks run up to half as fast again as the rest: the compiler's cost, not the game's (a second lab built in the
 * same, warmed-up process runs its first days about a quarter faster). */
function warm(lab: BusyLab) {
  for (let i = 0; i < 1400; i++) {
    if (i % 200 === 0) lab.topUp();
    lab.play();
  }
  lab.topUp();
}

describe("the busy lab: 800 walkers, every pack awake", () => {
  it(`keeps every system under ${SYSTEM_MS} ms a tick but the walkers, and the whole tick under 0.5 ms`, () => {
    const lab = busyLab();
    warm(lab);
    const { s } = lab;
    expect(s.walkers.length).toBeGreaterThanOrEqual(800); // still busy: the topping up keeps up with the quitting
    expect(s.endings?.id).toBe("regulated"); // an ending's chart runs every tick
    const best = timeTicks(lab);
    const p = profileTicks(lab, env.FLT_PROFILE ? 4000 : 400);
    console.log(`busy-lab tick: ${best.toFixed(3)} ms (best of 3 x 200 ticks, stopwatch off)\n${s.walkers.length} walkers at the end, day ${s.day}\n\n${profileTable(p)}`);
    expect(p.systems.length).toBeGreaterThan(30); // every pack ran
    for (const t of p.systems) expect(t.meanUs / 1000, t.system).toBeLessThan(perfBudget(t.system === "walkers" ? WALKERS_MS : SYSTEM_MS));
    expect(best).toBeLessThan(perfBudget(0.5));
  });

  it("builds through the Takeover without a hitch once the campus is full", () => {
    const lab = busyLab(1, "race");
    warm(lab);
    expect(lab.s.endings?.id).toBe("takeover");
    const p = profileTicks(lab, 400);
    const endings = p.systems.find((t) => t.system === "endings")!;
    console.log(`the Takeover, ${lab.s.endings!.autopilot.placed} buildings in: endings ${endings.meanUs.toFixed(1)} µs a tick, worst ${endings.maxUs.toFixed(0)} µs`);
    expect(lab.s.endings!.autopilot.placed).toBeGreaterThan(20);
    expect(endings.meanUs / 1000).toBeLessThan(perfBudget(SYSTEM_MS));
    // It looks for a spot for every kind in its rotation, on every tile: once took 10 ms, one tick in 24.
    expect(endings.maxUs / 1000).toBeLessThan(perfBudget(2));
  });
});
