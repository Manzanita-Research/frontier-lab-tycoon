#!/usr/bin/env node
// FLT-13: raw generation -> Blender clean -> quantize + meshopt -> public/models/gen/candidates/<name>.glb
//   node scripts/fal3d/pipeline.mjs <subject>-<gen>-<ref> [--expose 0] [--rot-y 90|auto] [--tris N]
// Writes docs/experiments/flt-13/stats/<name>.json with sizes and triangle counts before and after each step.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const [name, ...rest] = process.argv.slice(2);
const opt = (k, d) => (rest.includes(`--${k}`) ? rest[rest.indexOf(`--${k}`) + 1] : d);
const subject = name.split("-")[0];
const OUT = "docs/experiments/flt-13";
const CONFIG = {
  hall: { tris: 5000, fit: "2.3,2.1,2.3", rot: "0" },
  cluster: { tris: 3000, fit: "1.86,1.9,1.86", rot: "0" },
  float: { tris: 5000, fit: "2.86,2.2,1.86", rot: "auto" },
}[subject];
const BLENDER = join(homedir(), ".cache/blender/blender-headless");
const raw = existsSync(join(OUT, "raw", `${name}.glb`)) ? join(OUT, "raw", `${name}.glb`) : join(OUT, "raw", name, "model.obj");
const dirSize = (d) => readdirSync(d).reduce((n, f) => n + statSync(join(d, f)).size, 0);
const rawBytes = raw.endsWith(".obj") ? dirSize(join(OUT, "raw", name)) : statSync(raw).size;

const tmp = join("/tmp", "fal3d");
mkdirSync(tmp, { recursive: true });
mkdirSync(join(OUT, "stats"), { recursive: true });
const cleaned = join(tmp, `${name}.blender.glb`);
const statsFile = join(tmp, `${name}.json`);
const t0 = Date.now();
execFileSync(
  BLENDER,
  ["-b", "--factory-startup", "--python", "scripts/fal3d/clean.py", "--", "--in", raw, "--out", cleaned, "--kind", subject, "--tris", opt("tris", String(CONFIG.tris)), "--fit", CONFIG.fit, "--rot-y", opt("rot-y", CONFIG.rot), "--expose", opt("expose", "auto"), "--smooth", opt("smooth", "2"), "--lw", opt("lw", "0.35"), "--stats", statsFile],
  { stdio: "ignore" },
);
const blenderSeconds = (Date.now() - t0) / 1000;

const dest = join("public/models/gen/candidates", `${name}.glb`);
mkdirSync("public/models/gen/candidates", { recursive: true });
const gt = (...args) => execFileSync("pnpm", ["exec", "gltf-transform", ...args], { stdio: "ignore" });
gt("quantize", cleaned, join(tmp, `${name}.q.glb`));
gt("meshopt", join(tmp, `${name}.q.glb`), dest, "--level", "high");

const stats = JSON.parse(readFileSync(statsFile, "utf8"));
const row = { name, raw_bytes: rawBytes, blender_bytes: statSync(cleaned).size, final_bytes: statSync(dest).size, blender_seconds: Math.round(blenderSeconds), ...stats };
writeFileSync(join(OUT, "stats", `${name}.json`), JSON.stringify(row, null, 2));
console.log(`${name}: raw ${(rawBytes / 1e6).toFixed(1)} MB / ${stats.raw_tris} tris -> ${stats.final_tris} tris, ${(row.blender_bytes / 1e3).toFixed(0)} kB -> ${(row.final_bytes / 1e3).toFixed(0)} kB (meshopt), gain ${stats.exposure_gain}`);
