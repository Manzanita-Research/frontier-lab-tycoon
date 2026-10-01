#!/usr/bin/env node
// FLT-70: drive the big-box intro in a headless browser, the way a player would, and take its evidence shots.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/box-check.mjs [--url http://localhost:4173] [--out docs/img/flt-70] [--only flow,skip,still,phone,plain,fps]
//
// Checks: the whole flow (take the box, open it, read the manual, insert the disc, land in the game at `/`), Skip from
// the shelf, the reduced-motion still (Play), the phone layout, that `/` never shows the intro, and the shelf's frame rate.
// Exits 1 if any check fails or the page logs an error. SwiftShader is slow (a few fps), so the waits are long.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const base = opt("url", "http://localhost:4173");
const out = opt("out", "shots/flt-70");
const only = opt("only", "flow,skip,still,phone,plain,fps").split(",");
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

if (only.includes("flow"))
  await step("flow", async () => {
    const { page, errors } = await open("/box?seed=7");
    await page.waitForSelector(".intro-cta", { timeout: 60_000 });
    await page.waitForTimeout(3000);
    await shoot(page, "flow-1-shelf");
    await page.click(".intro-cta");
    await page.waitForSelector(".intro-contents", { timeout: 90_000 });
    await page.waitForTimeout(2500);
    await shoot(page, "flow-2-open");
    await page.click(".intro-contents button:has-text('The manual')");
    await page.waitForSelector(".intro-focus", { timeout: 30_000 });
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(2500);
    await shoot(page, "flow-3-manual");
    const folio = await page.textContent(".intro-folio");
    check("manual turns pages with the arrow keys", /Modding with Layers/.test(folio ?? ""), folio ?? "");
    await page.click(".intro-contents button:has-text('Insert disc')");
    await page.waitForFunction(() => JSON.stringify(window.__intro?.state?.() ?? "").includes("post"), null, { timeout: 90_000 });
    await page.waitForTimeout(2500);
    await shoot(page, "flow-4-bios");
    await inGame(page);
    await page.waitForTimeout(3000);
    await shoot(page, "flow-5-game");
    const url = new URL(page.url());
    check("insert disc lands in the game at /", url.pathname === "/" && !url.searchParams.has("intro"), url.pathname + url.search);
    check("flow: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await page.close();
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

if (only.includes("phone"))
  await step("phone", async () => {
    const { page, errors } = await open("/box?seed=7", { width: 390, height: 844, mobile: true });
    await page.waitForSelector(".intro-cta", { timeout: 60_000 });
    await page.waitForTimeout(3000);
    await shoot(page, "phone-shelf");
    await page.tap(".intro-cta");
    await page.waitForSelector(".intro-contents", { timeout: 90_000 });
    await page.waitForTimeout(2500);
    await shoot(page, "phone-open");
    await page.tap(".intro-contents button:has-text('Certificate')");
    await page.waitForTimeout(3500);
    await shoot(page, "phone-coa");
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
