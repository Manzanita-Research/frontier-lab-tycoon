#!/usr/bin/env node
// How many toasts does a minute of real play put on the screen? Drives the real app in headless Chromium (the same
// SwiftShader setup as scripts/shot.mjs), answers every card with its first choice, and counts each distinct toast the
// app machine shows. Evidence for FLT-31 and FLT-51 (the notification flood): run it on main and on the branch and compare.
//
//   pnpm build && (pnpm preview --port 4173 &) && sleep 2
//   node scripts/toast-count.mjs http://localhost:4173 --seconds 60 --speeds 1,3,10
//   node scripts/toast-count.mjs http://localhost:4173 --scenario midgame      # FLT-51's busy campus
//
// Toasts are counted by the source the sim tagged them with (FLT-51); a build from before the tags counts them as "?".
// Ticker items are the headlines (and, after FLT-51, world notices) that joined the ticker. One run at a time: it is
// CPU-heavy on a 1-vCPU builder.
import { chromium } from "playwright";

const [url, ...rest] = process.argv.slice(2);
if (!url) {
  console.error("usage: toast-count.mjs <url> [--seconds 60] [--speeds 1,3,10] [--seed 3] [--warp 15]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const seconds = Number(opt("seconds", "60"));
const speeds = opt("speeds", "1,3,10").split(",").map(Number);
const seed = opt("seed", "3");
const warp = opt("warp", "15");
const scenario = opt("scenario", "");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
for (const speed of speeds) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const query = scenario ? `scenario=${scenario}` : `seed=${seed}&warp=${warp}&speed=${speed}&hour=13`;
  await page.goto(`${url}/?debug=1&${query}`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForFunction(() => window.__flt?.app, null, { timeout: 60_000 });
  // The actor only listens once the app has mounted: keep asking for the speed until it sticks.
  await page.waitForFunction((speed) => {
    const { registry, app, send } = window.__flt;
    if (registry.get(app.snapshot)?.value?.context?.speed === speed) return true;
    send({ type: "SET_SPEED", speed });
    return false;
  }, speed, { timeout: 90_000, polling: 500 });
  await page.evaluate((speed) => {
    const { registry, app, send, sim } = window.__flt;
    window.__seen = new Map();
    window.__news = new Set(registry.get(app.snapshot)?.value?.context?.news?.map((n) => n.id) ?? []);
    window.__ticker = 0;
    window.__day0 = sim.world.day;
    // A scenario opens paused.
    send({ type: "SET_SPEED", speed });
    // Poll rather than subscribe: answering a card from inside a snapshot callback feeds back into the snapshot.
    setInterval(() => {
      const ctx = registry.get(app.snapshot)?.value?.context;
      if (!ctx) return;
      for (const t of ctx.toasts) if (!window.__seen.has(t.id)) window.__seen.set(t.id, { text: t.text, source: t.batch ? "batch" : (t.source ?? "?") });
      for (const n of ctx.news) if (!window.__news.has(n.id)) (window.__news.add(n.id), window.__ticker++);
      if (ctx.event) send({ type: "CHOOSE", choiceIndex: 0 });
    }, 100);
  }, speed);
  await page.waitForTimeout(seconds * 1000);
  const { toasts, days, ticker } = await page.evaluate(() => ({ toasts: [...window.__seen.values()], days: window.__flt.sim.world.day - window.__day0, ticker: window.__ticker }));
  const bySource = {};
  for (const t of toasts) bySource[t.source] = (bySource[t.source] ?? 0) + 1;
  rows.push({ speed, days, total: toasts.length, ticker, bySource, texts: toasts.map((t) => `[${t.source}] ${t.text}`) });
  await page.close();
}
await browser.close();

const per = (n) => (n * 60 / seconds).toFixed(1);
console.log(`| speed | game days in ${seconds} s | toasts shown | toasts / real min | ticker items / real min | toasts by source |`);
console.log("|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.speed}x | ${r.days} | ${r.total} | ${per(r.total)} | ${per(r.ticker)} | ${Object.entries(r.bySource).map(([k, v]) => `${k} ${v}`).join(", ")} |`);
for (const r of rows) {
  console.log(`\n${r.speed}x toasts:`);
  for (const t of r.texts) console.log(`  - ${t}`);
}
