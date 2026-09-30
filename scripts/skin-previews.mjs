#!/usr/bin/env node
// Regenerates each skin's picker thumbnail (src/skins/<id>/assets/preview.jpg) from the game itself: the same overview
// scene as skin-shots.mjs, 480×300. Needs a running preview server (pnpm build && pnpm preview).
//
//   node scripts/skin-previews.mjs                 # every skin
//   node scripts/skin-previews.mjs frontier-95     # one
import { chromium } from "playwright";
import { readdirSync, existsSync } from "node:fs";

const base = process.env.URL ?? "http://localhost:4173/";
const all = readdirSync("src/skins", { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(`src/skins/${e.name}/skin.json`)).map((e) => e.name);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const id of ids) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 / 3 });
  const page = await ctx.newPage();
  await page.goto(`${base}?debug=1&seed=3&speed=0&hour=13&warp=30&skin=${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const path = `src/skins/${id}/assets/preview.jpg`;
  await page.screenshot({ path, type: "jpeg", quality: 72 });
  console.log("saved", path);
  await ctx.close();
}
await browser.close();
