#!/usr/bin/env node
// FLT-29: a real ten-minute first run through the guided opening, in any skin, with nothing but the UI as input.
// No URL parameters, no clock overrides, no sim writes: a "reasonable new player" reads each message for a few seconds,
// answers it with Start menu / build bar clicks and map drags, and never touches speed (1x throughout).
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/tutorial-shots.mjs http://localhost:4173/ docs/evidence/FLT-29-sequence/frontier-95
//   node scripts/tutorial-shots.mjs http://localhost:4173/ docs/evidence/FLT-29-sequence/swag-drop --skin swag-drop
//   node scripts/tutorial-shots.mjs http://localhost:4173/ /tmp/quick --minutes 3      (a shorter look)
//
// --skin sets the player's saved skin (localStorage), which keeps the URL clean. --every N: a shot every N seconds (60).
// --phone: 390x844 at 2x, touch; the map is not driven on a phone (its camera differs), so it only takes shots.
import { chromium } from "playwright";
import { OrthographicCamera, Vector3 } from "three";
import { mkdir, writeFile } from "node:fs/promises";

const argv = process.argv.slice(2);
const flags = new Set(["--phone"]);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1]?.startsWith("--") && !flags.has(argv[i - 1])));
const [url = "http://localhost:4173/", dir = "docs/evidence/FLT-29-sequence"] = positional;
const skin = opt("skin", null);
const minutes = Number(opt("minutes", "10"));
const every = Number(opt("every", "60"));
const phone = argv.includes("--phone");
if (new URL(url).search) throw new Error("Evidence must use a clean URL.");
await mkdir(dir, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
if (skin) await context.addInitScript((s) => localStorage.setItem("flt.skin", s), skin);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

// Tile -> screen, for the default camera (the same projection scripts/pacing-shots.mjs uses).
const camera = new OrthographicCamera(-720, 720, 450, -450, -100, 200);
camera.zoom = 48;
camera.position.set(18.8, 20, 24.2);
camera.lookAt(-1.2, 0, 4.2);
camera.updateProjectionMatrix();
camera.updateMatrixWorld();
const screen = (x, z, w = 1, d = 1) => {
  const p = new Vector3(x + w / 2 - 12, 0.001, z + d / 2 - 12).project(camera);
  return [720 + p.x * 720, 450 - p.y * 450];
};
const parkPointer = () => page.mouse.move(720, 100);
const pause = (ms) => page.waitForTimeout(ms);

/** Pick a build tool: through the Start menu (Frontier 95) or straight from the build bar (every other skin). */
async function tool(name) {
  const start = page.getByTestId("start-button");
  if (await start.count()) {
    await start.click();
    await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click();
  } else await page.locator(`.tool[title="${name}"]`).click();
  await pause(500);
}
async function place(x, z, w = 1, d = 1) {
  const [px, py] = screen(x, z, w, d);
  await page.mouse.click(px, py);
  await pause(550);
  await parkPointer();
}
/** Drag out a straight run of path, tile by tile. */
async function drag(x0, z0, x1, z1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
  const [sx, sy] = screen(x0, z0);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= n; i++) {
    const [px, py] = screen(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n);
    await page.mouse.move(px, py, { steps: 4 });
    await pause(120);
  }
  await page.mouse.up();
  await pause(500);
  await parkPointer();
}
const escape = () => page.keyboard.press("Escape");

const stepNow = async () => (await page.locator("[data-step]").count()) ? await page.locator("[data-step]").first().getAttribute("data-step") : null;
const isPaused = async () => (await page.locator(".pause-pill, .f95-paused").count()) > 0;
const clickIfThere = async (locator) => {
  if (await locator.count()) {
    await locator.first().click();
    await pause(400);
    return true;
  }
  return false;
};
const next = () => clickIfThere(page.getByRole("button", { name: "Next", exact: true }));

/** What a player does about each message, after taking a few seconds to read it. */
const ANSWERS = {
  path: async () => {
    await tool("Path");
    await drag(11, 18, 11, 10);
    await drag(4, 16, 19, 16);
    await escape();
  },
  hall: async () => {
    await tool("Training Hall");
    await place(12, 11, 3, 3);
    await escape();
  },
  gateway: async () => {
    await tool("API Gateway");
    await place(7, 17, 2, 2);
    await escape();
  },
  hire: async () => {
    await tool("Staff");
    await pause(600);
    await page.locator(".f95-hire li, .staff-hire li").filter({ hasText: "SRE" }).getByRole("button", { name: /^Hire/ }).click();
    await pause(600);
    await page.locator(".f95-staff, .staff").getByRole("button", { name: "Close", exact: true }).first().click();
    await pause(400);
  },
  release: async () => {},
};
// After the guided opening the player just keeps building, roughly a new thing a minute.
const LATER = [
  [160, "Kombucha Bar", () => place(12, 19)],
  [200, "Snack Wall", () => place(9, 17)],
  [240, "Nap Pods", () => place(6, 15, 2, 1)],
  [320, "Demo Stage", () => place(14, 17, 2, 2)],
  [390, "API Gateway", () => place(9, 13, 2, 2)],
  [460, "Compute Cluster", () => place(12, 14, 2, 2)],
  [530, "Demo Stage", () => place(14, 14, 2, 2)],
];

const log = [];
let started = 0;
async function shot(label) {
  await parkPointer();
  const file = `${label}.png`;
  await page.screenshot({ path: `${dir}/${file}` });
  const date = (await page.locator(".f95-clock, .lab-date").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  const entry = { file, elapsedSeconds: Math.round((Date.now() - started) / 1000), date, step: await stepNow(), paused: await isPaused() };
  log.push(entry);
  console.log(JSON.stringify(entry));
}

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector("[data-step]", { timeout: 30_000 });
await pause(2000);
started = Date.now();
try {
  await shot("minute-00");
  if (phone) {
    // Phone: the opening as a player meets it, then the answer to the first message (Next, then the Start menu).
    await next();
    await shot("minute-00-acknowledged");
    const start = page.getByTestId("start-button");
    if (await start.count()) {
      await start.click();
      await pause(600);
      await shot("minute-00-start-menu");
    }
    process.exitCode = 0;
  } else {
    const done = new Set();
    const stepSeen = new Map();
    let later = 0;
    let minute = 1;
    while (Date.now() - started < minutes * 60_000 + 5000) {
      const seconds = (Date.now() - started) / 1000;
      // Real cards get answered with their first button, like a player would.
      const card = page.locator("[role=alertdialog] .f95-choices button, .f95-bsod-go, [role=dialog] button.choice, [role=dialog] button.era-go");
      if (await card.count()) {
        await card.first().click();
        await pause(6000);
      }
      const step = await stepNow();
      if (step) {
        if (!stepSeen.has(step)) stepSeen.set(step, seconds);
        // Reading time: five seconds a message. Then answer it, as many times as it takes.
        if (seconds - stepSeen.get(step) > 5 && !done.has(step)) {
          done.add(step);
          await next();
          await ANSWERS[step]?.();
        }
      } else if (later < LATER.length && seconds >= LATER[later][0]) {
        const [, name, action] = LATER[later++];
        await tool(name);
        await action();
        await escape();
      }
      if (minute <= minutes && seconds >= minute * every) await shot(`minute-${String(Math.round((minute++ * every) / 60)).padStart(2, "0")}`);
      await pause(1000);
    }
  }
  await writeFile(`${dir}/session.json`, JSON.stringify({ url, skin: skin ?? "frontier-95 (the default)", speed: "1x throughout", viewport: phone ? "390x844" : "1440x900", errors, log }, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
