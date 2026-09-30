import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

// A stranger opens the preview with no params and clicks only what the coach points at. Every check is measured in
// game time (the probe's tick), so a slow runner that draws fewer frames still plays the same game. Wall-clock limits
// are only timeouts: a frozen world still fails, because its game time never moves.
const at = process.argv.indexOf("--url");
if (at < 0 || !process.argv[at + 1]) throw new Error("Usage: pnpm e2e:stranger --url <preview URL>");
const url = new URL(process.argv[at + 1]);
if (url.search || url.hash) throw new Error("The stranger must open a URL with no params or hash");
const out = process.env.FLT_E2E_OUT ?? "e2e/results";
await mkdir(out, { recursive: true });

const DAYS = 3; // (a) the date advances this many days after the first click
const MOVE_DAYS = 2; // (b) some walker moves 2 tiles within this many days of the path
const GATE_HOURS = 12; // (c) nobody stays on the gate tile longer than this
const WALL_CAP = 15 * 60_000; // the whole run, after the first click
const STALL_CAP = 3 * 60_000; // game time standing still, after the first click
const CLICK_MS = 5000;
// Software GL on a CI runner draws a few frames a second; a smaller, 1× canvas draws more of them.
const viewport = process.env.CI ? { width: 1024, height: 640 } : { width: 1440, height: 900 };

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
const result = { url: url.href, viewport, checks: {}, clicks: { ok: 0, forced: 0, gone: 0 }, samples: [] };
const gateSince = new Map();
let firstClick = null;
let start = null;
let tpd = 20;
let pathTick = null;
const pathPositions = new Map();
let maxGateTicks = 0;
let lastCoach = null;
let lastTick = null;
let lastTickAt = 0;

const days = (probe) => (probe.tick - start.tick) / tpd;
/** When a check passed, in both clocks. */
const stamp = (probe) => ({ wallS: +((Date.now() - firstClick) / 1000).toFixed(1), gameDays: +days(probe).toFixed(2) });

/** Click an allowed control. If Playwright's checks time out, one forced click, only while it is still visible and enabled. */
async function press(target) {
  try {
    await target.click({ timeout: CLICK_MS });
    result.clicks.ok++;
    return;
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
  }
  // A construction that lands removes its projected button mid-click: nothing to retry, the next probe moves on.
  if (!(await target.isVisible()) || !(await target.isEnabled({ timeout: 1000 }).catch(() => false))) {
    result.clicks.gone++;
    return;
  }
  try {
    await target.click({ force: true, timeout: CLICK_MS });
    result.clicks.forced++;
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    result.clicks.gone++;
  }
}

try {
  await page.goto(url.href, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(() => typeof window.__fltProbe === "function", { timeout: 60_000 });
  const first = await page.evaluate(() => window.__fltProbe());
  if (first.speed !== 1 || !first.paused) throw new Error("Opening must be paused at 1×");
  if (typeof first.tick !== "number") throw new Error("The probe has no game tick");
  tpd = first.ticksPerDay;
  await page.locator("[data-coach-active]:visible").first().waitFor({ timeout: 60_000 });
  // Count animation frames, for the timing report only.
  await page.evaluate(() => {
    const w = window;
    w.__strangerFrames = 0;
    const frame = () => { w.__strangerFrames++; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  start = first;
  firstClick = Date.now();
  lastTick = first.tick;
  lastTickAt = firstClick;
  await press(page.locator("[data-coach-active]:visible").first());
  let lastClick = 0;
  let probe = first;
  for (;;) {
    const now = Date.now();
    probe = await page.evaluate(() => window.__fltProbe());
    result.samples.push({ ms: now - firstClick, ...probe });
    if (errors.length) throw new Error(`Console errors: ${errors.join("; ")}`);
    if (probe.coachId !== lastCoach) {
      console.log(`Coach ${probe.coachId} at ${((now - firstClick) / 1000).toFixed(1)} s, game day ${days(probe).toFixed(2)}`);
      lastCoach = probe.coachId;
    }
    if (probe.tick !== lastTick) {
      lastTick = probe.tick;
      lastTickAt = now;
    } else if (now - lastTickAt > STALL_CAP) throw new Error(`Game time stood still for ${STALL_CAP / 60_000} minutes at game day ${days(probe).toFixed(2)} (coach ${probe.coachId})`);

    // (a) The date moves.
    if (probe.day >= start.day + DAYS) result.checks.threeDays ??= stamp(probe);

    // (c) Nobody sticks in the gate: game ticks on the gate tile, while they stay on it.
    const seen = new Set();
    for (const w of probe.walkers) {
      const atGate = Math.floor(w.z) === probe.gate.z && Math.floor(w.x) >= probe.gate.x && Math.floor(w.x) < probe.gate.x + 2;
      if (!atGate) continue;
      seen.add(w.id);
      if (!gateSince.has(w.id)) gateSince.set(w.id, probe.tick);
      const stayed = probe.tick - gateSince.get(w.id);
      maxGateTicks = Math.max(maxGateTicks, stayed);
      if (stayed > (GATE_HOURS / 24) * tpd) throw new Error(`Walker ${w.id} stayed on the gate for ${((stayed / tpd) * 24).toFixed(1)} game hours`);
    }
    for (const id of gateSince.keys()) if (!seen.has(id)) gateSince.delete(id);

    // (b) People walk once there is a path. The coach moving past the path step is the signal: no privileged access
    // to construction state. Anyone who turns up later is measured from where they were first seen.
    if (pathTick === null && ["hall", "training", "gateway", "runway", "goals"].includes(probe.coachId)) pathTick = probe.tick;
    if (pathTick !== null && !result.checks.walkerMoved) {
      for (const w of probe.walkers) {
        const from = pathPositions.get(w.id);
        if (!from) pathPositions.set(w.id, { x: w.x, z: w.z });
        else if (Math.hypot(w.x - from.x, w.z - from.z) >= 2) result.checks.walkerMoved = { ...stamp(probe), afterPathDays: +((probe.tick - pathTick) / tpd).toFixed(2), walker: w.id };
      }
      if (!result.checks.walkerMoved && probe.tick - pathTick > MOVE_DAYS * tpd) throw new Error(`No walker moved 2 tiles within ${MOVE_DAYS} game days of the path`);
    }

    // (d) The coach gets to the Gateway step.
    if (probe.coachId === "gateway") result.checks.gateway ??= stamp(probe);
    if (result.checks.threeDays && result.checks.walkerMoved && result.checks.gateway) {
      await page.screenshot({ path: `${out}/gateway.png` });
      break;
    }
    if (now - firstClick > WALL_CAP) throw new Error(`Timed out after ${WALL_CAP / 60_000} minutes at game day ${days(probe).toFixed(2)} (coach ${probe.coachId}); passed so far: ${Object.keys(result.checks).join(", ") || "none"}`);

    // Training waits for release; runway/goals wait for their timers. Only Start and construction marks ask for a click.
    if (now - lastClick >= 600 && ["start", "path", "hall", "gateway"].includes(probe.coachId)) {
      // These are the only allowed controls. A confirm is the sole exception in the contract.
      const confirm = page.getByRole("button", { name: /^(OK|Build anyway|Hire anyway|Go ahead)$/i }).first();
      const tile = page.locator("[data-coach-tile]:visible").first();
      const active = page.locator("[data-coach-active]:visible").first();
      if (await confirm.count()) await press(confirm);
      else if (await tile.count()) await press(tile);
      else if (await active.count()) await press(active);
      lastClick = Date.now();
    }
    await page.waitForTimeout(250);
  }
  // (e) Not one console error, to the end.
  if (errors.length) throw new Error(`Console errors: ${errors.join("; ")}`);
  result.checks.maxGateHours = +((maxGateTicks / tpd) * 24).toFixed(1);
  result.checks.consoleErrors = 0;
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.error = String(error);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  console.error(result.error);
  process.exitCode = 1;
} finally {
  if (firstClick) {
    const frames = await page.evaluate(() => window.__strangerFrames).catch(() => null);
    const last = result.samples.at(-1);
    const wallS = (Date.now() - firstClick) / 1000;
    const gameDays = last ? (last.tick - start.tick) / tpd : 0;
    result.timing = {
      wallS: +wallS.toFixed(1),
      gameDays: +gameDays.toFixed(2),
      gameDaysPerMinute: +((gameDays / wallS) * 60).toFixed(2),
      fps: frames === null ? null : +(frames / wallS).toFixed(1),
      samples: result.samples.length,
      msPerSample: +((wallS * 1000) / Math.max(1, result.samples.length)).toFixed(0),
      clicks: result.clicks,
      maxGateHours: +((maxGateTicks / tpd) * 24).toFixed(1),
    };
  }
  console.log(JSON.stringify({ passed: result.passed, ...result.checks, timing: result.timing }, null, 2));
  await writeFile(`${out}/report.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
