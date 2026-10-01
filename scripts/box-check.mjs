#!/usr/bin/env node
// FLT-70: drive the big-box intro in a headless browser, the way a player would, and take its evidence shots.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/box-check.mjs [--url http://localhost:4173] [--out docs/img/flt-95] [--only flow,door,skip,still,phone,plain,fps]
//
// Checks: the whole flow (take the box, turn it, flip it, open it, read the manual, pick up the disc, put it down, insert
// it, land in the game at `/`), the front door (FLT-95: a first visit to `/` is the box, a returning one is the game with
// Welcome back, which has the box one click away), Skip from the shelf, the reduced-motion still (Play), the phone (a
// swipe turns the box), that `/?seed=7` never shows the intro, and the shelf's frame rate.
// Exits 1 if any check fails or the page logs an error. SwiftShader is slow (a few fps), so the waits are long.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const base = opt("url", "http://localhost:4173");
const out = opt("out", "shots/flt-95");
const only = opt("only", "flow,door,skip,still,phone,plain,fps").split(",");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

async function open(path, { width = 1440, height = 900, mobile = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: "networkidle" });
  return { page, errors };
}
const inGame = (page) =>
  page.waitForFunction(() => !document.querySelector(".intro") && !document.querySelector(".still") && document.querySelectorAll("canvas").length > 0, null, { timeout: 90_000 });
const shoot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(name, false, String(e).split("\n")[0]);
  }
}

// FLT-95: the box waits in your hands. Take it, turn it (a drag), flip it, open it, read the manual, pick up the disc,
// put it down (Back), pick it up again and insert it. `flow-*.png` is the filmstrip.
const state = (page) => page.evaluate(() => JSON.stringify(window.__intro?.state?.() ?? ""));
const turnOf = (page) => page.evaluate(() => window.__intro?.context?.()?.turn ?? null);
const settle = (page, ms = 2500) => page.waitForTimeout(ms);

if (only.includes("flow"))
  await step("flow", async () => {
    const { page, errors } = await open("/box?seed=7");
    await page.waitForSelector(".intro-cta", { timeout: 60_000 });
    await settle(page, 3000);
    await shoot(page, "flow-1-shelf");
    await page.click(".intro-cta");
    await page.waitForSelector(".intro-hold", { timeout: 90_000 });
    await settle(page, 4000);
    check("the box holds on the front until you act", (await state(page)).includes("held") && (await turnOf(page)) === 0);
    await shoot(page, "flow-2-front");
    // A drag across the stage turns it: about a quarter of the screen is a quarter turn.
    const { width, height } = page.viewportSize();
    await page.mouse.move(width * 0.4, height * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(width * 0.4 + i * 22, height * 0.5);
    await page.mouse.up();
    await settle(page, 3000);
    const dragged = await turnOf(page);
    check("a drag turns the box", typeof dragged === "number" && dragged !== 0, `turn ${dragged}`);
    await shoot(page, "flow-3-turned");
    await page.click(".intro-flip");
    await settle(page, 3500);
    check("Flip to back shows the back", (await turnOf(page)) % 8 === 4 || (await turnOf(page)) % 8 === -4, `turn ${await turnOf(page)}`);
    check("the button now says Flip to front", /front/i.test((await page.textContent(".intro-flip")) ?? ""));
    await shoot(page, "flow-4-back");
    await page.click(".intro-open");
    await page.waitForSelector(".intro-contents", { timeout: 90_000 });
    await settle(page, 3000);
    await shoot(page, "flow-5-open");
    await page.click(".intro-contents button:has-text('The manual')");
    await page.waitForSelector(".intro-focus", { timeout: 30_000 });
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(600);
    }
    await settle(page);
    await shoot(page, "flow-6-manual");
    const folio = await page.textContent(".intro-folio");
    check("manual turns pages with the arrow keys", /Modding with Layers/.test(folio ?? ""), folio ?? "");
    await page.click(".intro-contents button:has-text('Pick up the disc')");
    await page.waitForSelector(".intro-disc", { timeout: 30_000 });
    await settle(page, 3000);
    await shoot(page, "flow-7-disc");
    check("the disc in your hand offers Insert and play, and Back", (await page.locator(".intro-disc button").allTextContents()).join("|").includes("Insert and play"));
    await page.click(".intro-disc button:has-text('Back')");
    await page.waitForFunction(() => !document.querySelector(".intro-focus"), null, { timeout: 30_000 });
    await settle(page);
    check("Back puts the disc down; the game hasn't started", (await state(page)).includes("open") && !(await page.evaluate(() => typeof window.__fltProbe === "function")));
    await shoot(page, "flow-8-put-down");
    await page.click(".intro-contents button:has-text('Pick up the disc')");
    await page.click(".intro-disc button:has-text('Insert and play')");
    await page.waitForFunction(() => JSON.stringify(window.__intro?.state?.() ?? "").includes("post"), null, { timeout: 90_000 });
    await settle(page);
    await shoot(page, "flow-9-bios");
    await inGame(page);
    await page.locator("[data-coach-active]:visible").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(2000);
    await shoot(page, "flow-10-game");
    check("the coach's first step is up after the disc goes in", true);
    const url = new URL(page.url());
    check("Insert and play lands in the game at /", url.pathname === "/" && !url.searchParams.has("intro"), url.pathname + url.search);
    check("flow: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
  });

// FLT-95: the front door. A first visit to `/` is the box; Skip leaves you in the game; the next visit to `/` is the game;
// a returning player's Welcome back has the box one click away, and the box hands back to Welcome back.
if (only.includes("door"))
  await step("door", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.waitForSelector(".intro-cta", { timeout: 60_000 });
    check("a first visit to / opens on the box", true);
    await page.click(".intro-skip");
    await inGame(page);
    check("Skip intro → the game, still at /", new URL(page.url()).pathname === "/");
    // Leave the tab (the autosave on hide), then come back.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => !!localStorage.getItem("flt.save.auto"), null, { timeout: 30_000 });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await inGame(page);
    const link = page.locator("button:has-text('Take the box off the shelf again')");
    await link.waitFor({ timeout: 30_000 });
    check("a returning visit to / opens on the game, with Welcome back", true);
    await page.waitForTimeout(1500);
    await shoot(page, "door-welcome-back");
    await link.click();
    await page.waitForSelector(".intro-cta", { timeout: 60_000 });
    check("Welcome back ▸ Take the box off the shelf again → /box", new URL(page.url()).pathname === "/box");
    await page.click(".intro-skip");
    await inGame(page);
    await page.locator("button:has-text('Take the box off the shelf again')").waitFor({ timeout: 30_000 });
    check("…and the lab is still there afterwards (Welcome back)", true);
    check("door: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await context.close();
  });

if (only.includes("skip"))
  await step("skip", async () => {
    const { page, errors } = await open("/box?seed=7");
    await page.waitForSelector(".intro-skip", { timeout: 60_000 });
    const t0 = Date.now();
    await page.click(".intro-skip");
    await inGame(page);
    check("Skip intro → reaches the game", true, `${Date.now() - t0} ms after the click`);
    check("skip: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
  });

if (only.includes("still"))
  await step("still", async () => {
    const { page, errors } = await open("/box?seed=7&motion=reduced");
    await page.waitForSelector(".still-play", { timeout: 60_000 });
    await page.waitForTimeout(1000);
    await shoot(page, "still");
    // The box art is a 2D canvas inside the still; the 3D stage is never mounted.
    const stage = await page.evaluate(() => [...document.querySelectorAll("canvas")].filter((c) => !c.closest(".still")).length);
    check("reduced motion: no 3D stage", stage === 0, `${stage} canvas(es) outside the still`);
    await page.click(".still-play");
    await inGame(page);
    check("reduced motion: Play reaches the game", true);
    check("still: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
  });

/** A one-finger swipe (touch events through CDP: Playwright has no touch drag). */
async function swipe(page, from, to, steps = 10) {
  const cdp = await page.context().newCDPSession(page);
  const at = (x, y) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(from.x, from.y) });
  for (let i = 1; i <= steps; i++)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

if (only.includes("phone"))
  await step("phone", async () => {
    const { page, errors } = await open("/box?seed=7", { width: 390, height: 844, mobile: true });
    await page.waitForSelector(".intro-cta", { timeout: 60_000 });
    await settle(page, 3000);
    await shoot(page, "phone-1-shelf");
    await page.tap(".intro-cta");
    await page.waitForSelector(".intro-hold", { timeout: 90_000 });
    await settle(page, 4000);
    await shoot(page, "phone-2-front");
    const small = await page.$$eval(".intro-hold button, .intro-skip", (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.height < 32 || r.width < 32).length);
    check("phone: the hold buttons are at least 32 px", small === 0, `${small} too small`);
    await swipe(page, { x: 80, y: 400 }, { x: 330, y: 400 });
    await settle(page, 3000);
    const turned = await turnOf(page);
    check("phone: a swipe turns the box", typeof turned === "number" && turned !== 0, `turn ${turned}`);
    await shoot(page, "phone-3-swiped");
    await page.tap(".intro-flip");
    await settle(page, 3500);
    await shoot(page, "phone-4-back");
    await page.tap(".intro-open");
    await page.waitForSelector(".intro-contents", { timeout: 90_000 });
    await settle(page, 3000);
    await shoot(page, "phone-5-open");
    await page.tap(".intro-contents button:has-text('Pick up the disc')");
    await page.waitForSelector(".intro-disc", { timeout: 30_000 });
    await settle(page, 3000);
    await shoot(page, "phone-6-disc");
    const discSmall = await page.$$eval(".intro-disc button", (els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.height < 32).length);
    check("phone: Insert and play / Back are at least 32 px", discSmall === 0);
    await page.tap(".intro-disc button:has-text('Back')");
    await page.waitForFunction(() => !document.querySelector(".intro-focus"), null, { timeout: 30_000 });
    check("phone: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
  });

if (only.includes("plain"))
  await step("plain", async () => {
    const { page, errors } = await open("/?seed=7");
    await inGame(page);
    const scripts = await page.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => /\/assets\/.*\.js$/.test(n)));
    const intro = scripts.filter((s) => /Stage|Intro|boot|Still/.test(s.split("/").pop() ?? ""));
    check("/ boots straight into the game, no intro chunks fetched", intro.length === 0, intro.join(", "));
    check("plain: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
  });

if (only.includes("fps"))
  await step("fps", async () => {
    for (const fx of ["1", "0"]) {
      const { page } = await open(`/box?seed=7&fps=1&hold=1&beat=shelf&fx=${fx}`);
      await page.waitForFunction(() => !!window.__intro, null, { timeout: 60_000 });
      await page.waitForTimeout(6000);
      const m = await page.evaluate(() => ({ fps: window.__intro.fps(), ...window.__intro.info() }));
      check(`shelf fps (fx=${fx}, SwiftShader 1440x900)`, m.fps > 0, `${m.fps.toFixed(1)} fps, ${m.calls} draw calls, ${m.triangles} triangles`);
      await page.close();
    }
  });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
