#!/usr/bin/env node
// How long does a fresh headline take to reach the screen? Loads the game, lets the news tape settle, pushes one
// headline into the World, and times how long until its text is inside the ticker's view. Evidence for FLT-31's
// "ticker freshness"; run it against main and against the branch.
//
//   node scripts/ticker-check.mjs http://localhost:4173 [--wait 8]
import { chromium } from "playwright";

const [url, ...rest] = process.argv.slice(2);
if (!url) {
  console.error("usage: ticker-check.mjs <url> [--wait 8]");
  process.exit(2);
}
const wait = Number(rest[rest.indexOf("--wait") + 1] || 8);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${url}/?debug=1&seed=3&warp=40&speed=1&hour=13`, { waitUntil: "load", timeout: 90_000 });
await page.waitForFunction(() => window.__flt?.sim?.world && document.querySelector(".ticker-track"), null, { timeout: 60_000 });
await page.waitForTimeout(wait * 1000); // let the tape fill and start scrolling, as it would in a real session
const seconds = await page.evaluate(
  () =>
    new Promise((done) => {
      const w = window.__flt.sim.world;
      const text = "BREAKING: the ticker check headline has arrived";
      const t0 = performance.now();
      w.news.push({ id: w.nextId++, day: w.day, text, tone: "bad" });
      const tick = () => {
        const track = document.querySelector(".ticker-track");
        const view = track.parentElement.getBoundingClientRect();
        const span = [...track.children].find((s) => s.textContent === text);
        if (span) {
          const r = span.getBoundingClientRect();
          if (r.left < view.right) return done((performance.now() - t0) / 1000);
        }
        if (performance.now() - t0 > 180_000) return done(null);
        setTimeout(tick, 100);
      };
      tick();
    }),
);
await browser.close();
console.log(seconds === null ? "the headline never reached the screen (3 minutes)" : `the headline was on screen ${seconds.toFixed(1)} s after it happened`);
