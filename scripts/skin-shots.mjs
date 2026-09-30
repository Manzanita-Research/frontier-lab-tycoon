#!/usr/bin/env node
// Evidence shots for the skin system (FLT-14): the same six scenes on any build, so before/after pairs line up.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/skin-shots.mjs docs/img/flt-14/before                       # main: no skins, the classic HUD
//   node scripts/skin-shots.mjs docs/img/flt-14/after --skin frontier-95
//   node scripts/skin-shots.mjs docs/img/flt-14/stubs --skin swag-drop --only a
//
// Scenes: a overview 1440x900, b inspector open, c the Water Discourse event card, d build bar / Start menu open,
// e phone 390x844, f photo mode. The game is paused (?speed=0) and driven through window.__flt (?debug=1).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: skin-shots.mjs <outDir> [--skin id] [--only a,b,c] [--prefix name] [--url http://localhost:4173/]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const skin = opt("skin", null);
const only = opt("only", "a,b,c,d,e,f").split(",");
const prefix = opt("prefix", "");
const base = opt("url", process.env.URL ?? "http://localhost:4173/");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
const NAMES = { a: "overview", b: "inspector", c: "event-card", d: "start-menu", e: "phone", f: "photo" };

async function scene(key, fn, { mobile = false, query = "" } = {}) {
  if (!only.includes(key)) return;
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${key}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${key}: ${m.text()}`));
  const skinQ = skin ? `&skin=${skin}` : "";
  await page.goto(`${base}?debug=1&seed=3&speed=0&hour=13${skinQ}${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await fn(page);
  await page.waitForTimeout(1500);
  const path = `${outDir}/${prefix}${key}-${NAMES[key]}${mobile && key !== "e" ? "-phone" : ""}.png`;
  await page.screenshot({ path });
  console.log("saved", path);
  await ctx.close();
}

const world = (page, src) => page.evaluate(new Function("f", "w", src.replace(/^[^{]*\{/, "").replace(/\}$/, "")).bind(null, undefined, undefined));
const inWorld = (page, fn) =>
  page.evaluate((src) => new Function("f", "w", `return (${src})(f, w)`)(window.__flt, window.__flt.sim.world), fn.toString());

await scene("a", async () => {}, { query: "&warp=30" });

await scene(
  "b",
  async (page) => {
    const id = await inWorld(page, (f, w) => {
      const r = w.walkers.find((x) => x.kind === "researcher" && x.name === "Ada Gradient") ?? w.walkers.find((x) => x.kind === "researcher");
      return r.id;
    });
    await page.evaluate((i) => window.__flt.send({ type: "SELECT", id: i }), id);
    await page.waitForTimeout(800);
  },
  { query: "&warp=30" },
);

await scene(
  "c",
  async (page) => {
    await inWorld(page, (f, w) => {
      w.waterDiscourse = 44;
      w.day = 60;
      w.tick = 61 * 20 - 1;
      f.tick(w);
    });
    await page.waitForTimeout(800);
  },
  { query: "&warp=30&discourse=44" },
);

await scene(
  "d",
  async (page) => {
    const start = await page.$('[data-testid="start-button"]');
    if (start) {
      await start.click();
      await page.waitForTimeout(500);
    } else {
      await page.evaluate(() => window.__flt.send({ type: "SET_TOOL", tool: "cluster" }));
    }
  },
  { query: "&warp=30" },
);

await scene("e", async () => {}, { mobile: true, query: "&warp=30" });
await scene("f", async () => {}, { query: "&warp=30&photo" });

await browser.close();
if (errors.length) console.log(`page errors (${errors.length}):\n  ${[...new Set(errors)].slice(0, 10).join("\n  ")}`);
