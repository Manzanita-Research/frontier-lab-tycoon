import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const at = process.argv.indexOf("--url");
if (at < 0 || !process.argv[at + 1]) throw new Error("Usage: pnpm e2e:stranger --url <preview URL>");
const url = new URL(process.argv[at + 1]);
if (url.search || url.hash) throw new Error("The stranger must open a URL with no params or hash");
const out = process.env.FLT_E2E_OUT ?? "e2e/results";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
const result = { url: url.href, checks: {}, samples: [] };
const gateSince = new Map();
let firstClick = null;
let startDay = null;
let pathAt = null;
let pathPositions = null;
let moved = false;
try {
  await page.goto(url.href, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => typeof window.__fltProbe === "function", { timeout: 15_000 });
  const first = await page.evaluate(() => window.__fltProbe());
  if (first.speed !== 1 || !first.paused) throw new Error("Opening must be paused at 1×");
  await page.locator("[data-coach-active]:visible").first().waitFor({ timeout: 15_000 });
  startDay = first.day;
  firstClick = Date.now();
  await page.locator("[data-coach-active]:visible").first().click();
  const deadline = firstClick + 6 * 60_000;
  let lastClick = 0;
  while (Date.now() < deadline) {
    const now = Date.now();
    const probe = await page.evaluate(() => window.__fltProbe());
    result.samples.push({ ms: now - firstClick, ...probe });
    if (errors.length) throw new Error(`Console errors: ${errors.join("; ")}`);
    if (probe.day >= startDay + 3) result.checks.threeDaysMs ??= now - firstClick;
    if (now - firstClick >= 60_000 && !result.checks.threeDaysMs) throw new Error("Date did not advance 3 days within 60 seconds");
    const seen = new Set();
    for (const w of probe.walkers) {
      const atGate = Math.floor(w.z) === probe.gate.z && Math.floor(w.x) >= probe.gate.x && Math.floor(w.x) < probe.gate.x + 2;
      if (atGate) {
        seen.add(w.id);
        if (!gateSince.has(w.id)) gateSince.set(w.id, now);
        if (now - gateSince.get(w.id) > 5000) throw new Error(`Walker ${w.id} remained on the gate for more than 5 seconds`);
      }
      if (pathPositions?.has(w.id)) {
        const before = pathPositions.get(w.id);
        if (Math.hypot(w.x - before.x, w.z - before.z) >= 2) moved = true;
      }
    }
    for (const id of gateSince.keys()) if (!seen.has(id)) gateSince.delete(id);
    // The path action is acknowledged by the coach, without privileged access to construction state.
    if (!pathAt && ["hall", "training", "gateway"].includes(probe.coachId)) {
      pathAt = now;
      pathPositions = new Map(probe.walkers.map((w) => [w.id, { x: w.x, z: w.z }]));
    }
    if (moved) result.checks.walkerMovedMs ??= now - pathAt;
    if (pathAt && now - pathAt >= 15_000 && !moved) throw new Error("No walker moved at least 2 tiles within 15 seconds of the path");
    if (probe.coachId === "gateway" && moved && result.checks.threeDaysMs) {
      result.checks.gatewayMs = now - firstClick;
      result.checks.noGateLoiter = true;
      result.checks.consoleErrors = 0;
      await page.screenshot({ path: `${out}/gateway.png` });
      break;
    }
    if (now - lastClick >= 600) {
      // These are the only allowed controls. A confirm is the sole exception in the contract.
      const confirm = page.getByRole("button", { name: /^(OK|Build anyway|Hire anyway|Go ahead)$/i }).first();
      const tile = page.locator("[data-coach-tile]:visible").first();
      const active = page.locator("[data-coach-active]:visible").first();
      if (await confirm.count()) await confirm.click({ timeout: 1500 });
      else if (await tile.count()) await tile.click({ timeout: 1500 });
      else if (await active.count()) await active.click({ timeout: 1500 });
      lastClick = now;
    }
    await page.waitForTimeout(250);
  }
  if (!result.checks.gatewayMs) throw new Error("Coach did not reach the Gateway step within 6 minutes");
  result.passed = true;
  console.log(JSON.stringify({ passed: true, ...result.checks }, null, 2));
} catch (error) {
  result.passed = false;
  result.error = String(error);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  console.error(result.error);
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
