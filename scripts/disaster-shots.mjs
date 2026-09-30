#!/usr/bin/env node
// Before/after evidence for FLT-17 (Disasters). The "after" is the branch, staged with `?disaster=` (sim/disasters/demo.ts);
// the "before" is `main` at the same seed, the same camera, the same viewport and the same tick, with the same crew hired and
// no disaster: `main` has no `?disaster=`, so the script drives its World through `window.__flt` (`?debug=1`).
//
//   pnpm build && (pnpm preview &)                                       # the branch, on :4173
//   (cd ../main-checkout && pnpm build && pnpm exec vite preview --port 4174 &)   # main, on :4174
//   node scripts/disaster-shots.mjs docs/img/flt-17                      # every scene, before and after, desktop and phone
//   node scripts/disaster-shots.mjs docs/img/flt-17 fire                 # one scene
//   AFTER=http://localhost:4173/ BEFORE=http://localhost:4174/ node scripts/disaster-shots.mjs ...
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [outDir = "docs/img/flt-17", ...only] = process.argv.slice(2);
const after = process.env.AFTER ?? "http://localhost:4173/";
const before = process.env.BEFORE ?? "http://localhost:4174/";

// Each scene: what to stage on the branch, and the camera both builds use.
const SCENES = {
  swarm: { q: "disaster=rogueSwarm&dz=20&dzPick=0", cam: "zoom=72&focus=11.6,18.4", phone: "zoom=52&focus=11.2,17.4", note: "Security jogging to the Security Office, posts empty" },
  "swarm-card": { q: "disaster=rogueSwarm&dz=8", cam: "zoom=70&focus=11.5,15.5", note: "the alert card" },
  fire: { q: "disaster=gpuFire&dz=16", cam: "zoom=88&focus=10.2,14.6", note: "a cluster on fire, an SRE running to it" },
  leak: { q: "disaster=weightsLeak&dz=8", cam: "zoom=70&focus=11.5,15.5", note: "the leak card: Sue, Shrug, always going to be open" },
};

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];

async function open(mobile) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return page;
}

const base = "debug=1&seed=3&speed=0&hour=13";

async function run(name, scene, mobile) {
  const page = await open(mobile);
  const cam = mobile ? (scene.phone ?? scene.cam) : scene.cam;
  const suffix = mobile ? "-phone" : "";
  mkdirSync(outDir, { recursive: true });

  await page.goto(`${after}?${base}&${cam}&${scene.q}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const tick = await page.evaluate(() => window.__flt.sim.world.tick);
  await page.screenshot({ path: `${outDir}/${name}${suffix}-after.png` });
  console.log("saved", `${outDir}/${name}${suffix}-after.png`, `(tick ${tick})`);

  // Main: the same lab (three Security and two SREs walk in through the gate), run to the same tick, no disaster.
  await page.goto(`${before}?${base}&${cam}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate((n) => {
    const { sim, tick } = window.__flt;
    const w = sim.world;
    w.cash = Math.max(w.cash, 12_000_000);
    const hires = ["security", "security", "security", "sre", "sre"].map((job) => ({ type: "hire", job }));
    for (let i = 0; i < n; i++) tick(w, i === 0 ? hires : []);
    w.toasts = [];
  }, tick);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/${name}${suffix}-before.png` });
  console.log("saved", `${outDir}/${name}${suffix}-before.png`);
  await page.context().close();
}

for (const [name, scene] of Object.entries(SCENES)) {
  if (only.length > 0 && !only.includes(name)) continue;
  await run(name, scene, false);
  // Phone (390x844): the layout is what it is; one scene each way shows the alert and the cards fit.
  if (name === "swarm" || name === "leak") await run(name, scene, true);
}
await browser.close();
if (errors.length > 0) {
  console.error("page errors:\n" + [...new Set(errors)].join("\n"));
  process.exitCode = 1;
}
