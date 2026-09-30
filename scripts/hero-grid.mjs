#!/usr/bin/env node
// The six-skin grid for a shareable image (FLT-48): one scene captured in every skin, laid out 3 × 2 with each skin's name.
//
//   pnpm shots --scenes hero-grid --skin all --out shots/hero
//   node scripts/hero-grid.mjs shots/hero/after docs/img/flt-48/hero/six-skins.png
//
// Reads `<dir>/<scene>@<skin>.png` (the scene defaults to hero-grid), in the order below, with Frontier 95 first.
import { chromium } from "playwright";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [dir, out, scene = "hero-grid"] = process.argv.slice(2);
if (!dir || !out) {
  console.error("usage: hero-grid.mjs <captures dir> <out.png> [scene]");
  process.exit(2);
}
const order = ["frontier-95", "swag-drop", "karaoke-night", "field-almanac", "discovery-disc-96", "homepage-98"];
const panels = order.map((skin) => {
  const file = join(dir, `${scene}@${skin}.png`);
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  const name = JSON.parse(readFileSync(new URL(`../src/skins/${skin}/skin.json`, import.meta.url), "utf8")).name;
  return { name, src: `data:image/png;base64,${readFileSync(file).toString("base64")}` };
});

const PW = 480; // css px per panel; at 2x that is 960 px of a 2880 px capture
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const html = `<!doctype html><meta charset=utf-8><style>
  body{margin:0;background:#15171d}
  #sheet{display:inline-grid;grid-template-columns:repeat(3,${PW}px);gap:14px;padding:16px}
  figure{margin:0}
  img{display:block;width:${PW}px;height:auto;border-radius:5px}
  figcaption{font:600 13px/1 ui-sans-serif,system-ui,sans-serif;color:#e8eaf0;padding:0 0 7px 2px;letter-spacing:.02em}
</style><div id=sheet>${panels.map((p) => `<figure><figcaption>${esc(p.name)}</figcaption><img src="${p.src}"></figure>`).join("")}</div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 3 * PW + 80, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
mkdirSync(dirname(out), { recursive: true });
await page.locator("#sheet").screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
