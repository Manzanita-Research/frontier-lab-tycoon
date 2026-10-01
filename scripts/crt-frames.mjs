#!/usr/bin/env node
// FLT-73: frame times with the picture tube off, subtle and full, on each canvas tier, as a markdown table.
// Needs the in-game tube on: set GAME_CRT in src/render/crt/state.ts to true first (FLT-70 turned it off).
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/crt-frames.mjs                 (headless SwiftShader: relative numbers, the GPU is the CPU)
//   URL=http://localhost:4173/ CRT_SECONDS=10 node scripts/crt-frames.mjs
//   CRT_GPU=1 node scripts/crt-frames.mjs      (on a machine with a GPU, e.g. the Mini: the real GPU, and the pass's
//                                               own GPU time in the gpu ms column where Chrome exposes timer queries)
//
// The scene is the busy mid-game campus, running (not paused). `?crt=` and `?crttier=` pin the look and the tier, so the
// governor stays out of it. SwiftShader has no timer queries, and its frame is mostly the campus and the page drawn in
// software, so there the numbers are only relative. On a real GPU the gpu ms column is the pass alone (`window.__crt.gpuMs`,
// EXT_disjoint_timer_query_webgl2, which `?debug=1` turns on); open the same URLs by hand to watch it live.
import { chromium } from "playwright";

const base = process.env.URL ?? "http://localhost:4173/";
const seconds = Number(process.env.CRT_SECONDS ?? 8);
const scene = "debug=1&scenario=midgame&seed=48&focus=11.5,14.5&zoom=43&skin=frontier-95&hour=13";
const runs = process.env.CRT_RUNS ? process.env.CRT_RUNS.split(",").map((r) => r.split(":")) : [
  ["off", null],
  ["subtle", "multi"],
  ["subtle", "lite"],
  ["full", "multi"],
  ["full", "lite"],
];
const viewports = [
  { name: "1440×900", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "phone 390×844 @2x", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

const gpu = !!process.env.CRT_GPU;
const browser = await chromium.launch({ args: gpu ? ["--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
for (const v of viewports) {
  for (const [crt, tier] of runs) {
    const ctx = await browser.newContext(v);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}?${scene}&crt=${crt}${tier ? `&crttier=${tier}` : ""}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(
      (ms) =>
        new Promise((done) => {
          const times = [];
          let last = performance.now();
          const t0 = last;
          const loop = (now) => {
            times.push(now - last);
            last = now;
            if (now - t0 < ms) requestAnimationFrame(loop);
            else {
              times.sort((a, b) => a - b);
              const c = window.__crt;
              done({
                frames: times.length,
                mean: times.reduce((a, b) => a + b, 0) / times.length,
                p50: times[Math.floor(times.length / 2)],
                p95: times[Math.floor(times.length * 0.95)],
                tier: c?.tier ?? "flat",
                dpr: c?.dpr ?? null,
                input: c?.input ? `${c.input.width}×${c.input.height}` : "",
                gpuMs: c?.gpuMs ?? null,
              });
            }
          };
          requestAnimationFrame(loop);
        }),
      seconds * 1000,
    );
    rows.push({ viewport: v.name, crt, ...r, errors: errors.length });
    console.error(v.name, crt, tier, JSON.stringify(r));
    await ctx.close();
  }
}
await browser.close();

const f = (n) => (n == null ? "–" : n.toFixed(1));
console.log(`_${gpu ? "GPU" : "SwiftShader (software)"}, ${seconds} s per row, busy mid-game campus running._\n`);
console.log(`| Viewport | Tube | Tier | Frames | Mean ms | p50 | p95 | vs off | gpu ms (pass) | DPR | Shader input | Page errors |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of rows) {
  const off = rows.find((o) => o.viewport === r.viewport && o.crt === "off");
  const delta = r.crt === "off" || !off ? "" : `${r.mean - off.mean >= 0 ? "+" : ""}${f(r.mean - off.mean)} ms`;
  console.log(`| ${r.viewport} | ${r.crt} | ${r.crt === "off" ? "–" : r.tier} | ${r.frames} | ${f(r.mean)} | ${f(r.p50)} | ${f(r.p95)} | ${delta} | ${r.crt === "off" ? "" : r.gpuMs == null ? "n/a" : r.gpuMs.toFixed(2)} | ${r.dpr ?? ""} | ${r.input} | ${r.errors} |`);
}
