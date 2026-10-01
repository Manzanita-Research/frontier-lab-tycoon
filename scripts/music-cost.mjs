#!/usr/bin/env node
// FLT-66: the band's main-thread cost at each game speed, measured live in the real game (headless Chromium, audio
// unlocked by a key press). The band times every `pump` (planning bars, building voices) and counts the voices it starts.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/music-cost.mjs [--url http://localhost:4173/] [--seconds 15]
import { chromium } from "playwright";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const base = arg("url", "http://localhost:4173/");
const seconds = Number(arg("seconds", "15"));
const skin = arg("skin", null);
const url = `${base}${base.includes("?") ? "&" : "?"}debug=1&seed=3&warp=12&speed=1${skin ? `&skin=${skin}` : ""}`;

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__sound && window.__flt, null, { timeout: 60000 });
await page.keyboard.press("Shift");
await page.waitForFunction(() => window.__sound.diagnostics().status === "running", null, { timeout: 20000 });
const fps = () => page.evaluate(() => new Promise((done) => { let n = 0; const t0 = performance.now(); const f = () => (++n, performance.now() - t0 < 2000 ? requestAnimationFrame(f) : done(n / ((performance.now() - t0) / 1000))); requestAnimationFrame(f); }));
const rows = [];
for (const speed of [0, 1, 3, 10]) {
  await page.evaluate((speed) => window.__flt.send({ type: "SET_SPEED", speed }), speed);
  // The switch waits for the bar line; give it two bars before the clock starts.
  await page.waitForTimeout(3500);
  const before = await page.evaluate(() => window.__sound.diagnostics().music);
  const rate = await fps();
  await page.waitForTimeout(seconds * 1000 - 2000);
  const after = await page.evaluate(() => window.__sound.diagnostics().music);
  const m = after.playing; const a = after.cost[m]; const b = before.cost[m];
  const frames = a.frames - b.frames;
  rows.push({ speed, mode: m, bpm: after.bpm, frames, fps: rate, meanMs: (a.meanMs * a.frames - b.meanMs * b.frames) / frames, maxMs: a.maxMs, voicesPerSecond: (a.voicesPerSecond * a.seconds - b.voicesPerSecond * b.seconds) / (a.seconds - b.seconds) });
  console.log(JSON.stringify(rows.at(-1)));
}
const bench = await page.evaluate(() => window.__sound.benchMusic(30));
await browser.close();
console.log(["", "| Speed | Music | BPM | Frames | FPS (headless) | Mean ms/frame | Worst ms/frame | Voices/s |", "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.speed === 0 ? "pause" : `${r.speed}×`} | ${r.mode} | ${r.bpm} | ${r.frames} | ${r.fps.toFixed(0)} | ${r.meanMs.toFixed(3)} | ${r.maxMs.toFixed(2)} | ${r.voicesPerSecond.toFixed(1)} |`)].join("\n"));
console.log(["", "Isolated (the band alone, a pump per 60 Hz frame, 30 s per mode):", "", "| Music | Mean ms/frame | p50 | p99 | Worst | Voices/s |", "|---|---|---|---|---|---|",
  ...Object.entries(bench).map(([m, b]) => `| ${m} | ${b.meanMs.toFixed(3)} | ${b.p50.toFixed(3)} | ${b.p99.toFixed(3)} | ${b.maxMs.toFixed(2)} | ${b.voicesPerSecond.toFixed(1)} |`)].join("\n"));
