#!/usr/bin/env node
// Evidence shots for FLT-10 (Operations). The game is staged with ?moment= (sim/opsDemo.ts) and paused (?speed=0), and the
// script drives the rest through window.__flt (?debug=1).
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/ops-shots.mjs moment       docs/img/flt-10/moment.png      (slop, a Janitor Bot, a cluster on fire, an SRE jogging, the status page)
//   node scripts/ops-shots.mjs moment-wide  docs/img/flt-10/moment-wide.png (the same, the whole campus)
//   node scripts/ops-shots.mjs queue        docs/img/flt-10/queue.png       (a full Kombucha Bar and the line down the spine)
//   node scripts/ops-shots.mjs slop         docs/img/flt-10/slop.png        (a campus ankle-deep in slop, no staff)
//   node scripts/ops-shots.mjs staff        docs/img/flt-10/staff.png       (the Staff panel with a small team)
//   node scripts/ops-shots.mjs zone         docs/img/flt-10/zone.png        (painting a Janitor Bot's patrol zone)
//   node scripts/ops-shots.mjs night        docs/img/flt-10/night.png       (night thoughts in the Thoughts panel)
//   node scripts/ops-shots.mjs phone        docs/img/flt-10/phone.png       (phone HUD, compact: one-row top bar, icon buttons)
//   node scripts/ops-shots.mjs phone-sheet  docs/img/flt-10/phone-sheet.png (phone: the inspector as a bottom sheet)
//   node scripts/ops-shots.mjs phone-more   docs/img/flt-10/phone-more.png  (phone: top bar expanded, sheet swiped up)
//   node scripts/ops-shots.mjs dump                                        (print staff, broken buildings and queues)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [mode, out] = process.argv.slice(2);
const base = process.env.URL ?? "http://localhost:4173/";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const mobile = mode.startsWith("phone");
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const go = (q = "") => page.goto(`${base}?debug=1&seed=3&speed=0&hour=13${q}`, { waitUntil: "networkidle" });
const wait = (ms) => page.waitForTimeout(ms);
const save = async (path) => {
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  console.log("saved", path);
};
const evalw = (fn) => page.evaluate(fn);

switch (mode) {
  case "moment":
    await go("&moment=ops&zoom=88&focus=10.6,14.2");
    await wait(2500);
    await page.click(".obj-head");
    await wait(1000);
    await save(out);
    break;
  case "moment-wide":
    await go("&moment=ops");
    await wait(3500);
    await save(out);
    break;
  case "queue":
    await go("&moment=queue&zoom=95&focus=11.5,20");
    await wait(2500);
    await save(out);
    break;
  case "slop":
    await go("&moment=slop&zoom=70&focus=11,15");
    await wait(2500);
    await save(out);
    break;
  case "staff": {
    await go("&moment=ops&zoom=55&focus=11,14");
    await wait(1500);
    for (const job of ["janitor", "security", "comms"]) await page.evaluate((job) => window.__flt.send({ type: "COMMAND", command: { type: "hire", job } }), job);
    await wait(800);
    await page.evaluate(() => window.__flt.send({ type: "SET_SPEED", speed: 3 }));
    await wait(2500);
    await page.evaluate(() => window.__flt.send({ type: "SET_SPEED", speed: 0 }));
    await page.click(".staff-tool");
    await wait(800);
    await save(out);
    break;
  }
  case "zone": {
    await go("&moment=ops&zoom=70&focus=11,15");
    await wait(1200);
    await page.click(".staff-tool");
    await wait(400);
    await page.click(".staff-roster li:first-child .mini:not(.danger)");
    await wait(400);
    // Drag a zone along the cross path.
    const box = await page.locator("canvas").boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 120, cy + 60);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 140, { steps: 12 });
    await page.mouse.up();
    await wait(800);
    await save(out);
    break;
  }
  case "night":
    await go("&moment=slop&hour=23&zoom=60&focus=11,15");
    await wait(1200);
    await evalw(() => window.__flt.send({ type: "SET_SPEED", speed: 0 }));
    await page.evaluate(() => {
      const w = window.__flt.sim.world;
      w.tick = Math.round(((23 - 8) / 24) * 600);
      w.day = Math.floor(w.tick / 20);
      w.thoughts = [];
    });
    await wait(1500);
    await save(out);
    break;
  case "phone":
    await go("&moment=ops");
    await wait(3000);
    await save(out);
    break;
  case "phone-sheet":
  case "phone-more": {
    await go("&moment=ops");
    await wait(1500);
    // Tap somebody near the middle of the screen.
    const id = await page.evaluate(() => {
      const w = window.__flt.sim.world;
      return w.walkers.find((x) => x.kind === "researcher" && x.machine.value !== "inside")?.id ?? null;
    });
    await page.evaluate((id) => window.__flt.send({ type: "SELECT", id }), id);
    await wait(1200);
    if (mode === "phone-more") {
      await page.click(".topbar-toggle");
      const h = await page.locator(".sheet-handle").boundingBox();
      await page.mouse.move(h.x + h.width / 2, h.y + 6);
      await page.mouse.down();
      await page.mouse.move(h.x + h.width / 2, h.y - 90, { steps: 8 });
      await page.mouse.up();
      await wait(600);
    }
    await save(out);
    break;
  }
  case "dump": {
    await go("&moment=ops");
    await wait(1000);
    const d = await page.evaluate(() => {
      const w = window.__flt.sim.world;
      return {
        staff: w.staff.map((s) => ({ job: s.job, name: s.name, x: +s.x.toFixed(2), z: +s.z.toFixed(2), phase: s.machine.value, task: s.task, route: s.route.length })),
        broken: w.buildings.filter((b) => b.broken).map((b) => b.kind),
        news: w.news.map((n) => n.text),
      };
    });
    console.log(JSON.stringify(d, null, 1));
    break;
  }
  default:
    console.error("unknown mode");
}
await browser.close();
if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 10).join("\n  ")}`);
