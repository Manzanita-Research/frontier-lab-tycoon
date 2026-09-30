#!/usr/bin/env node
// How many toasts does a minute of real play put on the screen? Drives the real app in headless Chromium (the same
// SwiftShader setup as scripts/shot.mjs), answers every card with its first choice, and counts each distinct toast the
// app machine shows. Evidence for FLT-31 (the notification flood): run it on main and on the branch and compare.
//
//   pnpm build && (pnpm preview --port 4173 &) && sleep 2
//   node scripts/toast-count.mjs http://localhost:4173 --seconds 60 --speeds 1,3,10
//
// "Leapfrog toasts" are the ones a rival launch, a record, a solved benchmark or your own launch produce (the same text
// patterns as src/app/notices.ts). One run at a time: it is CPU-heavy on a 1-vCPU builder.
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

const LEAPFROG = [/ took your record on /, / launched .+\. The news cycle is theirs\.$/, / answers .+ a day later: /, / is solved\. Everyone is back to /, /^Counter-launch lands: |^The counter-launch is out, and |has a launch bug\.|is out at \d+%: the news cycle is yours/, /^The launch livestream goes flawlessly|^You own the news cycle/, / owns the news cycle\.$/, /while you were busy\./, /^You lost #1 on the Arena/];
const isLeapfrog = (text) => LEAPFROG.some((re) => re.test(text));

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
for (const speed of speeds) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${url}/?debug=1&seed=${seed}&warp=${warp}&speed=${speed}&hour=13`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__flt?.app, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const { registry, app, send, sim } = window.__flt;
    window.__seen = new Map();
    window.__day0 = sim.world.day;
    registry.subscribe(
      app.snapshot,
      (r) => {
        const ctx = r?.value?.context;
        if (!ctx) return;
        for (const t of ctx.toasts) if (!window.__seen.has(t.id)) window.__seen.set(t.id, t.text);
        if (ctx.event) send({ type: "CHOOSE", choiceIndex: 0 });
      },
      { immediate: true },
    );
  });
  await page.waitForTimeout(seconds * 1000);
  const { toasts, days } = await page.evaluate(() => ({ toasts: [...window.__seen.values()], days: window.__flt.sim.world.day - window.__day0 }));
  const lf = toasts.filter(isLeapfrog);
  rows.push({ speed, days, total: toasts.length, leapfrog: lf.length, texts: lf });
  await page.close();
}
await browser.close();

console.log(`| speed | game days in ${seconds} s | toasts shown | of which Release Leapfrog |`);
console.log("|---|---|---|---|");
for (const r of rows) console.log(`| ${r.speed}x | ${r.days} | ${r.total} | ${r.leapfrog} |`);
for (const r of rows) {
  console.log(`\n${r.speed}x Leapfrog toasts:`);
  for (const t of r.texts) console.log(`  - ${t}`);
}
