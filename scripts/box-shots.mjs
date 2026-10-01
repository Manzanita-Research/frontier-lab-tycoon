#!/usr/bin/env node
// FLT-70 art evidence: the same box beats (same visitor seed, so the same weights key) from two builds, main and yours.
// `pnpm shots` drives the game; this drives /box. Build main somewhere, serve both, then:
//   node scripts/box-shots.mjs <outDir> [scene,...] [--before http://localhost:4175] [--after http://localhost:4173]
// Writes <outDir>/{before,after}/<scene>.png; check them with `pnpm shots --verify <outDir>`.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const argv = process.argv.slice(2);
const flag = (name, fallback) => (argv.includes(`--${name}`) ? argv.splice(argv.indexOf(`--${name}`), 2)[1] : fallback);
const before = flag("before", "http://localhost:4175");
const after = flag("after", "http://localhost:4173");
const [out = "docs/img/flt-70-art", pick] = argv;
const DESK = [1440, 900];
const PHONE = [390, 844];
const SCENES = [
  ["shelf", "beat=shelf", DESK, 7000],
  ["open", "beat=open", DESK, 7000],
  ["manual", "beat=manual", DESK, 8000],
  ["coa-tilt-a", "beat=coa&tilt=0.35,-0.45", DESK, 8000],
  ["coa-tilt-b", "beat=coa&tilt=-0.3,0.45", DESK, 8000],
  ["bios", "beat=post&hold=1", DESK, 8000],
  ["splash", "beat=splash&hold=1", DESK, 8000],
  ["phone-shelf", "beat=shelf", PHONE, 7000],
  ["phone-open", "beat=open", PHONE, 7000],
  ["phone-coa", "beat=coa&tilt=0.35,-0.45", PHONE, 8000],
].filter(([n]) => !pick || pick.split(",").includes(n));
const SIDES = [
  ["before", before],
  ["after", after],
];
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [side, base] of SIDES) {
  mkdirSync(`${out}/${side}`, { recursive: true });
  for (const [name, q, [w, h], wait] of SCENES) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));
    await p.goto(`${base}/box?seed=70&${q}`, { waitUntil: "networkidle" });
    await p.waitForFunction(() => window.__intro, null, { timeout: 90000 });
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${out}/${side}/${name}.png` });
    console.log(side, name, errs.slice(0, 2).join(" | "));
    await p.close();
  }
}
await b.close();
