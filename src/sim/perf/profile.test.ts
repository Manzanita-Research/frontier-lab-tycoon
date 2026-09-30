// FLT-39: the per-system table. `FLT_PROFILE=1 npx vitest run src/sim/perf/profile.test.ts --silent=false` prints it.
import { busyLab, profileTable, profileTicks, timeTicks } from "./busyLab";
import { answer } from "../testkit";
import { tick } from "../tick";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

describe.runIf(env.FLT_PROFILE)("the per-system profile (report only)", () => {
  it("prints the table at 800 walkers with every pack awake", () => {
    const { s, topUp } = busyLab();
    for (let i = 0; i < 100; i++) tick(s, answer(s)); // warm up the JIT and spread the crowd out
    const best = timeTicks(s, topUp);
    const p = profileTicks(s, 4000, topUp);
    console.log(`busy-lab tick: ${best.toFixed(3)} ms (best of 3 x 200 ticks, stopwatch off)\n${s.walkers.length} walkers at the end, day ${s.day}\n\n${profileTable(p)}`);
  });
});
