#!/usr/bin/env node
// FLT-13: same seed, same frame, same camera; procedural vs generated, normal and photo mode.
//   pnpm build && (pnpm preview &) && node scripts/fal3d/campus-shots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.URL ?? "http://localhost:4173/";
const OUT = "docs/experiments/flt-13/img";
mkdirSync(OUT, { recursive: true });
// Seed 3, 8 days in (a quiet campus, no protest crowd), a paused noon: the Hall at tile (12,11), the cluster at (8,11), the float parked at (14,15).
const common = "seed=3&warp=8&hour=13&speed=0&float=14,15";
const views = {
  hall: "focus=13.5,12.3&zoom=105",
  cluster: "focus=9,12&zoom=125",
  float: "focus=15.5,16&zoom=115",
  campus: "focus=12.5,13.3&zoom=84",
};
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 720, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const only = process.env.VIEWS?.split(",");
for (const [view, cam] of Object.entries(views)) {
  if (only && !only.includes(view)) continue;
  for (const photo of [false, true]) {
    if (view === "campus" && photo) continue;
    await page.setViewportSize(view === "campus" ? { width: 1100, height: 700 } : { width: 720, height: 640 });
    for (const mode of ["proc", "gen"]) {
      const models = mode === "gen" ? (view === "campus" ? "&models=gen" : `&models=${view}`) : "";
      await page.goto(`${base}?${common}&${cam}${models}${photo ? "&photo" : ""}`, { waitUntil: "networkidle" });
      // Normal view without the HUD, so the buildings are not hidden behind panels (photo mode hides it itself).
      if (!photo) await page.addStyleTag({ content: ".world, .hud, .photo-btn { display: none !important }" });
      await page.waitForTimeout(photo ? 6000 : 3500);
      const file = `${OUT}/${view}-${mode}${photo ? "-photo" : ""}.png`;
      await page.screenshot({ path: file });
      console.log("saved", file);
    }
  }
}
await browser.close();
if (errors.length) console.log("page errors:", errors.slice(0, 5));
