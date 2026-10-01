// FLT-86's evidence, not a CI test: cash curves and the win day across 20 seeds, for two players.
//
//   careful  the playthrough bot (src/sim/bot.ts): gateways first, builds with a cash reserve, answers every card.
//   careless a new lab (the real opening, ladder and all) that builds two Training Halls and three Compute Clusters on
//            day 1, never builds a Gateway, and answers every card with its first choice: PLAY IT's run 2.
//
// It only uses what main has always had (playBot, createInitialState, tick, openEventOf, outcomeOf), so the same file
// runs on main for the "before" numbers:
//
//   node scripts/money-report.mjs --json /tmp/after.json [--seeds 20]
//   node scripts/money-report.mjs --compare /tmp/before.json /tmp/after.json --out docs/evidence/FLT-86-money.md
import { createServer } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const SAMPLE_DAYS = [30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720];

if (args.includes("--compare")) {
  const i = args.indexOf("--compare");
  const before = JSON.parse(await readFile(args[i + 1], "utf8"));
  const after = JSON.parse(await readFile(args[i + 2], "utf8"));
  const md = compare(before, after);
  const out = opt("--out", null);
  if (out) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, md);
  }
  console.log(md);
  process.exit(0);
}

const seeds = Array.from({ length: Number(opt("--seeds", 20)) }, (_, i) => i + 1);
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { playBot } = await server.ssrLoadModule("/src/sim/bot.ts");
  const { createInitialState } = await server.ssrLoadModule("/src/sim/state.ts");
  const { tick, TICKS_PER_DAY } = await server.ssrLoadModule("/src/sim/tick.ts");
  const { openEventOf } = await server.ssrLoadModule("/src/sim/events.ts");
  const { outcomeOf } = await server.ssrLoadModule("/src/sim/goals.ts");
  const { findSpot, layPaths } = await server.ssrLoadModule("/src/sim/testkit.ts");
  const { pendingConfirmOf } = await server.ssrLoadModule("/src/sim/guardrails.ts");
  const { enableEndings } = await server.ssrLoadModule("/src/sim/endings/state.ts");

  const careful = [];
  for (const seed of seeds) {
    const curve = {};
    const out = {};
    const t0 = Date.now();
    const r = playBot(seed, {
      out,
      // Sample the cash on the way (until is asked once a tick).
      until: (s) => {
        if (s.tick % TICKS_PER_DAY === 0 && SAMPLE_DAYS.includes(s.day)) curve[s.day] ??= s.cash;
        return false;
      },
    });
    const s = out.state;
    const met = s.goals.context.goals.map((g) => g.met);
    careful.push({ seed, outcome: r.outcome, winDay: r.outcome === "won" ? r.endDay : null, minCash: r.minCash, curve, met, cards: r.cards, ms: Date.now() - t0 });
    console.error(`careful seed ${seed}: ${r.outcome} day ${r.endDay} (${Date.now() - t0} ms)`);
  }

  const careless = [];
  for (const seed of seeds) {
    const s = createInitialState(seed);
    // As the app does: the endings are on, so going broke is Acqui-hired.
    enableEndings(s);
    layPaths(s);
    const curve = {};
    let rounds = 0;
    let lastCash = s.cash;
    const toBuild = ["hall", "hall", "cluster", "cluster", "cluster"];
    const end = 720 * TICKS_PER_DAY;
    for (let i = 0; i < end && outcomeOf(s) === "playing"; i++) {
      const cmds = [];
      const open = openEventOf(s);
      const pending = pendingConfirmOf(s);
      if (open) cmds.push({ type: "chooseEvent", eventId: open.id, choiceIndex: 0 });
      else if (pending) cmds.push({ ...pending.command, confirmed: true });
      else if (toBuild.length) {
        const kind = toBuild.shift();
        const spot = findSpot(s, kind);
        if (spot) cmds.push({ type: "placeBuilding", kind, x: spot[0], z: spot[1], confirmed: true });
      }
      tick(s, cmds);
      // An emergency round is the only way cash jumps by a million in a lab with no income.
      if (s.cash - lastCash > 900_000) rounds++;
      lastCash = s.cash;
      if (s.tick % TICKS_PER_DAY === 0 && SAMPLE_DAYS.includes(s.day)) curve[s.day] ??= s.cash;
    }
    careless.push({ seed, outcome: outcomeOf(s), endDay: s.day, rounds, curve, ending: s.endings?.id ?? null, gateways: s.buildings.filter((b) => b.kind === "gateway").length });
    console.error(`careless seed ${seed}: ${outcomeOf(s)} day ${s.day}, rounds ${rounds}`);
  }
  const json = { label: opt("--label", ""), seeds, careful, careless };
  const path = opt("--json", null);
  if (path) await writeFile(path, JSON.stringify(json, null, 1));
  else console.log(JSON.stringify(json));
} finally {
  await server.close();
}

function stats(xs) {
  const v = xs.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!v.length) return { n: 0, min: null, med: null, max: null };
  return { n: v.length, min: v[0], med: v[Math.floor(v.length / 2)], max: v[v.length - 1] };
}
function money(n) {
  if (n === null || n === undefined) return "–";
  const a = Math.abs(n);
  const t = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : `$${Math.round(a / 1e3)}K`;
  return n < 0 ? `−${t}` : t;
}
function compare(before, after) {
  const lines = [];
  lines.push(`# FLT-86: money and the win, before vs after (${before.seeds.length} seeds)`, "");
  lines.push("`node scripts/money-report.mjs` on main and on this branch. The careful player is the playthrough bot (`src/sim/bot.ts`); the careless player is PLAY IT's run 2 (a new lab that builds two Halls and three Clusters on day 1, never a Gateway, and answers every card with its first choice).", "");
  lines.push("## Careful player: the win", "");
  lines.push("| | Before | After |", "|---|---:|---:|");
  const wonB = before.careful.filter((r) => r.outcome === "won");
  const wonA = after.careful.filter((r) => r.outcome === "won");
  lines.push(`| Won | ${wonB.length}/${before.careful.length} | ${wonA.length}/${after.careful.length} |`);
  const wb = stats(before.careful.map((r) => r.winDay));
  const wa = stats(after.careful.map((r) => r.winDay));
  lines.push(`| Win day: min / median / max | ${wb.min} / ${wb.med} / ${wb.max} | ${wa.min} / ${wa.med} / ${wa.max} |`);
  const mb = stats(before.careful.map((r) => r.minCash));
  const ma = stats(after.careful.map((r) => r.minCash));
  lines.push(`| Lowest cash: min / median | ${money(mb.min)} / ${money(mb.med)} | ${money(ma.min)} / ${money(ma.med)} |`);
  lines.push("", "Win day per seed:", "", `| Seed | ${before.seeds.join(" | ")} |`, `|---|${before.seeds.map(() => "---:").join("|")}|`);
  lines.push(`| Before | ${before.careful.map((r) => r.winDay ?? r.outcome).join(" | ")} |`);
  lines.push(`| After | ${after.careful.map((r) => r.winDay ?? r.outcome).join(" | ")} |`);
  lines.push("", "### Careful player: median cash by day", "", "| Day | Before | After |", "|---:|---:|---:|");
  for (const d of SAMPLE_DAYS) {
    const b = stats(before.careful.map((r) => r.curve[d]));
    const a = stats(after.careful.map((r) => r.curve[d]));
    if (!b.n && !a.n) continue;
    lines.push(`| ${d} | ${money(b.med)} (n=${b.n}) | ${money(a.med)} (n=${a.n}) |`);
  }
  lines.push("", "## Careless player: going broke", "", "| | Before | After |", "|---|---:|---:|");
  const outB = {};
  const outA = {};
  for (const r of before.careless) outB[r.outcome] = (outB[r.outcome] ?? 0) + 1;
  for (const r of after.careless) outA[r.outcome] = (outA[r.outcome] ?? 0) + 1;
  lines.push(`| Outcome after up to 720 days | ${Object.entries(outB).map(([k, v]) => `${k} ${v}`).join(", ")} | ${Object.entries(outA).map(([k, v]) => `${k} ${v}`).join(", ")} |`);
  const eb = stats(before.careless.filter((r) => r.outcome !== "playing").map((r) => r.endDay));
  const ea = stats(after.careless.filter((r) => r.outcome !== "playing").map((r) => r.endDay));
  lines.push(`| Day it ended: min / median / max | ${eb.n ? `${eb.min} / ${eb.med} / ${eb.max}` : "never"} | ${ea.n ? `${ea.min} / ${ea.med} / ${ea.max}` : "never"} |`);
  const rb = stats(before.careless.map((r) => r.rounds));
  const ra = stats(after.careless.map((r) => r.rounds));
  lines.push(`| Emergency rounds taken: min / median / max | ${rb.min} / ${rb.med} / ${rb.max} | ${ra.min} / ${ra.med} / ${ra.max} |`);
  lines.push("", "### Careless player: median cash by day", "", "| Day | Before | After |", "|---:|---:|---:|");
  for (const d of SAMPLE_DAYS) {
    const b = stats(before.careless.map((r) => r.curve[d]));
    const a = stats(after.careless.map((r) => r.curve[d]));
    if (!b.n && !a.n) continue;
    lines.push(`| ${d} | ${money(b.med)} (n=${b.n}) | ${money(a.med)} (n=${a.n}) |`);
  }
  return lines.join("\n") + "\n";
}
