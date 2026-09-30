// PAPERS_REPORT=1 CI=1 pnpm vitest run src/sim/race/papers/report.test.ts
import { dailyPapers, enablePapers, setPublicationPolicy } from "./driver";
import { runPapersHeadless } from "./headless";
import { papersView } from "./view";
import { createInitialState } from "../../state";
import { createRng } from "../../rng";
import { perfBudget } from "../../testkit";

describe("365-day papers evidence", () => {
  it("compares actual recruiting and rival spill for all policies, with scoop and award reachable", async () => {
    const rows = [1, 2, 3].flatMap((seed) => [
      runPapersHeadless(seed, "Open", true), runPapersHeadless(seed, "Open"),
      runPapersHeadless(seed, "Selective"), runPapersHeadless(seed, "Closed"),
    ]);
    const total = (policy: string, key: "applicants" | "spill" | "scoops" | "awards") => rows.filter((r) => r.policy === policy).reduce((n, r) => n + r[key], 0);
    rows.forEach((r) => expect(r.day, `seed ${r.seed} ${r.policy}: ${r.outcome}`).toBe(365));
    expect(total("Open", "applicants")).toBeGreaterThan(total("Closed", "applicants"));
    expect(total("Open", "spill")).toBeGreaterThan(0);
    expect(total("Closed", "spill")).toBe(0);
    expect(total("Selective", "scoops")).toBeGreaterThan(0);
    expect(total("Selective", "awards")).toBeGreaterThan(0);
    const replay = runPapersHeadless(1, "Selective");
    expect(replay.world).toEqual(rows.find((r) => r.seed === 1 && r.policy === "Selective")!.world);
    const s = createInitialState(3);
    enablePapers(s);
    const rng = createRng(3);
    setPublicationPolicy(s, "Open", rng);
    s.models = Array.from({ length: 30 }, (_, i) => `Frontier-${i + 1}`);
    const t0 = performance.now();
    for (let d = 1; d <= 365; d++) { s.day = d; dailyPapers(s, rng); }
    const dailyMs = (performance.now() - t0) / 365;
    const t1 = performance.now();
    for (let i = 0; i < 500; i++) papersView(s);
    const viewMs = (performance.now() - t1) / 500;
    expect(dailyMs).toBeLessThan(perfBudget(3));
    const lines = ["# FLT-28 sim evidence", "", "Normal ticks with Release Leapfrog on; the bot builds revenue, compute, halls and amenities, hires operations staff, and answers every event card. Each run stops at actual day 365. No forced papers, scoop dice or awards. Applicant focus is recorded on arrival. Spill is cumulative capability delivered through rival SHOCK; final rival capability also reflects their ordinary releases.", "",
      "| Seed | Policy | Days | Applicants | Mean applicant focus | Published | Scoops | Awards | Critiques | Knowledge spill | Final rival capability sum |", "|---|---|---|---|---|---|---|---|---|---|---|"];
    for (const r of rows) lines.push(`| ${r.seed} | ${r.policy} | ${r.day} | ${r.applicants} | ${r.applicantFocus.toFixed(3)} | ${r.published} | ${r.scoops} | ${r.awards} | ${r.critiques} | ${r.spill.toFixed(2)} | ${r.rivalCapability.toFixed(2)} |`);
    lines.push("", "Seed 1 Selective replay: complete JSON World equal.", "", `30-paper daily driver: ${(dailyMs * 1000).toFixed(1)} µs/day; view: ${(viewMs * 1000).toFixed(1)} µs/snapshot. Measured on 1-vCPU Modal; daily budget ${perfBudget(3)} ms (doubled under CI). No per-tick publication work.`, "",
      "Closed retains drafts and accumulates publication pressure for FLT-26. Explicit publish commands can override defaults. Best-paper awards exist in the snapshot; the campus trophy and papers panel belong to the following UI task.", "");
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (env?.PAPERS_REPORT) {
      const fs = await import(/* @vite-ignore */ ("node:fs" as string));
      fs.mkdirSync("docs/evidence/flt-28", { recursive: true });
      fs.writeFileSync("docs/evidence/flt-28/report.md", lines.join("\n"));
    }
    console.log(lines.join("\n"));
  }, 120_000);
});
