import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { throughTheBox } from "./box.mjs";

// The journey (FLT-53): a new player opens the game with no params, plays the box on the shelf (FLT-95; tapped on a
// phone; a `--skin` link goes straight to the game), follows the coach at 1×, then plays a simple,
// sensible policy up the ladder to Level 5: build what the goal needs, hire staff, answer every card with its first
// choice, and run at 3× between goals (after a minute at 1× to read each "New!" card). Like the stranger test, every
// limit is game time from the probe; wall-clock limits are only timeouts. A soft failure (a console error, a slow
// level, a toast storm, an empty or overlapping window) is recorded with a screenshot and the run keeps playing, so one
// run reports the whole ladder; a hard one (the game lost, time frozen, the wall cap) ends it. Exit 1 if anything failed.
// Flat moments (a real minute at 1× with nothing new) are reported with a still for the triage list, not failed.
//
// `--phone` (FLT-61): the same player on a 390×844 touch screen, touch only: taps, a one-finger drag to pan, a pinch to
// zoom. No pointer hover and no keyboard. On top of the desktop checks it fails on what makes a phone hard to play: a
// tappable thing under 32 px, a window wider than the screen or with its close button off it, the coach off-screen,
// text under 11 px, a control only hover reveals, a map that needs precision taps, the campus under 40% of the screen,
// and a card whose buttons need a scroll. Both modes fail on "[app] … action failed" in the console (the FLT-81 guard).
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const urlArg = arg("url");
if (!urlArg) throw new Error("Usage: pnpm e2e:journey --url <preview URL> [--phone] [--skin <id>] [--minutes 90] [--beyond <game days after Level 5>]");
const phone = process.argv.includes("--phone");
const url = new URL(urlArg);
if (url.search || url.hash) throw new Error("The journey must open a URL with no params or hash");
// A skin other than the default (FLT-61 does a first minute on Base with `--skin base --minutes 1.5`): the coach is
// skin-agnostic, the Start menu the policy builds with is Frontier 95's.
const skin = arg("skin");
const opened = new URL(url);
if (skin) opened.searchParams.set("skin", skin);
const out = process.env.FLT_E2E_OUT ?? "e2e/results/journey";
await mkdir(`${out}/levels`, { recursive: true });
await mkdir(`${out}/moments`, { recursive: true });

// Game days each level may take (FLT-58), as in src/sim/ladder.test.ts: long enough to be a level, short enough not to be a wall.
const LEVEL_WINDOW = { 2: [5, 25], 3: [5, 40], 4: [5, 40], 5: [5, 45] };
const CASH_FLOOR = -2_000_000;
const TOAST_STORM = 6; // toasts per real minute at 1×
const LOOK_MS = 60_000; // after each level-up (and the coach), a minute at 1× to read and count toasts
const FLAT_MS = 60_000; // a real minute at 1× (or at the 3× the coach asks for) with nothing new (no building, card, level, model, toast or coach step) is a flat moment
const WALL_CAP = Number(arg("minutes", "90")) * 60_000;
const BEYOND_DAYS = Number(arg("beyond", "0")); // keep playing this many game days at Level 5, for the triage
const STALL_CAP = 3 * 60_000;
const HELD_MS = 4000; // a window that holds time this long, that the policy did not open, gets closed
const CLICK_MS = 5000;
const viewport = phone ? { width: 390, height: 844 } : process.env.CI ? { width: 1280, height: 800 } : { width: 1440, height: 900 };
// FLT-61's phone thresholds.
const TAP_MIN = 32; // px: anything tappable, and a map tile to build on without a precision tap
const TEXT_MIN = 11; // px
const CAMPUS_MIN = 0.4; // of the screen showing the map, with nothing but the HUD up
const PHONE_CHECK_MS = 3000; // the DOM sweeps are heavy: at most this often
// A finger lands near where it aims, not on it: each tap on the map is off by one of these (px), in turn.
const JITTER = [[0, 0], [5, -4], [-6, 3], [4, 6], [-3, -6], [6, 2]];

// What the sensible player builds at each level, as totals (a kind already built counts). Hires are "staff:<job>".
// Level 1 is the coach's. Level 2 wants revenue and visitors (Gateways, a Kombucha Bar), 3 wants an SRE and a Janitor for
// the first spill and breakdown, 4 wants capability. Mirrors WANTS in src/sim/ladder.test.ts.
const WANTS = {
  2: [["gateway", 1], ["kombucha", 1], ["gateway", 2], ["kombucha", 2], ["cluster", 2]],
  3: [["staff:sre", 1], ["staff:janitor", 1], ["snack", 1], ["staff:janitor", 2], ["hall", 2], ["nap", 1], ["cluster", 3]],
  4: [["cluster", 4], ["gateway", 3], ["cluster", 5], ["hall", 3], ["cluster", 6]],
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
const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
const page = await context.newPage();
const cdp = phone ? await context.newCDPSession(page) : null;
const errors = [];
const appFailed = []; // FLT-81/84: "[app] … action failed", whatever its console level
page.on("console", (message) => {
  if (/\[app\].*action failed/i.test(message.text())) appFailed.push(message.text());
  else if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));
const result = { url: opened.href, viewport, phone, touch: { taps: 0, drags: 0, pinches: 0, tile: null, misplaced: 0 }, campus: [], levels: [], failures: [], cards: [], held: [], purchases: [], refused: [], ownToasts: [], flat: [], samples: [], clicks: { ok: 0, forced: 0, gone: 0 } };
let firstClick = 0;
let start = null;
let tpd = 20;
const wallS = () => +((Date.now() - firstClick) / 1000).toFixed(1);
const gameDays = (probe) => +((probe.tick - start.tick) / tpd).toFixed(2);
const log = (text) => console.log(`[${wallS().toFixed(0).padStart(5)} s] ${text}`);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const probeNow = () => page.evaluate(() => window.__fltProbe());

/** Park the pointer on the taskbar: off the map (no hover ghost) and away from the canvas edge (no edge scrolling). A finger has no pointer to park. */
const park = async () => { if (!phone) await page.mouse.move(viewport.width * 0.45, viewport.height - 20); };
/** A shots-style still: the pointer parked, then the whole page. */
async function still(path) {
  await park();
  await page.screenshot({ path });
  return path;
}

const failedKinds = new Set();
/** A soft failure: a screenshot, then keep playing. Each kind + detail is reported once. */
async function fail(kind, message, probe, key = `${kind}:${message}`) {
  if (failedKinds.has(key)) return;
  failedKinds.add(key);
  const shot = await still(`${out}/moments/fail-${String(result.failures.length + 1).padStart(2, "0")}-${slug(kind)}.png`).catch(() => null);
  result.failures.push({ kind, message, gameDay: probe ? gameDays(probe) : null, wallS: wallS(), level: probe?.progress?.level ?? null, shot });
  console.error(`FAIL ${kind}: ${message}`);
}

async function press(target) {
  try {
    if (phone) await target.tap({ timeout: CLICK_MS });
    else await target.click({ timeout: CLICK_MS });
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
    if (phone) await target.tap({ force: true, timeout: CLICK_MS });
    else await target.click({ force: true, timeout: CLICK_MS });
    result.clicks.forced++;
    return true;
  } catch (error) {
    if (error.name !== "TimeoutError") throw error;
    result.clicks.gone++;
    return false;
  }
}

// ── touch (FLT-61) ──────────────────────────────────────────────────────────────────────────────────────────────────
// Real touch events through CDP: the map's controls read pointer events of type "touch", as on a phone.
const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 6, radiusY: 6, force: 1 })) });
async function drag(x, y, dx, dy, steps = 12) {
  await touch("touchStart", [[x, y]]);
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", [[x + (dx * i) / steps, y + (dy * i) / steps]]);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  result.touch.drags++;
}
async function pinch(x, y, from, to, steps = 12) {
  await touch("touchStart", [[x - from, y], [x + from, y]]);
  for (let i = 1; i <= steps; i++) {
    const d = from + ((to - from) * i) / steps;
    await touch("touchMove", [[x - d, y], [x + d, y]]);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  result.touch.pinches++;
}
/** A tap on the map, or a click on a desktop. */
async function tapAt(x, y) {
  if (phone) {
    await page.touchscreen.tap(x, y);
    result.touch.taps++;
  } else await page.mouse.click(x, y);
}
/** Put down the tool in hand: Escape on a desktop, the Done ✕ button on a phone (FLT-63). */
async function putDown() {
  if (!phone) return page.keyboard.press("Escape");
  const done = page.locator(".mode-done:visible").first();
  if (await done.count()) await press(done);
}
/** Close the window on top: Escape on a desktop, its ✕ on a phone. */
async function closeTop() {
  if (!phone) return page.keyboard.press("Escape");
  const close = page.locator("section.f95-win:visible [data-g=close], [role=dialog]:visible [data-g=close]").last();
  if (await close.count()) await press(close);
}
/** Close the Inspector the coach's peek opened by its own ✕ (the paperclip or a card can be above it); true once it is gone. */
async function closeInspector() {
  if (!phone) return page.keyboard.press("Escape").then(() => true);
  const close = page.locator("section.f95-props:visible [data-g=close]").first();
  if (await close.count()) await press(close);
  await page.waitForTimeout(300);
  return !(await page.locator("section.f95-props:visible").count());
}
/** The size of one map tile on screen, in px (the shorter of its two sides). */
function tilePx(view) {
  const a = project(view, 11, 11), b = project(view, 12, 11), c = project(view, 11, 12);
  return a && b && c ? Math.min(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1])) : 0;
}
/** Where a phone's Done ✕ button (FLT-63) will be once a tool is in hand: the right edge, 46% down. */
const underDone = ([x, y]) => phone && x > viewport.width * 0.45 && y > viewport.height * 0.38 && y < viewport.height * 0.6;
/** A point near the middle of the map that only the canvas covers, for a finger to land on; null if there is none. */
async function clearSpot() {
  for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.4], [0.5, 0.6], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7]]) {
    const at = [viewport.width * fx, viewport.height * fy];
    if (await onCanvas(at)) return at;
  }
  return null;
}
/**
 * Pinch in until a tile is TAP_MIN px across, so a building lands where a finger aims. The pinch is counted: needing it
 * is the phone's cost. A map that the maximum zoom still leaves under TAP_MIN is a failure (only precision taps place).
 */
async function zoomForTaps() {
  for (let i = 0; i < 4; i++) {
    const p = await probeNow();
    const px = tilePx(p.view);
    result.touch.tile = +px.toFixed(1);
    if (px >= TAP_MIN) return true;
    const at = await clearSpot();
    if (!at) return false;
    // Fingers 2·from apart move to 2·to apart; keep them on screen.
    const span = Math.min(at[0], viewport.width - at[0]) - 10;
    await pinch(at[0], at[1], 30, Math.min(span, 30 * Math.min(2.2, (TAP_MIN + 4) / Math.max(1, px))));
    await page.waitForTimeout(400);
  }
  const px = tilePx((await probeNow()).view);
  result.touch.tile = +px.toFixed(1);
  if (px < TAP_MIN) await fail("precision", `A map tile is ${px.toFixed(0)} px across at the closest a pinch goes: placing a building needs a precision tap`, await probeNow());
  return px >= TAP_MIN;
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
    if (at && !underDone(at) && (await onCanvas(at))) return at;
    const raw = project(p.view, x, z, w, d);
    if (!raw) return null;
    // Bring it towards the middle of the canvas, which the windows leave clear. A phone's Done ✕ button (FLT-63) sits at the
    // right edge, 46% down, while a tool is in hand: aim left of and below it there.
    const [ax, ay] = phone ? [0.4, 0.6] : [0.5, 0.55];
    const dx = raw[0] - (p.view.rect.left + p.view.rect.width * ax), dy = raw[1] - (p.view.rect.top + p.view.rect.height * ay);
    if (Math.hypot(dx, dy) < 40) return null; // in the middle and still covered: give up on this one
    if (phone) {
      // Drag the map under a finger: the spot moves with it, towards the middle.
      const from = await clearSpot();
      if (!from) return null;
      const k = Math.min(1, 220 / Math.hypot(dx, dy));
      await drag(from[0], from[1], -dx * k, -dy * k);
      await page.waitForTimeout(450); // the controls glide to a stop
      continue;
    }
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
  if (!phone && (await page.locator("[role=menu]:visible").count())) await page.keyboard.press("Escape");
  if (await page.locator("[role=menu]:visible").count()) await press(page.locator("[data-testid=start-button]").first());
}
/** FLT-94: open an applet by its Quick Launch icon (on a phone most wait behind the tray's », `apps`). False if there is none. */
async function launchApp(id) {
  const icon = () => page.locator(`[data-anchor="app:${id}"]:visible`).first();
  if (!(await icon().count())) {
    const more = page.locator('[data-anchor="apps"]:visible').first();
    if (!(await more.count())) return false;
    await press(more);
    await page.waitForTimeout(250);
  }
  if (!(await icon().count())) return false;
  return press(icon());
}
/** FLT-94: Frontier 95 builds from the Facilities palette: open it (Quick Launch), pick the tile, put the palette away. Null: no palette here. */
async function pickFromPalette(kind) {
  const tile = () => page.locator(`section.f95-palette [data-anchor="build:${kind}"]:visible`).first();
  if (!(await tile().count())) {
    if (!(await page.locator('[data-anchor="app:facilities"]:visible').count())) return null;
    await launchApp("facilities");
    await page.waitForTimeout(300);
  }
  const ok = (await tile().count()) > 0 && (await tile().isEnabled()) && (await press(tile()));
  // A phone's palette shuts itself on a pick; on a desktop it stays up (it's a toolbox), and the player puts it away.
  const close = page.locator("section.f95-palette:visible [data-g=close]").first();
  if (await close.count()) await press(close);
  return ok;
}
const KIND_OF = { "Compute Cluster": "cluster", "Training Hall": "hall", "API Gateway": "gateway", "Kombucha Bar": "kombucha", "Nap Pods": "nap", "Snack Wall": "snack", "Demo Stage": "demo", "Security Office": "security" };
async function pickTool(name) {
  // FLT-94: a building is a tile in the Facilities palette and hiring is the Staff Manager applet; Path stays on top of
  // Start. A skin without them (`--skin base`) keeps FLT-63's Start ▸ Facilities ▸.
  if (name === "Staff" && ((await launchApp("staff")) || (await pickFromPalette("staff")))) return true;
  if (KIND_OF[name]) {
    const picked = await pickFromPalette(KIND_OF[name]);
    if (picked !== null) return picked;
  }
  const menu = await openStart();
  let item = menu.getByRole("menuitem").filter({ hasText: name }).first();
  // FLT-63: buildings live in Start ▸ Facilities ▸ (Path and Bulldoze stay on top).
  const facilities = menu.locator("[data-testid=start-facilities]").first();
  if (!(await item.count()) && (await facilities.count())) {
    await press(facilities);
    await page.waitForTimeout(250);
    item = menu.getByRole("menuitem").filter({ hasText: name }).first();
  }
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
      const modal = el.matches("[aria-modal=true], [role=alertdialog]") || !!el.querySelector("[aria-modal=true]");
      return { label: el.getAttribute("aria-label") || title || el.className, title, coach, confirm, modal, empty: body.length < 2 && !media, box: { x: r.left, y: r.top, w: r.width, h: r.height } };
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
/** FLT-54: the middle 40% × 40% of the viewport is the campus; after Level 5 no window that is not a modal card may sit on it. */
const centre = () => ({ x: viewport.width * 0.3, y: viewport.height * 0.3, w: viewport.width * 0.4, h: viewport.height * 0.4 });
const OVERLAP_MS = 500; // how long the coach (or a confirm) may sit on a window before it is an overlap
const CARD_SPAN_DAYS = 5; // FLT-54: after Level 5, at most one card per this many game days

// ── the phone checks (FLT-61) ────────────────────────────────────────────────────────────────────────────────────────
/**
 * One sweep of the page for what makes a phone hard to play. Each issue has a stable key (the element, not where it
 * happens to be), so it is filed once. `campus` is the share of the screen the map shows through, when asked for.
 */
async function sweep(withCampus) {
  return page.evaluate(([WIN, TAP_MIN, TEXT_MIN, withCampus]) => {
    const vw = innerWidth, vh = innerHeight;
    const issues = [];
    const seen = (el) => el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
    const onScreen = (r) => r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh && r.width > 0 && r.height > 0;
    const inside = (r) => r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1;
    const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) || `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}">`;
    const where = (el) => {
      const win = el.closest(WIN);
      return win ? (win.getAttribute("aria-label") || win.querySelector(".f95-tb, .f95-title, h2, h3")?.textContent?.trim() || String(win.className).split(" ")[0]).slice(0, 40) : "the HUD";
    };
    const stable = (text) => text.replace(/[-−+$€]?[\d][\d.,]*\s*[%KMB×]?/g, "#").replace(/\b(rising|falling|steady)\b/g, "~"); // a live readout keeps its key
    const sig = (el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 2).join(".")}`;
    const scroller = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (/(auto|scroll)/.test(st.overflowY + st.overflowX) && (a.scrollHeight > a.clientHeight + 1 || a.scrollWidth > a.clientWidth + 1)) return a;
      }
      return null;
    };
    // Why a control is small (FLT-93): its own min-height, line and padding, and an ancestor that scales it, if one does.
    const why = (el) => {
      const cs = getComputedStyle(el);
      const scaled = [];
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (st.zoom !== "1" || st.scale !== "none" || /^matrix\((?!1, 0, 0, 1,)/.test(st.transform)) scaled.push(`${sig(a)} ${st.transform !== "none" ? st.transform : st.scale !== "none" ? `scale ${st.scale}` : `zoom ${st.zoom}`}`);
      }
      return ` (min-height ${cs.minHeight}, line ${cs.lineHeight}, padding ${cs.padding}, font ${cs.fontFamily.split(",")[0]}${scaled.length ? `; scaled by ${scaled.join(" < ")}` : ""})`;
    };
    // Anything tappable under TAP_MIN px (on screen, visible, not disabled).
    const TAPPABLE = "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=menuitem], [role=tab], [role=link], [role=checkbox], [role=switch], [role=option], [role=slider]";
    for (const el of document.querySelectorAll(TAPPABLE)) {
      if (el.disabled || el.closest("[inert], [aria-hidden=true]") || !seen(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // A control pushed past the edge of the screen (not one a scroll brings back, like a long menu's) can't be tapped.
      if (!inside(r) && !scroller(el) && !el.closest("[role=menu]")) {
        issues.push({ kind: "off-screen control", key: `${stable(where(el))}|${stable(name(el))}`, message: `"${name(el)}" in ${where(el)} is at ${Math.round(r.left)}…${Math.round(r.right)} × ${Math.round(r.top)}…${Math.round(r.bottom)}, ${onScreen(r) ? "partly" : "wholly"} off the ${vw}×${vh} screen` });
        if (!onScreen(r)) continue;
      }
      if (r.width >= TAP_MIN && r.height >= TAP_MIN) continue;
      issues.push({ kind: "small target", key: `${stable(where(el))}|${stable(name(el))}`, message: `"${name(el)}" in ${where(el)} is ${Math.round(r.width)}×${Math.round(r.height)} px${why(el)}` });
    }
    // Windows wider than the screen, or with the close button off it; a card whose buttons need a scroll.
    for (const win of document.querySelectorAll(WIN)) {
      if (win.parentElement?.closest(WIN) || !seen(win)) continue;
      const r = win.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const label = where(win);
      const coach = win.matches("[role=status][aria-label^='Assistant']");
      if (coach) {
        if (!inside(r)) issues.push({ kind: "coach off-screen", key: "coach", message: `The coach balloon is at ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}, past the ${vw}×${vh} screen` });
        continue;
      }
      if (r.left < -1 || r.right > vw + 1) issues.push({ kind: "wide window", key: label, message: `"${label}" spans x ${Math.round(r.left)}…${Math.round(r.right)} on a ${vw} px screen` });
      for (const close of win.querySelectorAll("[data-g=close], [aria-label^=Close i]")) {
        const c = close.getBoundingClientRect();
        if (seen(close) && !inside(c)) issues.push({ kind: "close off-screen", key: label, message: `The close button of "${label}" is at ${Math.round(c.left)},${Math.round(c.top)}, off the screen` });
      }
      for (const b of win.querySelectorAll("button, [role=button]")) {
        if (b.disabled || !seen(b) || b.matches("[data-g]")) continue;
        const br = b.getBoundingClientRect();
        if (br.width < 1 || br.height < 1) continue;
        const sc = scroller(b);
        const box = sc ? sc.getBoundingClientRect() : null;
        const hidden = !inside(br) || (box && (br.top < box.top - 1 || br.bottom > box.bottom + 1 || br.left < box.left - 1 || br.right > box.right + 1));
        if (hidden) issues.push({ kind: "scroll to reach", key: `${stable(label)}|${stable(name(b))}`, message: `"${name(b)}" in "${label}" is ${sc ? "scrolled out of its window" : "off the screen"} (${Math.round(br.left)},${Math.round(br.top)})` });
      }
    }
    // Text under TEXT_MIN px.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const small = new Map();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent.trim();
      const el = n.parentElement;
      if (!t || !el || el.closest("script, style, svg, canvas")) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (!(size < TEXT_MIN)) continue;
      const k = `${stable(where(el))}|${sig(el)}|${size}`;
      if (small.has(k) || !seen(el) || !onScreen(el.getBoundingClientRect())) continue;
      small.set(k, { kind: "small text", key: k, message: `${size} px text in ${where(el)} (${sig(el)}): "${t.slice(0, 40)}"` });
    }
    issues.push(...small.values());
    // Controls only hover reveals: a :hover rule (that applies on this screen) that shows something now hidden.
    const rules = [];
    const walk = (list) => {
      for (const rule of list) {
        if (rule.media && !matchMedia(rule.media.mediaText).matches) continue;
        if (rule.selectorText?.includes(":hover")) rules.push(rule);
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch { /* another origin's sheet */ } }
    for (const rule of rules) {
      const st = rule.style;
      const reveals = (st.display && st.display !== "none") || st.visibility === "visible" || (st.opacity && +st.opacity > 0.5) || (st.pointerEvents && st.pointerEvents !== "none");
      if (!reveals) continue;
      for (const sel of rule.selectorText.split(",").filter((x) => x.includes(":hover") && !x.includes(":not(:hover"))) {
        let els;
        try { els = [...document.querySelectorAll(sel.replace(/:hover/g, ""))]; } catch { continue; }
        const shut = els.find((el) => !seen(el) && (el.closest(WIN) || el.matches(TAPPABLE) || el.querySelector(TAPPABLE)) && el.parentElement && seen(el.parentElement));
        if (shut) issues.push({ kind: "hover only", key: sel.trim(), message: `"${sel.trim()}" only shows on hover (${name(shut)} in ${where(shut)})` });
      }
    }
    // ... or a React handler that only listens for the pointer coming over it (nothing to tap, focus or press).
    for (const el of document.body.querySelectorAll("*")) {
      const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
      const props = key && el[key];
      if (!props || !(props.onMouseEnter || props.onPointerEnter || props.onMouseOver || props.onPointerOver)) continue;
      if (props.onClick || props.onPointerDown || props.onMouseDown || props.onTouchStart || props.onFocus || !seen(el) || !onScreen(el.getBoundingClientRect())) continue;
      if (el.closest(TAPPABLE) || el.querySelector(TAPPABLE)) continue; // a menu row that opens on hover, around a button that opens on a tap
      issues.push({ kind: "hover only", key: `react|${where(el)}|${sig(el)}`, message: `${sig(el)} ("${name(el)}") in ${where(el)} reacts to the pointer coming over it, with nothing to tap` });
    }
    // The campus: the share of the screen where the map shows through.
    let campus = null;
    if (withCampus) {
      let hit = 0, all = 0;
      for (let y = 6; y < vh; y += 12) for (let x = 6; x < vw; x += 12) { all++; if (document.elementFromPoint(x, y)?.tagName === "CANVAS") hit++; }
      campus = hit / all;
    }
    return { issues, campus };
  }, [WIN, TAP_MIN, TEXT_MIN, withCampus]);
}
let lastSweep = 0;
let peeked = false; // the Inspector the policy opened at the coach's "peek", until it closes it
let peekTries = 0;
/** File what a sweep finds; the campus share is measured only with nothing but the HUD up (no card, menu, tool or window the policy opened). */
async function phoneChecks(p, force = false) {
  if (!phone || (!force && Date.now() - lastSweep < PHONE_CHECK_MS)) return;
  lastSweep = Date.now();
  // The probe reads the app's snapshot and the HUD the 5 Hz one, so a New! card just dismissed is still on screen for a beat (FLT-93).
  const calm = !peeked && !p.event && !p.pendingConfirm && !p.overlays.length && !p.unlockCard && !(await page.locator("[role=menu]:visible, .mode-done:visible, .f95-bsod-go:visible, .f95-unlock:visible, .unlock-card:visible").count());
  const t0 = Date.now();
  const { issues, campus } = await sweep(calm);
  const ms = Date.now() - t0;
  result.sweeps = { n: (result.sweeps?.n ?? 0) + 1, ms: (result.sweeps?.ms ?? 0) + ms, max: Math.max(result.sweeps?.max ?? 0, ms) };
  for (const i of issues) await fail(i.kind, i.message, p, `${i.kind}:${i.key}`);
  if (campus !== null) {
    result.campus.push({ gameDay: gameDays(p), level: p.progress.level, share: +campus.toFixed(3) });
    if (campus < CAMPUS_MIN) await fail("campus hidden", `The map shows through ${(campus * 100).toFixed(0)}% of the screen (under ${CAMPUS_MIN * 100}%) with nothing but the HUD up: ${(await windows()).map((w) => w.label).join(", ")}`, p, `campus:${p.progress.level}`);
  }
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────────────
let probe = null;
const outcome = { reached: false };
try {
  await page.goto(opened.href, { waitUntil: "networkidle", timeout: 120_000 });
  result.box = await throughTheBox(page, { tap: phone });
  if (!skin && result.box.door !== "box") throw new Error("A first visit to the bare root must open on the box");
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
  const centreSeen = new Set();
  const overlapSince = new Map();
  const retryAt = new Map(); // want key → game tick
  let reachedAt = null;
  let lastSample = 0;
  let flatKey = "", flatSince = Date.now();
  const slowSeen = new Set();

  for (;;) {
    const now = Date.now();
    probe = await probeNow();
    if (now - lastSample >= 5000) {
      lastSample = now;
      result.samples.push({ wallS: wallS(), gameDay: gameDays(probe), level: probe.progress.level, cash: probe.cash, runway: probe.runway, income: probe.income, net: probe.net, speed: probe.speed, paused: probe.paused, researchers: probe.researchers, vibes: Math.round(probe.vibes), models: probe.models, rank: probe.rank, buildings: probe.map.buildings.length, walkers: probe.walkers.length });
    }

    // ── checks ──
    if (errors.length) await fail("console error", errors.splice(0).join("; ").slice(0, 400), probe);
    if (appFailed.length) await fail("action failed", appFailed.splice(0).join("; ").slice(0, 400), probe);
    await phoneChecks(probe);
    if (probe.cash < CASH_FLOOR) await fail("cash floor", `Cash ${probe.cash} below ${CASH_FLOOR}`, probe);
    if (probe.outcome?.outcome === "lost" && !probe.outcome.dismissed) throw new Error(`The game was lost at game day ${gameDays(probe)} (level ${probe.progress.level})`);
    if (probe.tick !== lastTick) { lastTick = probe.tick; lastTickAt = now; }
    else if (now - lastTickAt > STALL_CAP) throw new Error(`Game time stood still for ${STALL_CAP / 60_000} minutes at game day ${gameDays(probe)} (level ${probe.progress.level}, overlays ${probe.overlays.join(",") || "none"}, event ${probe.event ?? "none"})`);
    const levelDays = (probe.tick - levelTick) / tpd;
    const maxDays = LEVEL_WINDOW[probe.progress.level + 1]?.[1];
    if (maxDays !== undefined && levelDays > maxDays && !slowSeen.has(probe.progress.level)) {
      slowSeen.add(probe.progress.level);
      await fail("slow level", `Level ${probe.progress.level} (${probe.progress.name}) took more than ${maxDays} game days; goal "${probe.progress.goal.text}" at ${probe.progress.goal.status ?? `${probe.progress.goal.current}/${probe.progress.goal.target}`}`, probe);
    }

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
    if (reachedAt !== null) {
      // FLT-54: at most two windows the game opened, and the campus centre clear of anything that is not a modal card.
      const auto = probe.windows?.auto ?? [];
      result.maxAuto = Math.max(result.maxAuto ?? 0, auto.length);
      if (auto.length > 2 && !centreSeen.has("budget")) { centreSeen.add("budget"); await fail("window budget", `${auto.length} windows the game opened are up at once: ${auto.join(", ")}`, probe); }
      for (const w of wins) {
        // On a phone every window spans the screen: the campus share (phoneChecks) stands in for the centre rule.
        if (phone || w.modal || w.coach || w.confirm || (staffLeftOpen && /staff/i.test(w.label)) || !overlap(w.box, centre()) || centreSeen.has(w.label)) continue;
        centreSeen.add(w.label);
        await fail("campus centre", `"${w.label}" covers the campus centre (${Math.round(w.box.x)},${Math.round(w.box.y)} ${Math.round(w.box.w)}×${Math.round(w.box.h)})`, probe);
      }
    }
    // An overlap counts once it lasts OVERLAP_MS: the coach looks for new windows ten times a second and steps aside, so
    // a window that just opened under it is a frame or two of catching up, not a covered window.
    const overlapping = new Set();
    for (const key of wins.filter((w) => w.coach || w.confirm)) {
      for (const other of wins) {
        if (other === key || other.coach || other.confirm) continue;
        const o = overlap(key.box, other.box);
        if (!o) continue;
        const pair = `${key.label}|${other.label}`;
        overlapping.add(pair);
        if (!overlapSince.has(pair)) overlapSince.set(pair, now);
        if (now - overlapSince.get(pair) >= OVERLAP_MS) await fail("overlap", `${key.coach ? "The coach" : "The confirm"} and "${other.label}" overlap by ${o.w.toFixed(0)}×${o.h.toFixed(0)} px ("${(await topAt(o.x, o.y)) ?? "the scene"}" on top)`, probe);
      }
    }
    for (const pair of overlapSince.keys()) if (!overlapping.has(pair)) overlapSince.delete(pair);

    // Flat moments: reported with a still, not failed (the player may simply be waiting on a model).
    const change = `${probe.progress.level}|${probe.map.buildings.length}|${probe.models}|${cardSeen.size}|${toastSeen.size}|${probe.event}|${probe.coachId}`;
    const counted = probe.speed === 1 || (probe.speed === 3 && !coachDone); // the coach's ▶▶ step asks for 3×
    if (change !== flatKey || !counted || probe.paused) { flatKey = change; flatSince = now; }
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
      // An era that turns with the level is a blue screen on purpose: keep it as the era's moment, and show the level past it.
      // It can draw a beat after the level (FLT-94 saw it land between this check and the still), so look again after.
      const bsodUp = page.locator(".f95-bsod-go:visible").first();
      let shot;
      for (let look = 0; look < 3; look++) {
        if (await bsodUp.count()) {
          await still(`${out}/moments/era-${level}-${gameDays(probe).toFixed(0)}.png`);
          await press(bsodUp);
          await page.waitForTimeout(600);
        }
        shot = await still(`${out}/levels/level-${level}.png`);
        if (!(await bsodUp.count())) break;
      }
      const [lo, hi] = LEVEL_WINDOW[level] ?? [0, Infinity];
      if (levelDays < lo || levelDays > hi) await fail(levelDays < lo ? "short level" : "slow level", `Level ${level - 1} → ${level} took ${levelDays.toFixed(1)} game days (window ${lo}–${hi})`, probe);
      const row = { level, name: probe.progress.name, gameDay: gameDays(probe), levelDays: +levelDays.toFixed(1), window: [lo, hi], wallS: wallS(), cash: probe.cash, runway: probe.runway, income: probe.income, toastsPerMinute, windows: (await windows()).map((w) => w.label), goal: probe.progress.goal.text, shot };
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
      await phoneChecks(probe, true);
      result.refused.push({ gameDay: gameDays(probe), kind: probe.pendingConfirm.kind, message: probe.pendingConfirm.message, went: coachStep });
      const button = coachStep ? dialog.getByRole("button", { name: /^(OK|Go ahead|Build anyway|Hire anyway)$/i }).first() : dialog.getByRole("button", { name: /^(Cancel|Keep the runway)$/i }).first();
      if (await button.count()) await press(button);
      else if (!phone) await page.keyboard.press("Escape");
      else await fail("dead end", `The ${probe.pendingConfirm.kind} confirm has no button to tap`, probe);
      await page.waitForTimeout(300);
      continue;
    }
    // FLT-76: a card can wait its turn behind a ship or a level-up (the moment queue); it is open in the sim but not on screen yet.
    if (probe.event && (probe.stage ?? []).some((k) => k === "card" || k === "era")) {
      await page.waitForTimeout(300);
      continue;
    }
    if (probe.event) {
      const dialog = page.locator("[role=dialog]:visible, [role=alertdialog]:visible").last();
      const choice = dialog.locator(".f95-choices button, button.choice, .choices button").first();
      if (!cardSeen.has(probe.event)) {
        cardSeen.add(probe.event);
        await phoneChecks(probe, true);
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
        if (!phone) await page.keyboard.press("Escape");
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
      // Follow the coach: its tile or button, ▶▶ at "speed", and the researcher it points at at "peek".
      if (now - lastCoachClick >= 600 && ["start", "path", "hall", "speed", "peek", "gateway"].includes(probe.coachId)) {
        if (probe.coachId === "peek") peeked = true;
        const tile = page.locator("[data-coach-tile]:visible").first();
        const active = page.locator("[data-coach-active]:visible").first();
        if (await tile.count()) await press(tile);
        else if (await active.count()) await press(active);
        lastCoachClick = Date.now();
      }
      // Close the mind-read the peek opened, once it has been read; try again if something landed on it (then give up, and let the campus check see it).
      if (peeked && probe.coachId !== "peek") {
        await page.waitForTimeout(peekTries ? 300 : 1500);
        if ((await closeInspector()) || ++peekTries >= 5) {
          if (peekTries >= 5) log("The peek's Inspector would not close");
          peeked = false;
          peekTries = 0;
        }
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
    // A phone pans with no tool in hand (one finger on a tool would build or paint), so it picks the tool per spot.
    if (phone && !(await zoomForTaps())) return false;
    if (!phone && !(await pickTool(NAMES[kind]))) return false;
    await page.waitForTimeout(250);
    const before = p.map.buildings.length;
    const size = SIZE[kind] ?? [2, 2];
    for (const [x, z] of options.slice(0, 6)) {
      const fresh = await probeNow();
      if (fresh.pendingConfirm || fresh.event) break;
      let at = await reveal(x, z, ...size);
      if (!at) continue;
      if (phone) {
        if (!(await pickTool(NAMES[kind]))) return false;
        await page.waitForTimeout(300);
        at = screenOf((await probeNow()).view, x, z, ...size);
        if (!at || !(await onCanvas(at))) { await putDown(); continue; }
        const [jx, jy] = JITTER[result.touch.taps % JITTER.length];
        at = [at[0] + jx, at[1] + jy];
      }
      await tapAt(at[0], at[1]);
      await page.waitForTimeout(500);
      const after = await probeNow();
      if (after.pendingConfirm) break; // the confirm is answered by the main loop
      if (after.map.buildings.length > before) {
        const built = after.map.buildings.find((b) => b.kind === kind && !p.map.buildings.some((o) => o.x === b.x && o.z === b.z));
        if (built && (built.x !== x || built.z !== z)) {
          result.touch.misplaced++;
          if (phone) await fail("precision", `A tap aimed at ${x},${z} built the ${NAMES[kind]} at ${built.x},${built.z} (tile ${result.touch.tile} px)`, after, `precision:misplaced:${kind}`);
        }
        result.purchases.push({ gameDay: gameDays(after), level: after.progress.level, kind, x, z, cash: after.cash });
        log(`Built ${NAMES[kind]} at ${x},${z} (game day ${gameDays(after)}, cash ${(after.cash / 1e6).toFixed(2)}M)`);
        break;
      }
      if (phone) await putDown();
    }
    await putDown();
    const done = (await probeNow()).map.buildings.length > before;
    return done;
  }
  /** Lay the next n tiles of the planned roads, in order, so the road stays in one piece. */
  async function layRoad(p, n) {
    const g = grid(p);
    const todo = ROADS.filter(([x, z]) => !g.isPath(x, z) && !g.taken(x, z)).slice(0, n);
    if (!todo.length) return;
    if (phone && !(await zoomForTaps())) return;
    if (!(await pickTool("Path"))) return;
    await page.waitForTimeout(250);
    let laid = 0;
    let why = "";
    for (const [x, z] of todo) {
      let at;
      if (phone) {
        // One finger paints with the Path tool in hand: put it down to pan, then pick it up again.
        at = screenOf((await probeNow()).view, x, z);
        if (!at || !(await onCanvas(at))) {
          await putDown();
          at = await reveal(x, z);
          if (!at) { why = "could not pan it into view"; break; }
          if (!(await pickTool("Path"))) { why = "no Path tool"; break; }
          await page.waitForTimeout(250);
          at = screenOf((await probeNow()).view, x, z);
          if (!at || !(await onCanvas(at))) { why = `covered with the tool in hand (${at ? await topAt(...at) ?? (await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className, at)) : "off the map"})`; break; }
        }
      } else at = await reveal(x, z);
      if (!at) { why ||= "could not bring it into view"; break; }
      const before = (await probeNow()).map.paths.length;
      await tapAt(at[0], at[1]);
      await page.waitForTimeout(250);
      if ((await probeNow()).map.paths.length <= before) { why = `the tap at ${at.map(Math.round).join(",")} laid nothing`; break; }
      laid++;
    }
    await putDown();
    if (laid) log(`Laid ${laid} path tiles`);
    else log(`Could not lay the road at ${todo[0].join(",")}: ${why}`);
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

  // FLT-54: after Level 5, at most one card per CARD_SPAN_DAYS game days (half a day of slack for how often we look).
  if (reachedAt !== null) {
    const from = gameDays({ tick: reachedAt });
    const late = result.cards.filter((c) => c.gameDay >= from);
    const tight = late.slice(1).map((c, i) => [late[i], c]).filter(([a, b]) => b.gameDay - a.gameDay < CARD_SPAN_DAYS - 0.5);
    result.afterLevel5 = { days: +(gameDays(probe) - from).toFixed(1), cards: late.length, tightestGap: late.length > 1 ? Math.min(...late.slice(1).map((c, i) => +(c.gameDay - late[i].gameDay).toFixed(1))) : null, maxAuto: result.maxAuto ?? 0 };
    for (const [a, b] of tight) await fail("card pace", `Cards ${a.id} (day ${a.gameDay}) and ${b.id} (day ${b.gameDay}) are under ${CARD_SPAN_DAYS} game days apart`, null);
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
  const rows = r.levels.map((l) => `| ${l.level} ${l.name} | ${l.gameDay} | ${l.levelDays ?? "–"}${l.window ? ` (${l.window[0]}–${l.window[1]})` : ""} | ${(l.wallS / 60).toFixed(1)} min | ${money(l.cash)} | ${l.runway === null || l.runway === undefined ? "∞" : `${l.runway.toFixed(1)} mo`} | ${l.toastsPerMinute} | ${l.windows.join("; ").slice(0, 120)} |`);
  const kinds = Object.entries(r.failures.reduce((m, f) => ({ ...m, [f.kind]: (m[f.kind] ?? 0) + 1 }), {})).map(([k, n]) => `${k} ×${n}`).join(", ");
  const shares = (r.campus ?? []).map((c) => c.share).sort((a, b) => a - b);
  const pct = (x) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);
  const touchLine = r.phone ? `\nPhone, touch only: ${r.touch.taps} map taps, ${r.touch.drags} drags, ${r.touch.pinches} pinches, ${r.clicks.ok + r.clicks.forced} control taps; a map tile ${r.touch.tile ?? "?"} px when building; ${r.touch.misplaced} misplaced buildings. Campus share of the screen (HUD only): min ${pct(shares[0])}, median ${pct(shares[Math.floor(shares.length / 2)])} over ${shares.length} looks. ${r.sweeps?.n ?? 0} sweeps, ${r.sweeps ? Math.round(r.sweeps.ms / r.sweeps.n) : "–"} ms each (max ${r.sweeps?.max ?? "–"}).\n` : "";
  return `# Journey test${r.phone ? " (phone)" : ""}: Level 1 → 5

${r.passed ? "**Passed**" : "**Failed**"}. Level 5 ${r.reachedLevel5 ? "reached" : "**not** reached"}. ${r.url}, ${r.viewport.width}×${r.viewport.height}, ${r.timing?.wallS ?? "?"} s wall, ${r.timing?.fps ?? "?"} fps.
${r.error ? `\nStopped: ${r.error}\n` : ""}${touchLine}
| Level | Game day | Days on the last level (window) | Wall | Cash | Runway | Toasts/min (last level) | Open windows |
|---|---:|---:|---:|---:|---:|---:|---|
${rows.join("\n")}

Final: ${JSON.stringify(r.final)}

## Failures (${r.failures.length}${kinds ? `: ${kinds}` : ""})
${r.failures.map((f) => `- **${f.kind}** (level ${f.level ?? "?"}, game day ${f.gameDay ?? "?"}): ${f.message}${f.shot ? ` ([shot](${f.shot.split("/").slice(-2).join("/")}))` : ""}`).join("\n") || "none"}

${r.afterLevel5 ? `After Level 5: ${r.afterLevel5.days} game days, ${r.afterLevel5.cards} cards (tightest gap ${r.afterLevel5.tightestGap ?? "n/a"} days), at most ${r.afterLevel5.maxAuto} windows the game opened at once.\n` : ""}
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
