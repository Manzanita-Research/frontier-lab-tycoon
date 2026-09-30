import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// The journey (FLT-53): a new player opens the game with no params, follows the coach at 1×, then plays a simple,
// sensible policy up the ladder to Level 5: build what the goal needs, hire staff, answer every card with its first
// choice, and run at 3× between goals (after a minute at 1× to read each "New!" card). Like the stranger test, every
// limit is game time from the probe; wall-clock limits are only timeouts. A soft failure (a console error, a slow
// level, a toast storm, an empty or overlapping window) is recorded with a screenshot and the run keeps playing, so one
// run reports the whole ladder; a hard one (the game lost, time frozen, the wall cap) ends it. Exit 1 if anything failed.
// Flat moments (a real minute at 1× with nothing new) are reported with a still for the triage list, not failed.
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const urlArg = arg("url");
if (!urlArg) throw new Error("Usage: pnpm e2e:journey --url <preview URL> [--minutes 90] [--beyond <game days after Level 5>]");
const url = new URL(urlArg);
if (url.search || url.hash) throw new Error("The journey must open a URL with no params or hash");
const out = process.env.FLT_E2E_OUT ?? "e2e/results/journey";
await mkdir(`${out}/levels`, { recursive: true });
await mkdir(`${out}/moments`, { recursive: true });

const LEVEL_DAYS = 120; // a level taking longer than this is a balance wall
const CASH_FLOOR = -2_000_000;
const TOAST_STORM = 6; // toasts per real minute at 1×
const LOOK_MS = 60_000; // after each level-up (and the coach), a minute at 1× to read and count toasts
const FLAT_MS = 60_000; // a real minute at 1× with nothing new (no building, card, level, model or toast) is a flat moment
const WALL_CAP = Number(arg("minutes", "90")) * 60_000;
const BEYOND_DAYS = Number(arg("beyond", "0")); // keep playing this many game days at Level 5, for the triage
const STALL_CAP = 3 * 60_000;
const HELD_MS = 4000; // a window that holds time this long, that the policy did not open, gets closed
const CLICK_MS = 5000;
const viewport = process.env.CI ? { width: 1280, height: 800 } : { width: 1440, height: 900 };

// What the sensible player builds at each level, as totals (a kind already built counts). Hires are "staff:<job>".
// Level 1 is the coach's. Level 2 wants revenue (Gateways sell the model), 3 wants seats and Vibes, 4 wants capability.
const WANTS = {
  2: [["gateway", 2], ["kombucha", 1], ["gateway", 3], ["cluster", 2], ["gateway", 4]],
  3: [["hall", 2], ["kombucha", 1], ["snack", 1], ["staff:janitor", 1], ["nap", 1], ["staff:sre", 1], ["snack", 2], ["kombucha", 2], ["hall", 3]],
  4: [["cluster", 3], ["hall", 3], ["cluster", 4], ["gateway", 5], ["cluster", 5]],
  5: [["staff:security", 1], ["staff:comms", 1], ["demo", 1]],
};
const RESERVE = 1_000_000; // cash the player keeps after a purchase
const RETRY_DAYS = 5; // after a refused or cancelled purchase
// Paths the player lays when a building has nowhere to go: the spine up from the gate, then streets across it.
const ROADS = [
  ...[18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((z) => [11, z]),
  ...[10, 9, 8, 7, 6, 5, 4, 3, 2].map((x) => [x, 14]), ...[12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((x) => [x, 14]),
  ...[10, 9, 8, 7, 6, 5, 4, 3, 2].map((x) => [x, 10]), ...[12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((x) => [x, 10]),
  ...[10, 9, 8, 7, 6, 5, 4, 3, 2].map((x) => [x, 6]), ...[12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((x) => [x, 6]),
];
const PRICES = { cluster: 600_000, hall: 900_000, gateway: 400_000, kombucha: 120_000, nap: 200_000, snack: 80_000, demo: 500_000, security: 350_000 };
const SIZE = { cluster: [2, 2], hall: [3, 3], gateway: [2, 2], kombucha: [1, 1], nap: [2, 1], snack: [1, 1], demo: [2, 2], security: [2, 2] };

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
const result = { url: url.href, viewport, levels: [], failures: [], cards: [], held: [], purchases: [], refused: [], ownToasts: [], flat: [], samples: [], clicks: { ok: 0, forced: 0, gone: 0 } };
let firstClick = 0;
let start = null;
let tpd = 20;
const wallS = () => +((Date.now() - firstClick) / 1000).toFixed(1);
const gameDays = (probe) => +((probe.tick - start.tick) / tpd).toFixed(2);
const log = (text) => console.log(`[${wallS().toFixed(0).padStart(5)} s] ${text}`);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const probeNow = () => page.evaluate(() => window.__fltProbe());

/** Park the pointer on the taskbar: off the map (no hover ghost) and away from the canvas edge (no edge scrolling). */
const park = () => page.mouse.move(viewport.width * 0.45, viewport.height - 20);
/** A shots-style still: the pointer parked, then the whole page. */
async function still(path) {
  await park();
  await page.screenshot({ path });
  return path;
}

const failedKinds = new Set();
/** A soft failure: a screenshot, then keep playing. Each kind + detail is reported once. */
async function fail(kind, message, probe) {
  const key = `${kind}:${message}`;
  if (failedKinds.has(key)) return;
  failedKinds.add(key);
  const shot = await still(`${out}/moments/fail-${String(result.failures.length + 1).padStart(2, "0")}-${slug(kind)}.png`).catch(() => null);
  result.failures.push({ kind, message, gameDay: probe ? gameDays(probe) : null, wallS: wallS(), level: probe?.progress?.level ?? null, shot });
  console.error(`FAIL ${kind}: ${message}`);
}

async function press(target) {
  try {
    await target.click({ timeout: CLICK_MS });
    result.clicks.ok++;
    return true;
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
  }
  if (!(await target.isVisible().catch(() => false)) || !(await target.isEnabled({ timeout: 1000 }).catch(() => false))) {
    result.clicks.gone++;
    return false;
  }
  try {
    await target.click({ force: true, timeout: CLICK_MS });
    result.clicks.forced++;
    return true;
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    result.clicks.gone++;
    return false;
  }
}

// ── the map ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const HALF = 12;
/** Where the middle of a footprint lands in CSS pixels, on the canvas or not; null without a camera. */
function project(view, x, z, w = 1, d = 1) {
  if (!view?.rect || view.matrix.length !== 16) return null;
  const m = view.matrix;
  const X = x + w / 2 - HALF, Z = z + d / 2 - HALF;
  const cx = m[0] * X + m[8] * Z + m[12], cy = m[1] * X + m[9] * Z + m[13], cw = m[3] * X + m[11] * Z + m[15];
  return [view.rect.left + ((cx / cw + 1) / 2) * view.rect.width, view.rect.top + ((1 - cy / cw) / 2) * view.rect.height];
}
/**
 * The middle of a footprint of w×d tiles at (x, z) on screen, through the camera the probe lends; null off the canvas.
 * The game anchors a building at round(pointer − size/2), so aim at the footprint's middle, not its first tile's.
 */
function screenOf(view, x, z, w = 1, d = 1) {
  const at = project(view, x, z, w, d);
  if (!at) return null;
  const [px, py] = at;
  // Keep away from the edges: edge scrolling would move the camera under the pointer.
  return px < 30 || py < 30 || px > view.rect.left + view.rect.width - 30 || py > view.rect.top + view.rect.height - 30 ? null : [px, py];
}
const ROAD_TILES = new Set(ROADS.map(([x, z]) => `${x},${z}`));
function grid(probe) {
  const { w, h, paths, gate, buildings } = probe.map;
  const path = new Set(paths);
  const isPath = (x, z) => x >= 0 && z >= 0 && x < w && z < h && path.has(z * w + x);
  const taken = (x, z) => x < 0 || z < 0 || x >= w || z >= h || path.has(z * w + x) ||
    (x >= gate.x && x < gate.x + gate.w && z >= gate.z && z < gate.z + gate.d) ||
    buildings.some((b) => x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.d) ||
    (z === gate.z - 1 && x >= gate.x && x < gate.x + gate.w); // the entrance approach is reserved
  // The paths people can actually reach: flood from the gate's approach.
  const reach = new Set();
  const todo = [];
  for (let x = gate.x; x < gate.x + gate.w; x++) if (isPath(x, gate.z - 1)) todo.push([x, gate.z - 1]);
  while (todo.length) {
    const [x, z] = todo.pop();
    const k = z * w + x;
    if (reach.has(k) || !isPath(x, z)) continue;
    reach.add(k);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return { w, h, path, taken, isPath, reached: (x, z) => x >= 0 && z >= 0 && x < w && z < h && reach.has(z * w + x) };
}
/** Where a building of `kind` fits next to a path, nearest the gate first (the policy's own reading of the map). */
function spots(probe, kind) {
  const g = grid(probe);
  const [bw, bd] = SIZE[kind] ?? [2, 2];
  const found = [];
  for (let z = 1; z + bd <= g.h - 1; z++) for (let x = 1; x + bw <= g.w - 1; x++) {
    let free = true;
    // Keep off the roads still to come, so the campus can grow.
    for (let i = 0; free && i < bw; i++) for (let j = 0; free && j < bd; j++) if (g.taken(x + i, z + j) || ROAD_TILES.has(`${x + i},${z + j}`)) free = false;
    if (!free) continue;
    let edge = false;
    for (let i = 0; i < bw; i++) edge ||= g.reached(x + i, z - 1) || g.reached(x + i, z + bd);
    for (let j = 0; j < bd; j++) edge ||= g.reached(x - 1, z + j) || g.reached(x + bw, z + j);
    if (edge) found.push([x, z, Math.hypot(x + bw / 2 - probe.gate.x, z + bd / 2 - probe.gate.z)]);
  }
  return found.sort((a, b) => a[2] - b[2]).map(([x, z]) => [x, z]);
}
/** Only click the map where the canvas is what is under the pointer (not a window or the taskbar). */
async function onCanvas([px, py]) {
  return page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName === "CANVAS", [px, py]);
}
/**
 * Where to click for a footprint, panning the map with the arrow keys (as a player would) until it sits on clear
 * canvas, not under a window or off the edge. Null if it cannot be brought into view.
 */
async function reveal(x, z, w = 1, d = 1) {
  for (let i = 0; i < 8; i++) {
    const p = await probeNow();
    if (p.pendingConfirm || p.event) return null;
    const at = screenOf(p.view, x, z, w, d);
    if (at && (await onCanvas(at))) return at;
    const raw = project(p.view, x, z, w, d);
    if (!raw) return null;
    // Bring it towards the middle of the canvas, which the windows leave clear.
    const dx = raw[0] - (p.view.rect.left + p.view.rect.width / 2), dy = raw[1] - (p.view.rect.top + p.view.rect.height * 0.55);
    if (Math.hypot(dx, dy) < 40) return null; // in the middle and still covered: give up on this one
    const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp");
    await park();
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(700, 120 + Math.max(Math.abs(dx), Math.abs(dy))));
    await page.keyboard.up(key);
    await page.waitForTimeout(350); // the controls glide to a stop
  }
  return null;
}

// ── the HUD (Frontier 95, the default skin; fallbacks for the base slots) ─────────────────────────────────────────────
async function openStart() {
  const menu = page.locator("[role=menu]:visible").first();
  if (await menu.count()) return menu;
  await press(page.locator("[data-testid=start-button]").first());
  await page.waitForTimeout(300);
  return page.locator("[role=menu]:visible").first();
}
async function closeStart() {
  if (await page.locator("[role=menu]:visible").count()) await page.keyboard.press("Escape");
  if (await page.locator("[role=menu]:visible").count()) await press(page.locator("[data-testid=start-button]").first());
}
async function pickTool(name) {
  const menu = await openStart();
  const item = menu.getByRole("menuitem").filter({ hasText: name }).first();
  if (!(await item.count()) || !(await item.isEnabled())) {
    await closeStart();
    return false;
  }
  return press(item);
}
const NAMES = { cluster: "Compute Cluster", hall: "Training Hall", gateway: "API Gateway", kombucha: "Kombucha Bar", nap: "Nap Pods", snack: "Snack Wall", demo: "Demo Stage", security: "Security Office", path: "Path" };
const JOBS = { janitor: "Janitor Bot", sre: "SRE", comms: "Comms Rep", security: "Security" };
async function setSpeed(speed) {
  const group = page.locator("[role=group][aria-label='Game speed']").first();
  const index = { 0: 0, 1: 1, 3: 2, 10: 3 }[speed];
  if (await group.count()) await press(group.locator("button").nth(index));
}

/** Everything that looks like a window right now: its label, box and whether it has any content below the title bar. */
const WIN = "section.f95-win, [role=dialog], [role=alertdialog], .modal-card, [role=status][aria-label^='Assistant']";
/** Every window on screen, outermost element only. `confirmOpen`: the game has a purchase confirm up (the probe says so). */
async function windows(confirmOpen = false) {
  return page.evaluate(([WIN, confirmOpen]) => {
    const seen = [];
    for (const el of document.querySelectorAll(WIN)) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || style.visibility === "hidden" || style.display === "none" || +style.opacity === 0) continue;
      if (seen.some((s) => s.el.contains(el) || el.contains(s.el))) {
        // Keep the outermost element of a window.
        const inner = seen.findIndex((s) => el.contains(s.el));
        if (inner >= 0) seen.splice(inner, 1); else continue;
      }
      seen.push({ el, r });
    }
    return seen.map(({ el, r }) => {
      const title = el.querySelector(".f95-tb, .f95-title, h2, h3")?.textContent?.trim() ?? "";
      const body = [...el.children].filter((c) => !c.matches(".f95-tb, .f95-title")).map((c) => c.textContent ?? "").join(" ").trim();
      const media = el.querySelector("img, svg, canvas, input, [role=progressbar], ul li");
      const coach = el.matches("[role=status][aria-label^='Assistant']");
      const confirm = confirmOpen && el.matches("[role=alertdialog]");
      return { label: el.getAttribute("aria-label") || title || el.className, title, coach, confirm, empty: body.length < 2 && !media, box: { x: r.left, y: r.top, w: r.width, h: r.height } };
    });
  }, [WIN, confirmOpen]);
}
/** The label of the window drawn on top at (x, y), or null for the scene. */
async function topAt(x, y) {
  return page.evaluate(([WIN, x, y]) => {
    let el = document.elementFromPoint(x, y)?.closest(WIN);
    while (el?.parentElement?.closest(WIN)) el = el.parentElement.closest(WIN);
    return el ? el.getAttribute("aria-label") || el.querySelector(".f95-tb, .f95-title, h2, h3")?.textContent?.trim() || el.className : null;
  }, [WIN, x, y]);
}
function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 4 && h > 4 ? { w, h, x: Math.max(a.x, b.x) + w / 2, y: Math.max(a.y, b.y) + h / 2 } : null;
}
/** A persistent HUD panel (the lab window, the goal note) is part of the screen, not a window that appeared. */
const SKIP_EMPTY = /collapsed|f95-strip/;

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
let probe = null;
const outcome = { reached: false };
try {
  await page.goto(url.href, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForFunction(() => typeof window.__fltProbe === "function", { timeout: 60_000 });
  const first = await probeNow();
  if (first.speed !== 1 || !first.paused) throw new Error("Opening must be paused at 1×");
  if (!first.progress || !first.map) throw new Error("This build's probe has no progress or map (FLT-53 adds them): it cannot be played past the coach");
  tpd = first.ticksPerDay;
  await page.locator("[data-coach-active]:visible").first().waitFor({ timeout: 60_000 });
  await page.evaluate(() => {
    const w = window;
    w.__journeyFrames = 0;
    const frame = () => { w.__journeyFrames++; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  });
  start = first;
  firstClick = Date.now();
  await still(`${out}/levels/level-1.png`);
  result.levels.push({ level: 1, name: first.progress.name, gameDay: 0, wallS: 0, cash: first.cash, runway: first.runway, toastsPerMinute: 0, windows: (await windows()).map((w) => w.label), shot: `${out}/levels/level-1.png` });
  await press(page.locator("[data-coach-active]:visible").first());

  let lastTick = first.tick, lastTickAt = Date.now();
  let level = 1, levelTick = first.tick, levelAt = Date.now();
  let lookUntil = 0; // real time: stay at 1× until then
  let coachDone = false;
  let lastAct = 0;
  let lastCoachClick = 0;
  let heldSince = 0;
  let staffLeftOpen = false; // the policy's own Staff Manager, left up when a card took the close click
  const toastSeen = new Set();
  const toastTimes = []; // real ms of each new toast seen while running at 1×
  let levelToasts = 0;
  const cardSeen = new Set();
  const retryAt = new Map(); // want key → game tick
  let reachedAt = null;
  let lastSample = 0;
  let flatKey = "", flatSince = Date.now();

  for (;;) {
    const now = Date.now();
    probe = await probeNow();
    if (now - lastSample >= 5000) {
      lastSample = now;
      result.samples.push({ wallS: wallS(), gameDay: gameDays(probe), level: probe.progress.level, cash: probe.cash, runway: probe.runway, income: probe.income, net: probe.net, speed: probe.speed, paused: probe.paused, researchers: probe.researchers, vibes: Math.round(probe.vibes), models: probe.models, rank: probe.rank, buildings: probe.map.buildings.length, walkers: probe.walkers.length });
    }

    // ── checks ──
    if (errors.length) await fail("console error", errors.splice(0).join("; ").slice(0, 400), probe);
    if (probe.cash < CASH_FLOOR) await fail("cash floor", `Cash ${probe.cash} below ${CASH_FLOOR}`, probe);
    if (probe.outcome?.outcome === "lost" && !probe.outcome.dismissed) throw new Error(`The game was lost at game day ${gameDays(probe)} (level ${probe.progress.level})`);
    if (probe.tick !== lastTick) { lastTick = probe.tick; lastTickAt = now; }
    else if (now - lastTickAt > STALL_CAP) throw new Error(`Game time stood still for ${STALL_CAP / 60_000} minutes at game day ${gameDays(probe)} (level ${probe.progress.level}, overlays ${probe.overlays.join(",") || "none"}, event ${probe.event ?? "none"})`);
    const levelDays = (probe.tick - levelTick) / tpd;
    if (levelDays > LEVEL_DAYS && probe.progress.level < 5) await fail("slow level", `Level ${probe.progress.level} (${probe.progress.name}) took more than ${LEVEL_DAYS} game days; goal "${probe.progress.goal.text}" at ${probe.progress.goal.current}/${probe.progress.goal.target}`, probe);

    // Toasts: count each new one; the storm check is for 1× only.
    for (const t of probe.toasts) {
      const key = `${t.id}|${t.text}`;
      if (toastSeen.has(key)) continue;
      toastSeen.add(key);
      levelToasts++;
      if (probe.speed === 1 && !probe.paused) toastTimes.push(now);
    }
    while (toastTimes.length && now - toastTimes[0] > 60_000) toastTimes.shift();
    if (toastTimes.length > TOAST_STORM) {
      await fail("toast storm", `${toastTimes.length} toasts in one real minute at 1× (level ${probe.progress.level}): ${probe.toasts.map((t) => t.text).join(" / ")}`, probe);
      toastTimes.length = 0; // one failure per storm, not one per poll
    }

    // Windows: none empty; nothing on the coach or the confirm.
    const wins = await windows(!!probe.pendingConfirm);
    for (const w of wins) if (w.empty && !SKIP_EMPTY.test(w.label)) await fail("empty window", `"${w.label}" renders empty`, probe);
    for (const key of wins.filter((w) => w.coach || w.confirm)) {
      for (const other of wins) {
        if (other === key || other.coach || other.confirm) continue;
        const o = overlap(key.box, other.box);
        if (o) await fail("overlap", `${key.coach ? "The coach" : "The confirm"} and "${other.label}" overlap by ${o.w.toFixed(0)}×${o.h.toFixed(0)} px ("${(await topAt(o.x, o.y)) ?? "the scene"}" on top)`, probe);
      }
    }

    // Flat moments: reported with a still, not failed (the player may simply be waiting on a model).
    const change = `${probe.progress.level}|${probe.map.buildings.length}|${probe.models}|${cardSeen.size}|${toastSeen.size}|${probe.event}`;
    if (change !== flatKey || probe.speed !== 1 || probe.paused) { flatKey = change; flatSince = now; }
    else if (now - flatSince > FLAT_MS) {
      const shot = await still(`${out}/moments/flat-${String(result.flat.length + 1).padStart(2, "0")}.png`);
      result.flat.push({ gameDay: gameDays(probe), level: probe.progress.level, coach: probe.coachId, training: probe.training, shot });
      log(`Flat: a real minute at 1× with nothing new (level ${probe.progress.level}, game day ${gameDays(probe)}${probe.coachId ? `, coach step ${probe.coachId}` : ""})`);
      flatSince = now;
    }

    // ── level-ups ──
    if (probe.progress.level !== level) {
      const toastsPerMinute = +(levelToasts / Math.max(1 / 60, (now - levelAt) / 60_000)).toFixed(1);
      level = probe.progress.level;
      await page.waitForTimeout(600); // let the "New!" card draw
      const shot = await still(`${out}/levels/level-${level}.png`);
      const row = { level, name: probe.progress.name, gameDay: gameDays(probe), levelDays: +levelDays.toFixed(1), wallS: wallS(), cash: probe.cash, runway: probe.runway, income: probe.income, toastsPerMinute, windows: (await windows()).map((w) => w.label), goal: probe.progress.goal.text, shot };
      result.levels.push(row);
      log(`LEVEL ${level} ${row.name} at game day ${row.gameDay} (${row.levelDays} days for the last level), cash ${(probe.cash / 1e6).toFixed(2)}M, runway ${probe.runway === null ? "∞" : `${probe.runway.toFixed(1)} mo`}`);
      levelTick = probe.tick; levelAt = now; levelToasts = 0;
      lookUntil = now + LOOK_MS;
      if (level === 5 && reachedAt === null) { outcome.reached = true; reachedAt = probe.tick; }
    }
    if (reachedAt !== null && (probe.tick - reachedAt) / tpd >= BEYOND_DAYS) break;
    if (now - firstClick > WALL_CAP) throw new Error(`Timed out after ${WALL_CAP / 60_000} minutes at game day ${gameDays(probe)} (level ${probe.progress.level}, goal ${probe.progress.goal.text} ${probe.progress.goal.current}/${probe.progress.goal.target})`);

    // ── what's in front of the player ──
    if (probe.outcome && probe.outcome.outcome !== "playing" && !probe.outcome.dismissed) {
      await still(`${out}/moments/outcome-${probe.outcome.outcome}.png`);
      const keep = page.getByRole("button", { name: /Keep playing/i }).first();
      if (await keep.count()) await press(keep);
      await page.waitForTimeout(300);
      continue;
    }
    if (probe.pendingConfirm) {
      // The coach's own steps go ahead, as the stranger does; anything else keeps the runway and tries later.
      const dialog = page.locator("[role=alertdialog]:visible, [role=dialog]:visible").filter({ hasText: /runway/i }).first();
      const coachStep = !coachDone;
      result.refused.push({ gameDay: gameDays(probe), kind: probe.pendingConfirm.kind, message: probe.pendingConfirm.message, went: coachStep });
      const button = coachStep ? dialog.getByRole("button", { name: /^(OK|Go ahead|Build anyway|Hire anyway)$/i }).first() : dialog.getByRole("button", { name: /^(Cancel|Keep the runway)$/i }).first();
      if (await button.count()) await press(button);
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      continue;
    }
    if (probe.event) {
      const dialog = page.locator("[role=dialog]:visible, [role=alertdialog]:visible").last();
      const choice = dialog.locator(".f95-choices button, button.choice, .choices button").first();
      if (!cardSeen.has(probe.event)) {
        cardSeen.add(probe.event);
        const shot = await still(`${out}/moments/card-${slug(probe.event)}.png`);
        result.cards.push({ id: probe.event, gameDay: gameDays(probe), level: probe.progress.level, choice: (await choice.textContent().catch(() => ""))?.trim().replace(/\s+/g, " ").slice(0, 80), shot });
        log(`Card ${probe.event}: first choice`);
      }
      if (await choice.count()) await press(choice);
      else {
        const era = page.locator(".f95-bsod-go, [role=alertdialog] button").first();
        if (await era.count()) await press(era);
        else await fail("dead end", `Card ${probe.event} is open but shows no choice to press`, probe);
      }
      await page.waitForTimeout(400);
      continue;
    }
    // The era card is its own full-screen window.
    const bsod = page.locator(".f95-bsod-go:visible").first();
    if (await bsod.count()) {
      await still(`${out}/moments/era-${probe.progress.level}-${gameDays(probe).toFixed(0)}.png`);
      await press(bsod);
      continue;
    }
    if (probe.unlockCard && now > levelAt + 5000) {
      const ok = page.locator(".f95-unlock button, [role=status] button").filter({ hasText: /^(OK|Got it)$/ }).first();
      if (await ok.count()) await press(ok);
    }
    // Something the player did not open is holding time: give it a moment, then close it.
    if (probe.overlays.length && coachDone) {
      heldSince ||= now;
      if (now - heldSince > HELD_MS) {
        const held = probe.overlays.join(",");
        if (staffLeftOpen && held === "staff") log("Closing the Staff Manager the policy left open");
        else if (!result.held.some((h) => h.overlays === held)) {
          const shot = await still(`${out}/moments/held-${slug(held)}.png`);
          result.held.push({ overlays: held, gameDay: gameDays(probe), level: probe.progress.level, shot });
          log(`Time held by ${held}: closing it`);
        }
        await page.keyboard.press("Escape");
        const close = page.locator("section.f95-win:visible [data-g=close], [role=dialog]:visible [data-g=close]").last();
        if (await close.count()) await press(close);
        heldSince = 0;
      }
    } else heldSince = 0;

    // ── the coach, at 1× ──
    if (!coachDone && (probe.coachId === null || probe.coachId === undefined) && probe.models > 0) {
      coachDone = true;
      lookUntil = now + LOOK_MS;
      log(`Coach done at game day ${gameDays(probe)}`);
    }
    if (!coachDone) {
      if (now - lastCoachClick >= 600 && ["start", "path", "hall", "gateway"].includes(probe.coachId)) {
        const tile = page.locator("[data-coach-tile]:visible").first();
        const active = page.locator("[data-coach-active]:visible").first();
        if (await tile.count()) await press(tile);
        else if (await active.count()) await press(active);
        lastCoachClick = Date.now();
      }
      await page.waitForTimeout(250);
      continue;
    }

    // ── speed: 1× for a minute after each level-up, 3× between goals ──
    const want = now < lookUntil ? 1 : 3;
    if (probe.speed !== want && probe.speed !== 0) await setSpeed(want);
    if (probe.speed === 0) await setSpeed(want);

    // ── the sensible player: one action per game day at most ──
    if (now - lastAct > 1200 && !probe.paused) {
      lastAct = now;
      await act(probe);
      // Whatever toasted while the policy clicked is its own doing: keep it out of the storm count, but keep it.
      for (const t of (await probeNow()).toasts) {
        const key = `${t.id}|${t.text}`;
        if (toastSeen.has(key)) continue;
        toastSeen.add(key);
        result.ownToasts.push({ gameDay: gameDays(probe), level: probe.progress.level, text: t.text });
      }
    }
    await page.waitForTimeout(250);
  }

  /** Build or hire the next thing this level wants, if the cash allows. */
  async function act(p) {
    const lvl = p.progress.level;
    const list = WANTS[Math.min(lvl, 5)] ?? [];
    const have = (kind) => kind.startsWith("staff:") ? p.staff.filter((j) => j === kind.slice(6)).length : p.map.buildings.filter((b) => b.kind === kind).length;
    // This level's goal first; then wants from the level below (a Level 3 player still wants the Gateways it skipped).
    const all = [...list, ...(WANTS[lvl - 1] ?? [])];
    for (const [kind, count] of all) {
      if (have(kind) >= count) continue;
      const key = `${kind}#${count}`;
      if ((retryAt.get(key) ?? 0) > p.tick) continue;
      if (kind.startsWith("staff:")) {
        const job = kind.slice(6);
        if (!p.progress.unlocked.staff.includes(job)) continue;
        if (p.runway !== null && p.runway < 4) continue;
        if (await hire(job, p)) return;
        retryAt.set(key, p.tick + RETRY_DAYS * tpd);
        continue;
      }
      if (!p.progress.unlocked.buildings.includes(kind)) continue;
      const price = PRICES[kind] ?? 500_000;
      if (p.cash < price + RESERVE) return; // wait for this one: don't skip ahead to cheaper toys
      if (await build(kind, p)) return;
      retryAt.set(key, p.tick + RETRY_DAYS * tpd);
      return;
    }
  }
  async function build(kind, p) {
    let options = spots(p, kind);
    if (!options.length) {
      // Lay the next stretch of road, then try again next time.
      await layRoad(p, 4);
      return false;
    }
    if (!(await pickTool(NAMES[kind]))) return false;
    await page.waitForTimeout(250);
    const before = p.map.buildings.length;
    for (const [x, z] of options.slice(0, 6)) {
      const fresh = await probeNow();
      if (fresh.pendingConfirm || fresh.event) break;
      const at = await reveal(x, z, ...(SIZE[kind] ?? [2, 2]));
      if (!at) continue;
      await page.mouse.click(at[0], at[1]);
      await page.waitForTimeout(500);
      const after = await probeNow();
      if (after.pendingConfirm) break; // the confirm is answered by the main loop
      if (after.map.buildings.length > before) {
        result.purchases.push({ gameDay: gameDays(after), level: after.progress.level, kind, x, z, cash: after.cash });
        log(`Built ${NAMES[kind]} at ${x},${z} (game day ${gameDays(after)}, cash ${(after.cash / 1e6).toFixed(2)}M)`);
        break;
      }
    }
    await page.keyboard.press("Escape");
    const done = (await probeNow()).map.buildings.length > before;
    return done;
  }
  /** Lay the next n tiles of the planned roads, in order, so the road stays in one piece. */
  async function layRoad(p, n) {
    const g = grid(p);
    const todo = ROADS.filter(([x, z]) => !g.isPath(x, z) && !g.taken(x, z)).slice(0, n);
    if (!todo.length) return;
    if (!(await pickTool("Path"))) return;
    await page.waitForTimeout(250);
    let laid = 0;
    for (const [x, z] of todo) {
      const at = await reveal(x, z);
      if (!at) break;
      const before = (await probeNow()).map.paths.length;
      await page.mouse.click(at[0], at[1]);
      await page.waitForTimeout(250);
      if ((await probeNow()).map.paths.length <= before) break;
      laid++;
    }
    await page.keyboard.press("Escape");
    if (laid) log(`Laid ${laid} path tiles`);
    else log(`Could not lay the road at ${todo[0].join(",")}`);
  }
  async function hire(job, p) {
    // Staff toggles the Staff Manager: only open it if it is not already up.
    if (!(await page.locator("section.f95-staff:visible").count()) && !(await pickTool("Staff"))) return false;
    await page.waitForTimeout(400);
    const win = page.locator("section.f95-staff:visible, [role=dialog]:visible").filter({ hasText: /Hire/ }).first();
    const row = win.locator("li").filter({ has: page.locator("b", { hasText: new RegExp(`^${JOBS[job]}$`) }) }).first();
    const button = row.getByRole("button", { name: /^Hire/ }).first();
    let ok = false;
    if ((await button.count()) && (await button.isEnabled())) {
      await press(button);
      await page.waitForTimeout(400);
      const after = await probeNow();
      ok = after.staff.filter((j) => j === job).length > p.staff.filter((j) => j === job).length || !!after.pendingConfirm;
      if (ok && !after.pendingConfirm) {
        result.purchases.push({ gameDay: gameDays(after), level: after.progress.level, kind: `staff:${job}`, cash: after.cash });
        log(`Hired ${JOBS[job]} (game day ${gameDays(after)})`);
      }
    }
    const close = page.locator("section.f95-staff:visible [data-g=close]").first();
    if (await close.count()) await press(close);
    await page.waitForTimeout(200);
    staffLeftOpen = (await page.locator("section.f95-staff:visible").count()) > 0;
    return ok;
  }

  result.passed = result.failures.length === 0;
} catch (error) {
  result.passed = false;
  result.error = String(error);
  await still(`${out}/failure.png`).catch(() => {});
  console.error(result.error);
} finally {
  const last = probe;
  const frames = await page.evaluate(() => window.__journeyFrames).catch(() => null);
  const wall = firstClick ? (Date.now() - firstClick) / 1000 : 0;
  result.reachedLevel5 = outcome.reached;
  result.final = last ? { gameDay: start ? gameDays(last) : 0, level: last.progress?.level, cash: last.cash, runway: last.runway, income: last.income, researchers: last.researchers, vibes: Math.round(last.vibes), rank: last.rank, models: last.models, buildings: last.map?.buildings.length } : null;
  result.timing = { wallS: +wall.toFixed(1), fps: frames === null || !wall ? null : +(frames / wall).toFixed(1), clicks: result.clicks };
  // Every still is checked for a blank frame, like `pnpm shots`.
  try {
    execFileSync("node", ["scripts/shots.mjs", "--verify", `${out}/levels`], { stdio: "pipe" });
    result.stillsVerified = true;
  } catch (error) {
    result.stillsVerified = false;
    result.failures.push({ kind: "blank still", message: String(error.stdout ?? error).slice(0, 400) });
    result.passed = false;
  }
  await writeFile(`${out}/report.json`, JSON.stringify(result, null, 2));
  await writeFile(`${out}/report.md`, report(result));
  console.log(report(result));
  process.exitCode = result.passed ? 0 : 1;
  await browser.close();
}

function report(r) {
  const money = (n) => (n === null || n === undefined ? "–" : `${n < 0 ? "−" : ""}$${(Math.abs(n) / 1e6).toFixed(2)}M`);
  const rows = r.levels.map((l) => `| ${l.level} ${l.name} | ${l.gameDay} | ${l.levelDays ?? "–"} | ${(l.wallS / 60).toFixed(1)} min | ${money(l.cash)} | ${l.runway === null || l.runway === undefined ? "∞" : `${l.runway.toFixed(1)} mo`} | ${l.toastsPerMinute} | ${l.windows.join("; ").slice(0, 120)} |`);
  return `# Journey test: Level 1 → 5

${r.passed ? "**Passed**" : "**Failed**"}. Level 5 ${r.reachedLevel5 ? "reached" : "**not** reached"}. ${r.url}, ${r.viewport.width}×${r.viewport.height}, ${r.timing?.wallS ?? "?"} s wall, ${r.timing?.fps ?? "?"} fps.
${r.error ? `\nStopped: ${r.error}\n` : ""}
| Level | Game day | Days on the last level | Wall | Cash | Runway | Toasts/min (last level) | Open windows |
|---|---:|---:|---:|---:|---:|---:|---|
${rows.join("\n")}

Final: ${JSON.stringify(r.final)}

## Failures (${r.failures.length})
${r.failures.map((f) => `- **${f.kind}** (level ${f.level ?? "?"}, game day ${f.gameDay ?? "?"}): ${f.message}`).join("\n") || "none"}

## Cards answered (${r.cards.length})
${r.cards.map((c) => `- day ${c.gameDay}, L${c.level}: ${c.id} → ${c.choice}`).join("\n") || "none"}

## Flat moments: a real minute at 1× with nothing new (${r.flat.length})
${r.flat.map((f) => `- day ${f.gameDay}, L${f.level}${f.coach ? `, coach step "${f.coach}"` : ""}${f.training ? `, training ${f.training.name} ${Math.round(f.training.pct * 100)}%` : ""}: ${f.shot}`).join("\n") || "none"}

## Windows that held time on their own (${r.held.length})
${r.held.map((h) => `- day ${h.gameDay}, L${h.level}: ${h.overlays}`).join("\n") || "none"}

## Toasts from the policy's own clicks (${r.ownToasts.length}, not counted as a storm)
${[...new Set(r.ownToasts.map((t) => t.text))].map((t) => `- ${t} (×${r.ownToasts.filter((o) => o.text === t).length})`).join("\n") || "none"}

## Purchases (${r.purchases.length}); confirms (${r.refused.length})
${r.purchases.map((p) => `day ${p.gameDay} ${p.kind}`).join(" · ")}
${r.refused.map((p) => `- day ${p.gameDay}: ${p.kind}: ${p.went ? "went ahead" : "kept the runway"}: ${p.message}`).join("\n")}
`;
}
