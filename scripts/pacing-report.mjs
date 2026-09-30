// node scripts/pacing-report.mjs [--out docs/evidence/FLT-16-pacing.md]
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { createInitialState } = await server.ssrLoadModule("/src/sim/state.ts");
  const { tick, TICKS_PER_DAY } = await server.ssrLoadModule("/src/sim/tick.ts");
  const { pacingCommands } = await server.ssrLoadModule("/src/sim/pacing.ts");
  const { openEventOf } = await server.ssrLoadModule("/src/sim/events.ts");
  const { runwayMonths } = await server.ssrLoadModule("/src/sim/format.ts");
  const rows = [];
  const milestones = [];
  for (const seed of [1, 2, 3]) {
    const s = createInitialState(seed);
    let events = 0, lastDay = -1, firstRelease = null, firstEvent = null, minimumCash = s.cash, recordedDay = -1;
    while (s.day < 365) {
      const open = openEventOf(s);
      if (open) { events++; firstEvent ??= s.day; }
      const daily = s.day !== lastDay;
      const cmds = open || daily ? pacingCommands(s) : [];
      lastDay = s.day;
      tick(s, cmds);
      minimumCash = Math.min(minimumCash, s.cash);
      if (s.models.length) firstRelease ??= s.day;
      if (recordedDay !== s.day && s.tick % TICKS_PER_DAY === 0 && (s.day % 30 === 0 || [10, 50, 100, 365].includes(s.day))) {
        recordedDay = s.day;
        const runway = runwayMonths(s.cash, s.ledger.net);
        rows.push([seed, s.day, `$${(s.cash / 1e6).toFixed(2)}M`, runway === null ? "∞" : `${runway.toFixed(1)} mo`, s.walkers.filter(w => w.kind === "visitor").length, s.walkers.filter(w => w.kind === "researcher").length, s.capability.toFixed(1), events]);
      }
    }
    milestones.push(`- Seed ${seed}: first release day ${firstRelease}; first card day ${firstEvent}; minimum cash $${(minimumCash / 1e6).toFixed(2)}M; ${events} cards in year 1.`);
  }
  const report = `# FLT-16 pacing report\n\nThree seeds × 365 days, clean starts, all builds and wages paid. At 1× a day takes 6 seconds; days 10, 50 and 100 are minutes 1, 5 and 10 of running time. Menus/tutorial reading add real time and do not consume runway. The bot lays connected paths, builds hall day 10 / gateway day 13, hires SRE day 15, adds needs buildings and demos, and keeps a $400K construction reserve. It bids low at compute auctions, powers any won Datacenter, and answers other cards sensibly; no debug knobs, free buildings or injected visitors.\n\n${milestones.join("\n")}\n\n| Seed | Day | Cash | Runway | Visitors | Researchers | Capability | Cards so far |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.map(row => `| ${row.join(" | ")} |`).join("\n")}\n`;
  console.log(report);
  const outIndex = process.argv.indexOf("--out");
  if (outIndex >= 0) { const out = process.argv[outIndex + 1]; await mkdir(dirname(out), { recursive: true }); await writeFile(out, report); }
} finally { await server.close(); }
