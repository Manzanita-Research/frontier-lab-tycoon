#!/usr/bin/env node
// Headless screenshot for PR evidence, WebGL included (SwiftShader, no GPU).
//
//   pnpm build && (pnpm preview &) && sleep 2
//   pnpm shot "http://localhost:4173/?page=gallery" docs/img/gallery.png --size 1440x900 --wait 3000
//   pnpm shot "http://localhost:4173/" shots/phone.png --size 390x844 --mobile
//   pnpm shot "http://localhost:4173/?debug=1" shots/x.png --eval "window.__flt.sim.world.hype = 90"
//
// First run on a new machine: `pnpm exec playwright install chromium-headless-shell`
// (.bb-env-setup.sh already tries this). System libraries come from the Modal image.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: shot.mjs <url> <out.png> [--size WxH] [--wait ms] [--mobile] [--click selector] [--eval js]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const [width, height] = opt("size", "1440x900").split("x").map(Number);
const mobile = rest.includes("--mobile");
const wait = Number(opt("wait", "2500"));
const click = opt("click", null);
const evalJs = opt("eval", null);

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
if (evalJs) await page.evaluate(evalJs);
if (click) await page.click(click);
await page.waitForTimeout(wait);
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out} (${width}x${height}${mobile ? ", mobile" : ""})`);
if (errors.length) {
  console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 10).join("\n  ")}`);
}
