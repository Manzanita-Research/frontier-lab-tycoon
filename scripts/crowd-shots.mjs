#!/usr/bin/env node
// Evidence screenshots for FLT-8 (the Crowd): stages a busy campus through the ?debug=1 hook, then shoots it.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/crowd-shots.mjs [outDir] [baseUrl]
//
// Every shot is a real game state; the only staging is the debug hook (extra cash, a few needs set by hand so the
// scene shows the moment, and the researcher in the inspector shots is renamed to match the spec's example).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "docs/img/flt-8";
const base = process.argv[3] ?? "http://localhost:4173";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];

async function scene(name, { size = [1440, 900], mobile = false, query = "", stage, after, wait = 2500 }) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(`${base}/?debug=1&seed=3&warp=10&speed=1${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if (stage) await page.evaluate(stage);
  await page.waitForTimeout(wait);
  if (after) await after(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", `${out}/${name}.png`);
  await page.close();
}

// Build the three new buildings beside the cross path, pause, and make a crowd of tired researchers.
const STAGE = `
(async () => {
  const f = window.__flt;
  const w = f.sim.world;
  w.cash = 50_000_000;
  f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "gateway", x: 9, z: 8 } });
  f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "nap", x: 6, z: 17 } });
  f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "snack", x: 9, z: 17 } });
  f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "demo", x: 14, z: 17 } });
})()`;

const TIRED = `
(() => {
  const f = window.__flt;
  const rs = f.sim.world.walkers.filter((w) => w.kind === "researcher");
  rs.forEach((w, i) => { w.energy = i < 23 ? 0.1 + (i % 5) * 0.02 : 0.9; w.focus = 0.9; w.fomo = 0.05; w.lost = ""; });
  const ada = rs[0];
  ada.name = "Dr. Ada Gradient";
  ada.role = "Member of Technical Staff";
  ada.pro = 0;
  ada.energy = 0.12;
  ada.stats.joined = 63; ada.stats.sips = 14; ada.stats.offers = 2; ada.stats.rival = 2;
  ada.mood = { value: "slumped", context: { days: 0 } };
  window.__ada = ada.id;
})()`;

const SELECT = `window.__flt.send({ type: "SELECT", id: window.__ada })`;
const PAUSE = `window.__flt.send({ type: "SET_SPEED", speed: 0 })`;
const PLAY = (n) => `window.__flt.send({ type: "SET_SPEED", speed: ${n} })`;

/** Stage the buildings, let them appear, then freeze time and set the tired crowd. */
const frozenTired = async (page) => {
  await page.evaluate(PAUSE);
  await page.waitForTimeout(300);
  await page.evaluate(TIRED);
  await page.waitForTimeout(500);
  await page.evaluate(SELECT);
  await page.waitForTimeout(1500);
};

await scene("inspector-and-thoughts", {
  query: "&researchers=14&zoom=52",
  stage: STAGE,
  after: frozenTired,
});

// Tap the top Thoughts row: everyone thinking it gets a golden halo.
await scene("thoughts-highlight", {
  query: "&researchers=14&zoom=70&focus=10,15",
  stage: STAGE,
  after: async (page) => {
    await page.evaluate(PAUSE);
    await page.waitForTimeout(300);
    await page.evaluate(TIRED);
    await page.waitForTimeout(800);
    await page.click(".thought-row");
    await page.waitForTimeout(1200);
  },
});

await scene("vibes-tooltip", {
  query: "&researchers=14",
  stage: STAGE,
  after: async (page) => {
    await page.hover(".vibes-btn");
    await page.waitForTimeout(600);
  },
});

await scene("phone-inspector", {
  size: [390, 844],
  mobile: true,
  query: "&researchers=14&zoom=34",
  stage: STAGE,
  after: frozenTired,
});

await scene("phone-thoughts", {
  size: [390, 844],
  mobile: true,
  query: "&researchers=14&zoom=34",
  stage: STAGE,
  after: async (page) => {
    await page.evaluate(PAUSE);
    await page.evaluate(TIRED);
    await page.waitForTimeout(600);
    await page.click(".thoughts-head");
    await page.waitForTimeout(800);
  },
});

await scene("phone-vibes", {
  size: [390, 844],
  mobile: true,
  query: "&researchers=14&zoom=34",
  stage: STAGE,
  after: async (page) => {
    await page.click(".vibes-btn");
    await page.waitForTimeout(600);
  },
});

// A researcher on day five of misery: box in hand, out the gate. Shot while they walk.
await scene("box-and-slump", {
  query: "&researchers=10&zoom=95&focus=11,17",
  stage: STAGE,
  wait: 500,
  after: async (page) => {
    await page.evaluate(`(() => {
      const rs = window.__flt.sim.world.walkers.filter((w) => w.kind === "researcher");
      rs.forEach((w, i) => { w.energy = 0.25; w.focus = 0.2; w.fomo = 0.5; });
      rs.slice(0, 2).forEach((w) => { w.energy = 0; w.focus = 0; w.fomo = 1; w.mood = { value: "miserable", context: { days: 4 } }; });
    })()`);
    await page.evaluate(PLAY(3));
    await page.waitForFunction(() => window.__flt.sim.world.walkers.some((w) => w.machine.value === "quitting"), null, { timeout: 60000 });
    await page.evaluate(`window.__flt.send({ type: "SELECT", id: window.__flt.sim.world.walkers.find((w) => w.machine.value === "quitting").id })`);
    await page.waitForTimeout(900);
  },
});

await browser.close();
if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 10).join("\n  ")}`);
