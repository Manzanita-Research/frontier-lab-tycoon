#!/usr/bin/env node
// Evidence shots for FLT-6 (Juice I): the moments a screenshot script can't get with one URL.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/juice-shots.mjs release  docs/img/flt-6/release.png
//   node scripts/juice-shots.mjs night    docs/img/flt-6/night.png
//   node scripts/juice-shots.mjs photo    docs/img/flt-6/photo.png      (opens photo mode, saves the real PNG the shutter makes)
//   node scripts/juice-shots.mjs phone    docs/img/flt-6/phone.png
//   node scripts/juice-shots.mjs record   docs/img/flt-6/tour.webm     (video tour)
//   node scripts/juice-shots.mjs coins    docs/img/flt-6/coins.png
//   node scripts/juice-shots.mjs protest  docs/img/flt-6/protest.png
//   node scripts/juice-shots.mjs fps                                     (frame times: photo mode off)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [mode, out] = process.argv.slice(2);
const base = process.env.URL ?? "http://localhost:4173/";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const mobile = mode === "phone";
const ctx = await browser.newContext({
  recordVideo: mode === "record" ? { dir: dirname(out ?? "docs/img/flt-6/x"), size: { width: 960, height: 600 } } : undefined,
  viewport: mode === "record" ? { width: 960, height: 600 } : mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const go = (q) => page.goto(`${base}?debug=1&seed=3&warp=25${q}`, { waitUntil: "networkidle" });
const save = async (path) => {
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  console.log("saved", path);
};

if (mode === "release") {
  await go("&zoom=78&focus=11.5,14&hour=13");
  await page.waitForTimeout(1500);
  // Force a release right now: fill the stockpile, top up the run, and let a day tick over.
  await page.evaluate(() => {
    const f = window.__flt;
    const w = f.sim.world;
    w.compute = 400;
    w.training.context.progress = w.training.context.cost - 1;
    for (let i = 0; i < 20; i++) f.tick(w);
  });
  await page.waitForTimeout(Number(process.env.WAIT ?? 700));
  await save(out);
} else if (mode === "record") {
  // A short tour for the PR: a release (camera swoops to the Hall, confetti, the crowd hops), night falls, then a photo.
  await go("&zoom=52&hour=15");
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const f = window.__flt;
    const w = f.sim.world;
    w.compute = 400;
    w.training.context.progress = w.training.context.cost - 1;
    for (let i = 0; i < 20; i++) f.tick(w);
  });
  await page.waitForTimeout(7000);
  await page.evaluate(() => (window.__fx.fx.hourOverride = 22.5));
  await page.waitForTimeout(5000);
  await page.keyboard.press("p");
  await page.waitForTimeout(3500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3500);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window.__fx.fx.hourOverride = null));
  await page.waitForTimeout(1500);
  const video = page.video();
  await ctx.close();
  await video.saveAs(out);
  console.log("saved", out);
} else if (mode === "coins") {
  // Payday on a healthy lab with a gateway: a fountain of coins and the sign flickers.
  await go("&zoom=95&focus=13,15.5&hour=13");
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const f = window.__flt;
    const w = f.sim.world;
    f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "gateway", x: 13, z: 17 } });
    w.cash += 5_000_000;
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const f = window.__flt;
    const w = f.sim.world;
    w.capability = 120;
    for (let i = 0; i < 20; i++) f.tick(w);
  });
  await page.waitForTimeout(Number(process.env.WAIT ?? 600));
  await save(out);
} else if (mode === "protest") {
  await page.goto(`${base}?debug=1&seed=3&warp=70&discourse=44&zoom=95&focus=11.5,19&hour=13`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await save(out);
} else if (mode === "night") {
  await go("&zoom=78&focus=11.5,14&hour=22.5");
  await page.waitForTimeout(6000);
  await save(out);
} else if (mode === "phone") {
  await go("&hour=21.5");
  await page.waitForTimeout(6000);
  await save(out);
} else if (mode === "photo") {
  await go(`&zoom=${process.env.ZOOM ?? 80}&focus=11.5,14&hour=${process.env.HOUR ?? 18.3}`);
  await page.waitForTimeout(1500);
  await page.keyboard.press("p");
  await page.waitForTimeout(3500);
  await save(out.replace(/\.png$/, "-screen.png"));
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.keyboard.press("Enter")]);
  await download.saveAs(out);
  console.log("saved", out, "as", download.suggestedFilename());
  await page.waitForTimeout(1200);
  await save(out.replace(/\.png$/, "-polaroid.png"));
} else if (mode === "fps") {
  await go("&hour=13");
  await page.waitForTimeout(2500);
  const r = await page.evaluate(
    () =>
      new Promise((done) => {
        const times = [];
        let last = performance.now();
        const t0 = last;
        const loop = (now) => {
          times.push(now - last);
          last = now;
          if (now - t0 < 8000) requestAnimationFrame(loop);
          else {
            times.sort((a, b) => a - b);
            done({ frames: times.length, meanMs: times.reduce((a, b) => a + b, 0) / times.length, p50: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)] });
          }
        };
        requestAnimationFrame(loop);
      }),
  );
  console.log(JSON.stringify(r));
} else {
  console.error("usage: juice-shots.mjs release|night|photo|phone|fps <out.png>");
  process.exit(2);
}
if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 8).join("\n  ")}`);
await browser.close().catch(() => {});
