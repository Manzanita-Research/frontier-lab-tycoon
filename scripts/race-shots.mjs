#!/usr/bin/env node
// Evidence shots for FLT-9 (The Race): the moments a URL can't reach. The game is paused (?speed=0) and the script
// drives the sim through window.__flt (?debug=1), so each moment is the real thing, just set up quickly.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/race-shots.mjs shuffle docs/img/flt-9/shuffle.png     (the Arena reshuffles, you fall from #1 to #4)
//   node scripts/race-shots.mjs drop    docs/img/flt-9/drop.png        (the open-weights card that follows)
//   node scripts/race-shots.mjs era     docs/img/flt-9/era.png         (ERA 2 title card)
//   node scripts/race-shots.mjs era3    docs/img/flt-9/era3.png
//   node scripts/race-shots.mjs auction docs/img/flt-9/auction.png
//   node scripts/race-shots.mjs funding docs/img/flt-9/funding.png
//   node scripts/race-shots.mjs datacenter docs/img/flt-9/datacenter.png (the prize lands, powered)
//   node scripts/race-shots.mjs looks   docs/img/flt-9/looks.png       (agents in the four eras, side by side)
//   node scripts/race-shots.mjs phone   docs/img/flt-9/phone.png       (phone HUD with the leaderboard open)
//   node scripts/race-shots.mjs phone-hud docs/img/flt-9/phone-hud.png   (phone HUD as it opens: chips in the top bar, panel folded)
//   node scripts/race-shots.mjs phone-era docs/img/flt-9/phone-era.png
//   node scripts/race-shots.mjs record  docs/img/flt-9/moment.webm     (the whole screenshot moment as a short video)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [mode, out] = process.argv.slice(2);
const base = process.env.URL ?? "http://localhost:4173/";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const mobile = mode.startsWith("phone");
const ctx = await browser.newContext({
  recordVideo: mode === "record" ? { dir: dirname(out), size: { width: 960, height: 600 } } : undefined,
  viewport: mode === "record" ? { width: 960, height: 600 } : mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const go = (q = "") => page.goto(`${base}?debug=1&seed=3&speed=0&hour=13${q}`, { waitUntil: "networkidle" });
const save = async (path) => {
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  console.log("saved", path);
};
const wait = (ms) => page.waitForTimeout(ms);

/** In the page: `f` gets the live World and helpers. `day()` runs the ticks up to the next midnight. */
const run = (fn, arg) =>
  page.evaluate(
    ({ src, arg }) => {
      const f = window.__flt;
      const w = f.sim.world;
      const day = () => {
        w.tick = Math.floor(w.tick / 20) * 20 + 19;
        f.tick(w);
      };
      // Land on the last tick of the day before a week boundary, so the next day() is a week turn.
      const toWeek = () => {
        w.day = Math.floor(w.day / 7) * 7 + 6;
        w.tick = w.day * 20 + 19 - 20 + 20;
        w.tick = (w.day + 1) * 20 - 1;
      };
      const rival = (id) => w.race.rivals.find((r) => r.context.id === id);
      // eslint-disable-next-line no-new-func
      return new Function("f", "w", "day", "toWeek", "rival", "arg", src)(f, w, day, toWeek, rival, arg);
    },
    { src: fn.toString().replace(/^[^{]*\{/, "").replace(/\}$/, ""), arg },
  );

/** A lab with revenue, a gateway and a decent campus, paused. */
const bigLab = async () => {
  await page.evaluate(() => window.__flt.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "gateway", x: 6, z: 14 } }));
  await wait(500);
  return run(function () {
    w.ledger = { income: 90_000, expenses: 30_000, net: 60_000 };
    w.cash = 12_000_000;
    w.hype = 68;
    w.capability = 42; // still Era 1: the crowd hasn't grown into the agents yet
    w.models = ["Frontier-2", "Frontier-3-Reasoner", "Frontier-4"];
  });
};

if (mode === "shuffle" || mode === "drop" || mode === "record") {
  await go("&zoom=70&focus=12,14");
  await wait(1200);
  await bigLab();
  // Week 1: the lab is on top.
  await run(function () {
    for (const id of ["anthro", "openish", "metameta", "sirocco", "macrohard"]) {
      rival(id).context.capability = 34;
      rival(id).context.hype = 45;
    }
    toWeek();
    day();
  });
  await wait(mode === "record" ? 2500 : 1600);
  // Week 2: three labs surge past, and Sirocco drops an open model that matches yours, on a torrent, at 3am.
  await run(function () {
    for (const [id, cap, hype] of [["openish", 52, 68], ["macrohard", 49, 64]]) {
      rival(id).context.capability = cap;
      rival(id).context.hype = hype;
    }
    const s = rival("sirocco");
    s.value = "training";
    s.context.weeks = 1;
    s.context.capability = 40;
    toWeek();
    day();
  });
  await wait(mode === "shuffle" ? 550 : 1400);
  if (mode === "shuffle") await save(out);
  if (mode === "drop" || mode === "record") {
    await run(function () {
      day();
    }); // a day later the card slams in
    await wait(1500);
    if (mode === "drop") await save(out);
  }
  if (mode === "record") {
    await page.keyboard.press("1");
    await wait(600);
    // ...and then the multiplier crosses 2x.
    await run(function () {
      w.capability = 240;
      day();
    });
    await wait(6000);
    await page.keyboard.press("Enter");
    await wait(2000);
    const video = page.video();
    await ctx.close();
    await video.saveAs(out);
    console.log("saved", out);
  }
} else if (mode === "era" || mode === "era3" || mode === "phone-era") {
  await go("&zoom=" + (mobile ? "40" : "70") + "&focus=12,14");
  await wait(1000);
  await bigLab();
  await run(function () {
    w.capability = 320;
    day();
    day();
  });
  await wait(mode === "phone-era" ? 3200 : 2800);
  if (mode === "era3") {
    await page.keyboard.press("Enter");
    await wait(600);
    await run(function () {
      w.capability = 900;
      day();
      day();
    });
    await wait(2800);
  }
  await save(out);
} else if (mode === "auction") {
  await go("&zoom=70&focus=12,14");
  await wait(1000);
  await bigLab();
  await run(function () {
    w.day = 39;
    w.tick = 39 * 20 + 19;
    day();
    day();
  });
  await wait(1400);
  await save(out);
} else if (mode === "funding") {
  await go("&zoom=70&focus=12,14");
  await wait(1000);
  await bigLab();
  await run(function () {
    w.cash = 600_000;
    w.ledger = { income: 40_000, expenses: 140_000, net: -100_000 };
    w.capability = 60;
    w.hype = 62;
    day();
    day();
  });
  await wait(1400);
  await save(out);
} else if (mode === "datacenter") {
  await go("&zoom=62&focus=12,13");
  await wait(1000);
  await bigLab();
  await run(function () {
    w.cash = 60_000_000;
    const put = (x, z) => {
      w.grid.paths[z * w.grid.w + x] = true;
    };
    for (let x = 3; x <= 20; x++) put(x, 8);
    for (let z = 8; z <= 15; z++) put(5, z);
    w.version++;
    for (const k of ["datacenter", "gas", "solar"]) w.flags["unlocked:" + k] = w.day;
  });
  await page.evaluate(() => {
    const f = window.__flt;
    f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "datacenter", x: 6, z: 4 } });
    f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "gas", x: 11, z: 6 } });
    f.send({ type: "COMMAND", command: { type: "placeBuilding", kind: "solar", x: 14, z: 5 } });
  });
  await wait(2600);
  await save(out);
} else if (mode === "looks") {
  await go("&zoom=100&focus=12,13&agents=30");
  await wait(1200);
  for (let era = 1; era <= 4; era++) {
    await run(function () {
      w.race.era = { value: "era" + arg, context: { peak: [1, 2, 5, 30][arg - 1] } };
    }, era);
    await wait(900);
    await save(out.replace(/(\.\w+)$/, `-${era}$1`));
  }
} else if (mode === "phone-hud") {
  await go("&zoom=38&focus=12,14");
  await wait(1000);
  await bigLab();
  await wait(800);
  await save(out);
} else if (mode === "phone") {
  await go("&zoom=38&focus=12,14");
  await wait(1000);
  await bigLab();
  await run(function () {
    w.race.rank = 4;
    for (const id of ["anthro", "openish", "metameta"]) rival(id).context.capability = 110;
    toWeek();
    day();
  });
  await wait(600);
  await page.locator(".arena-chip").click();
  await wait(1500);
  await save(out);
}
if (mode !== "record") await browser.close();
if (errors.length) console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 8).join("\n  ")}`);
