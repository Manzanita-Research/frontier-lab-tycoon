#!/usr/bin/env node
// FLT-13: frame time, draw calls, triangles and load time per model, 1 copy vs 12, on the lab page.
//   pnpm build && (pnpm preview &) && node scripts/fal3d/measure.mjs [hall cluster float]
//   COPIES=48 VARIANTS=proc,hall-tripo-B OUT=/tmp/x.json node scripts/fal3d/measure.mjs hall
// SwiftShader (software WebGL) is rasteriser-bound, so only compare numbers from the same run. Baseline = procedural.
import { chromium } from "playwright";
import { readdirSync, writeFileSync } from "node:fs";

const base = process.env.URL ?? "http://localhost:4173/";
const subjects = process.argv.slice(2).length ? process.argv.slice(2) : ["hall", "cluster", "float"];
const candidates = readdirSync("public/models/gen/candidates").map((f) => f.replace(/\.glb$/, ""));
const copyCounts = (process.env.COPIES ?? "1,12").split(",").map(Number);
const only = process.env.VARIANTS?.split(",");
const outFile = process.env.OUT ?? "docs/experiments/flt-13/measurements.json";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function run(subject, variant, copies) {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  const models = variant === "proc" ? "" : `&models=${subject}:${variant.slice(subject.length + 1)}`;
  const zoom = copies > 12 ? 28 : copies > 1 ? 50 : 150;
  await page.goto(`${base}?page=lab&kind=${subject}&copies=${copies}&bench=1&zoom=${zoom}${models}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__lab?.done, null, { timeout: 240000 });
  const out = await page.evaluate(() => ({ lab: window.__lab, gen: Object.values(window.__genStats ?? {})[0] ?? null }));
  await page.close();
  return { subject, variant, copies, ...out.lab, loadMs: out.gen?.loadMs ?? null, parseMs: out.gen?.parseMs ?? null };
}

const results = [];
for (const subject of subjects) {
  const variants = ["proc", ...candidates.filter((c) => c.startsWith(`${subject}-`))].filter((v) => !only || only.includes(v));
  for (const variant of variants) {
    for (const copies of copyCounts) {
      const r = await run(subject, variant, copies);
      results.push(r);
      console.log(`${subject} ${variant} x${copies}: ${r.meanMs.toFixed(1)} ms mean, ${r.calls} calls, ${r.triangles} tris` + (r.loadMs != null ? `, load ${r.loadMs.toFixed(0)} ms (parse ${r.parseMs.toFixed(0)})` : ""));
    }
  }
}
await browser.close();
writeFileSync(outFile, JSON.stringify(results, null, 1));
