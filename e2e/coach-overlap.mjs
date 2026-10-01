import { chromium } from "playwright";

// FLT-77: does the coach balloon sit on the window its own step opens? Follows the coach (as the journey does) to the
// "read a researcher's mind" step, clicks the researcher, and counts the painted frames in which the balloon covers any
// window over the next few seconds (the peek step and the step after it). The journey forgives an overlap under 500 ms;
// this counts every frame, so a balloon that waits for its next look to step aside shows up here.
//   node e2e/coach-overlap.mjs --url http://localhost:4173/ [--viewport 1280x800] [--shot out.png]
// --shot holds requestAnimationFrame the moment the Properties window goes in, so the still is that window's first frame:
// whatever the balloon did before the paint (and nothing after) is in it.
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const url = arg("url");
if (!url) throw new Error("Usage: node e2e/coach-overlap.mjs --url <preview URL> [--viewport 1280x800] [--shot out.png]");
const [width, height] = arg("viewport", "1280x800").split("x").map(Number);
const shot = arg("shot");

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.addInitScript((freeze) => {
  const WIN = "section.f95-win, [role=dialog], [role=alertdialog], .modal-card";
  const COACH = "[role=status][aria-label^='Assistant']";
  const w = window;
  const raf = w.requestAnimationFrame.bind(w);
  w.__coach = { watching: false, frames: 0, overlapFrames: 0, worst: null, frozen: false };
  const overlap = () => {
    const coach = document.querySelector(COACH)?.getBoundingClientRect();
    if (!coach) return null;
    for (const el of document.querySelectorAll(WIN)) {
      if (el.closest(COACH)) continue;
      const r = el.getBoundingClientRect();
      const ow = Math.min(coach.right, r.right) - Math.max(coach.left, r.left);
      const oh = Math.min(coach.bottom, r.bottom) - Math.max(coach.top, r.top);
      if (ow > 4 && oh > 4) return { label: el.getAttribute("aria-label") ?? el.className, w: Math.round(ow), h: Math.round(oh) };
    }
    return null;
  };
  // Registered before the game's own loops, so it runs first in each frame: it sees what the last task left on screen.
  const frame = () => {
    const c = w.__coach;
    if (c.watching) {
      c.frames++;
      const o = overlap();
      if (o) {
        c.overlapFrames++;
        if (!c.worst || o.w * o.h > c.worst.w * c.worst.h) c.worst = o;
      }
    }
    raf(frame);
  };
  raf(frame);
  if (freeze) {
    new MutationObserver((changes) => {
      if (w.__coach.frozen || !w.__coach.watching) return;
      if (!changes.some((c) => [...c.addedNodes].some((n) => n.nodeType === 1 && (n.matches(".f95-props") || n.querySelector(".f95-props"))))) return;
      w.__coach.frozen = true;
      w.requestAnimationFrame = () => 0;
    }).observe(document, { childList: true, subtree: true });
  }
}, !!shot);

await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForFunction(() => typeof window.__fltProbe === "function", { timeout: 60_000 });
const probe = () => page.evaluate(() => window.__fltProbe());
const active = () => page.locator("[data-coach-active]:visible").first();
await active().waitFor({ timeout: 60_000 });

// Follow the coach to the peek step: its tile or its button, every 600 ms.
const until = Date.now() + 240_000;
let p = await probe();
while (p.coachId !== "peek") {
  if (Date.now() > until) throw new Error(`The coach never reached "peek" (at ${p.coachId})`);
  const tile = page.locator("[data-coach-tile]:visible").first();
  try {
    if (await tile.count()) await tile.click({ timeout: 3000 });
    else if (await active().count()) await active().click({ timeout: 3000 });
  } catch {}
  await page.waitForTimeout(600);
  p = await probe();
}
await page.waitForTimeout(1000);
await page.evaluate(() => (window.__coach.watching = true));
await active().click({ timeout: 5000 });
await page.waitForTimeout(shot ? 1500 : 4000);
if (shot) await page.screenshot({ path: shot });
const c = await page.evaluate(() => window.__coach);
p = await probe();
console.log(JSON.stringify({ viewport: `${width}x${height}`, coachNow: p.coachId, frames: c.frames, overlapFrames: c.overlapFrames, worst: c.worst, frozen: c.frozen }));
await browser.close();
process.exit(shot || c.overlapFrames === 0 ? 0 : 1);
