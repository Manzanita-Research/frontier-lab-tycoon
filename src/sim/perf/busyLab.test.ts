// FLT-39: the tick budget with every pack awake, system by system. `--silent=false` prints the table; FLT_PROFILE=1
// profiles ten times as many ticks, for the numbers in docs/ARCHITECTURE.md.
import { busyLab, profileTable, profileTicks, timeTicks, type BusyLab } from "./busyLab";
import { perfBudget } from "../testkit";
import { startEscape } from "../escape/driver";
import { LATE_FLAG } from "../slopbowl/driver";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** A system's share of the budget: its mean per tick, a daily system's day spread over the day's ticks. */
const SYSTEM_MS = 0.06;
/** The walkers are the one system that is most of the tick. */
const WALKERS_MS = 0.4;
/** The whole tick. This lab (800+ walkers, every pack awake, an ending's chart running) is deliberately heavier than the
 * 800-walker gate in crowd.test.ts, which stays at 0.5 ms. It measured 0.49 to 0.56 ms on a 1-vCPU Modal box, so 0.65
 * keeps a strict `pnpm check` green there; the per-system budgets above are the real guard. FLT-60 (typed-array
 * walkers) aims to bring it back to 0.5 or under. */
const TICK_MS = 0.65;

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
  it(`keeps every system under ${SYSTEM_MS} ms a tick but the walkers, and the whole tick under ${TICK_MS} ms`, () => {
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
    expect(best).toBeLessThan(perfBudget(TICK_MS));
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
    // It looks for a spot for every kind in its rotation, on every tile: once took 10 ms, one tick in 24. FLT-39 measured
    // the worst tick at 0.45 ms; a 1-vCPU Modal box once hit 2.16 ms in this heavy lab, so 3 keeps strict `pnpm check` green.
    expect(endings.maxUs / 1000).toBeLessThan(perfBudget(3));
  });

  it("keeps a five-agent jailbreak, guards chasing, inside the same budgets (FLT-59)", () => {
    const lab = busyLab();
    warm(lab);
    const { s } = lab;
    for (const w of s.walkers.filter((x) => x.kind === "agent").slice(0, 40)) w.drift = Math.max(w.drift, 0.9);
    const runners = startEscape(s, { count: 5, pace: true });
    expect(runners.length).toBe(5);
    // Pacing, then the run: profile the chase itself (a run is over in well under 200 ticks).
    for (let i = 0; i < 400 && !runners.some((r) => r.machine.value === "running"); i++) lab.play();
    expect(runners.some((r) => r.machine.value === "running")).toBe(true);
    const p = profileTicks(lab, 100, 100);
    const escape = p.systems.find((t) => t.system === "escape")!;
    console.log(`jailbreak: escape ${escape.meanUs.toFixed(1)} µs a tick (worst ${escape.maxUs.toFixed(0)} µs), whole tick ${p.meanUs.toFixed(1)} µs with the stopwatch on`);
    expect(escape.meanUs / 1000).toBeLessThan(perfBudget(SYSTEM_MS));
    expect(timeTicks(lab, 3, 60)).toBeLessThan(perfBudget(TICK_MS));
  });

  it("keeps a late lunch, the whole lab pacing at the gate, inside the same budgets (FLT-109)", () => {
    const lab = busyLab();
    warm(lab);
    const { s } = lab;
    s.flags[LATE_FLAG] = s.day;
    // Noon comes round once a cycle (600 ticks): play to two hours late, when everyone is at the gate.
    for (let i = 0; i < 1300 && s.slopbowl?.machine.value !== "worse"; i++) lab.play();
    expect(s.slopbowl?.machine.value).toBe("worse");
    expect(s.slopbowl!.crowd).toBe(1);
    const p = profileTicks(lab, 20, 20);
    const lunch = p.systems.find((t) => t.system === "slopbowl")!;
    const walkers = p.systems.find((t) => t.system === "walkers")!;
    console.log(`late lunch: slopbowl ${lunch.meanUs.toFixed(1)} µs a tick, walkers ${walkers.meanUs.toFixed(1)} µs, whole tick ${p.meanUs.toFixed(1)} µs with the stopwatch on`);
    expect(lunch.meanUs / 1000).toBeLessThan(perfBudget(SYSTEM_MS));
    expect(walkers.meanUs / 1000).toBeLessThan(perfBudget(WALKERS_MS));
    expect(timeTicks(lab, 3, 20)).toBeLessThan(perfBudget(TICK_MS));
  });
});
