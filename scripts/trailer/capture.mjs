#!/usr/bin/env node
// FLT-97: smooth footage of the real game on a 1-vCPU box. Headless Chromium runs on Playwright's fake clock and we
// flush requestAnimationFrame by hand, once per video frame, so every frame is exactly 1/fps of game time however
// slow SwiftShader is. The 3D canvas renders at devicePixelRatio 1 (the HUD stays crisp at 1.5×), which is what makes
// 1080p affordable: about 0.3 s a frame. Staging links only (`?moment=`, `?seed=`, `/box?beat=`), in a fresh browser
// context, so no real autosave is ever read or written.
//
//   node scripts/trailer/capture.mjs --shots scripts/trailer/shots.json [--only bird,escape] [--still] [--out shots/trailer/clips]
//
// A shot: { "name", "url" (path + query on --base), "seconds", "warmup" (game ms before frame 0, default 4000),
//   "fps" (default 30), "viewport" ([w, h] CSS px, default [1280, 720]; always rendered 1920 wide, so a smaller
//   viewport is a close-up of the HUD), "dpr" (the canvas's devicePixelRatio, default 1), "css" (injected, e.g. to hide the box's buttons),
//   "setup" and "actions": [{ "at": seconds, "click"|"eval"|"key"|"hover"|"mouse"|"wheel": ... }] }.
// Writes <out>/<name>.mp4 (x264 CRF 14, 1920×1080) or, with --still, <out>/<name>.png after the warmup.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const base = arg("base", "https://app.frontierlabtycoon.com");
const out = arg("out", "shots/trailer/clips");
const only = arg("only", "").split(",").filter(Boolean);
const still = process.argv.includes("--still");
const shots = JSON.parse(readFileSync(arg("shots", "scripts/trailer/shots.json"), "utf8")).filter((s) => !only.length || only.includes(s.name));
mkdirSync(out, { recursive: true });
// Named styles a shot can ask for: "@box" hides the box's buttons and captions, so only the 3D (and the boot) shows.
const CSS = { "@box": ".intro-caption, .intro-cta, .intro-skip, .intro-hold, .intro-flip, .intro-turn, .intro-primary, .intro-contents, .intro-store, .intro-focus, .intro-folio { display: none !important; }" };

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

async function act(page, a) {
  if (a.click) await page.click(a.click, { force: true, timeout: 5000 }).catch((e) => console.log(`  click ${a.click}: ${e.message.split("\n")[0]}`));
  if (a.hover) await page.hover(a.hover, { force: true, timeout: 5000 }).catch(() => {});
  if (a.key) await page.keyboard.press(a.key);
  if (a.mouse) await page.mouse.click(a.mouse[0], a.mouse[1]);
  if (a.wheel) { await page.mouse.move(a.wheel[0], a.wheel[1]); await page.mouse.wheel(0, a.wheel[2]); }
  if (a.eval) await page.evaluate(a.eval).catch((e) => console.log(`  eval: ${e.message.split("\n")[0]}`));
}

for (const shot of shots) {
  const t0 = Date.now();
  const fps = shot.fps ?? 30;
  const [w, h] = shot.viewport ?? [1280, 720];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1920 / w });
  // "dpr": what the 3D canvas sees (default 1, the cheap one; the HUD is drawn at the real scale either way).
  await ctx.addInitScript((dpr) => Object.defineProperty(window, "devicePixelRatio", { get: () => dpr }), shot.dpr ?? 1);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  pageerror: ${String(e).slice(0, 160)}`));
  await page.clock.install();
  await page.goto(base + shot.url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    let queue = []; let id = 0;
    window.requestAnimationFrame = (cb) => { queue.push([++id, cb]); return id; };
    window.cancelAnimationFrame = (x) => { queue = queue.filter(([i]) => i !== x); };
    window.__flushFrame = (t) => { const run = queue; queue = []; for (const [, cb] of run) cb(t); };
  });
  let now = 0;
  // Callbacks get the page's own clock, as a browser's rAF does: anything that times itself from performance.now() (the
  // HUD's Odometer) would otherwise see a negative elapsed time and roll its number off to minus billions (FLT-109).
  const step = async (ms) => { await page.clock.runFor(ms); now += ms; await page.evaluate(() => window.__flushFrame(performance.now())); };
  // Warm up in big steps (the sim and the asset loads), then let the network settle.
  for (let t = 0; t < (shot.warmup ?? 4000); t += 100) await step(100);
  await page.waitForLoadState("networkidle").catch(() => {});
  if (shot.css) await page.addStyleTag({ content: CSS[shot.css] ?? shot.css });
  for (const a of shot.setup ?? []) { await act(page, a); await step(100); }
  if (still) {
    await step(1000 / fps);
    await page.screenshot({ path: join(out, `${shot.name}.png`) });
    console.log(`${shot.name}: still in ${Date.now() - t0} ms`);
    await ctx.close();
    continue;
  }
  const dir = join(out, `.${shot.name}`);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const frames = Math.round(shot.seconds * fps);
  const actions = [...(shot.actions ?? [])].sort((a, b) => a.at - b.at);
  for (let f = 0; f < frames; f++) {
    while (actions.length && actions[0].at * fps <= f) await act(page, actions.shift());
    await step(1000 / fps);
    await page.screenshot({ path: join(dir, `${String(f).padStart(5, "0")}.png`) });
  }
  await ctx.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "%05d.png"), "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p", join(out, `${shot.name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${shot.name}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
