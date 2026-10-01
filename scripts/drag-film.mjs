#!/usr/bin/env node
// FLT-90 evidence: drag Frontier 95's windows by their title bars in a real (headless) browser, and check what the
// player would: the outline follows the pointer and the window jumps to it on release; the column closes up behind it;
// a title-bar button still clicks and a drag is not a click; Esc cancels; the place survives a reload; a smaller screen
// pulls the window back in; Start ▸ Settings ▸ Reset window positions puts everything back; a phone does not drag.
// Writes a filmstrip and the frames to --out, and exits 1 if a check fails.
//
//   pnpm dev &   node scripts/drag-film.mjs --url http://localhost:5173 --out docs/img/flt-90/drag
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const base = arg("url", "http://localhost:5173");
const out = arg("out", "shots/flt-90");
mkdirSync(out, { recursive: true });
const query = "?debug=1&seed=3&speed=0&hour=13&warp=12";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const failures = [];
const lines = [];
const check = (ok, what) => {
  lines.push(`${ok ? "ok  " : "FAIL"} ${what}`);
  console.log(lines.at(-1));
  if (!ok) failures.push(what);
};
const frames = [];
const errors = [];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const rect = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
const shot = async (name, caption) => {
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  frames.push({ path, caption });
};
const settle = () => page.waitForTimeout(400);

await page.goto(base + query, { waitUntil: "networkidle" });
await page.waitForTimeout(6000);
await page.evaluate(() => localStorage.removeItem("flt.windows.frontier-95"));

const LAB = "section.f95-lab";
const TASKS = "section.f95-tasks";
const THOUGHTS = "section.f95-thoughts";
const lab0 = await rect(LAB);
await shot("1-before", "1. Lab Properties where the game puts it");

// Grab the title bar (on the title text, away from the buttons) and drag it toward the middle of the campus.
const grab = { x: lab0.x + 200, y: lab0.y + 14 };
await page.mouse.move(grab.x, grab.y);
await page.mouse.down();
await page.mouse.move(grab.x + 120, grab.y + 90, { steps: 6 });
await page.mouse.move(grab.x + 260, grab.y + 200, { steps: 6 });
check((await page.$(".f95-ghost")) !== null, "an outline appears while dragging");
check((await rect(LAB)).x === lab0.x, "the window itself stays put until the button comes up (outline drag)");
await shot("2-dragging", "2. Dragging: only the dotted outline moves");
await page.mouse.move(grab.x + 380, grab.y + 300, { steps: 6 });
await shot("3-dragging", "3. Still dragging");
await page.mouse.up();
await settle();
const lab1 = await rect(LAB);
check(Math.abs(lab1.x - (lab0.x + 380)) <= 1 && Math.abs(lab1.y - (lab0.y + 300)) <= 1, `the window lands where the outline was (${lab1.x},${lab1.y})`);
check((await page.$(".f95-ghost")) === null, "the outline is gone after the drop");
check(lab1.w === lab0.w, "it keeps its width");
const goal = await rect(".f95-left > :nth-child(2)");
check(goal.y < lab0.y + 40, "the left column closes up behind the moved window");
await shot("4-dropped", "4. Let go: the window jumps there, and the column closes up");

// Task Mangler toggles on a title-bar click: a drag must not toggle it, and its window must not fold.
const tasks0 = await rect(TASKS);
const openBefore = await page.$eval(TASKS, (e) => e.classList.contains("open"));
await page.mouse.move(tasks0.x + 120, tasks0.y + 14);
await page.mouse.down();
await page.mouse.move(tasks0.x + 60, tasks0.y + 514, { steps: 10 });
await page.mouse.up();
await settle();
const tasks1 = await rect(TASKS);
check(Math.abs(tasks1.x - (tasks0.x - 60)) <= 1 && Math.abs(tasks1.y - (tasks0.y + 500)) <= 1, `Task Mangler moves down (${tasks1.x},${tasks1.y})`);
check((await page.$eval(TASKS, (e) => e.classList.contains("open"))) === openBefore, "a drag is not a click: Task Mangler did not fold");
const z = (sel) => page.$eval(sel, (e) => Number(getComputedStyle(e).zIndex) || 0);
check((await z(TASKS)) > (await z(LAB)), "the window dragged last is in front");
await page.mouse.click(lab1.x + 40, lab1.y + 100);
await settle();
check((await z(LAB)) > (await z(TASKS)), "clicking a window brings it to the front");

// A title-bar button still clicks on a moved window.
const thoughts0 = await rect(THOUGHTS);
await page.mouse.move(thoughts0.x + 100, thoughts0.y + 14);
await page.mouse.down();
await page.mouse.move(thoughts0.x - 500, thoughts0.y + 140, { steps: 8 });
await page.mouse.up();
await settle();
await page.click(`${THOUGHTS} .f95-b[data-g=min]`);
await settle();
check(!(await page.$eval(THOUGHTS, (e) => e.classList.contains("open"))), "the minimize button on a moved window still minimizes it");
await page.click(`${THOUGHTS} .f95-b[data-g=min]`);
await settle();
await shot("5-arranged", "5. Three windows put somewhere else");

// Esc cancels a drag.
const before = await rect(LAB);
await page.mouse.move(before.x + 200, before.y + 14);
await page.mouse.down();
await page.mouse.move(before.x + 100, before.y + 300, { steps: 6 });
await page.keyboard.press("Escape");
await page.mouse.up();
await settle();
const after = await rect(LAB);
check(after.x === before.x && after.y === before.y, "Esc cancels the drag: the window stays where it was");

// Dragging it off the top or past the edge keeps the title bar reachable.
await page.mouse.move(after.x + 200, after.y + 14);
await page.mouse.down();
await page.mouse.move(after.x + 200 + 2000, after.y - 600, { steps: 8 });
await page.mouse.up();
await settle();
const flung = await rect(LAB);
check(flung.y === 0 && flung.x <= 1440 - 64 && flung.x >= 1440 - 64 - 1, `flung off the top right, its title bar stays on screen (${flung.x},${flung.y})`);
await page.mouse.move(flung.x + 30, flung.y + 14);
await page.mouse.down();
await page.mouse.move(lab1.x + 30, lab1.y + 14, { steps: 8 });
await page.mouse.up();
await settle();

// A reload remembers.
const placed = { lab: await rect(LAB), tasks: await rect(TASKS) };
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(6000);
const back = { lab: await rect(LAB), tasks: await rect(TASKS) };
check(back.lab.x === placed.lab.x && back.lab.y === placed.lab.y, "Lab Properties is where it was after a reload");
check(back.tasks.x === placed.tasks.x && back.tasks.y === placed.tasks.y, "Task Mangler is where it was after a reload");
await shot("6-reloaded", "6. Reload: every window is where you left it");

// A smaller screen pulls them back in, and a bigger one gives them their places back.
await page.setViewportSize({ width: 900, height: 600 });
await settle();
const small = await rect(TASKS);
check(placed.tasks.x > 900 - 64 && small.x === 900 - 64 && small.y <= 600 - 42 - 26, `on a 900×600 screen Task Mangler is pulled back in (${placed.tasks.x},${placed.tasks.y} → ${small.x},${small.y})`);
await page.screenshot({ path: `${out}/6b-small-screen.png` });
await page.setViewportSize({ width: 1440, height: 900 });
await settle();
const big = await rect(TASKS);
check(big.x === placed.tasks.x && big.y === placed.tasks.y, "back on the big screen it is where it was put");

// Start ▸ Settings ▸ Reset window positions.
await page.click("[data-testid=start-button]");
await page.click("[data-fly=settings] > button");
await settle();
check(!(await page.$eval("[data-testid=start-reset-windows]", (e) => e.disabled)), "Reset window positions is enabled once something has moved");
await shot("7-reset-menu", "7. Start ▸ Settings ▸ Reset window positions");
await page.click("[data-testid=start-reset-windows]");
await settle();
const reset = { lab: await rect(LAB), tasks: await rect(TASKS) };
check(reset.lab.x === lab0.x && reset.lab.y === lab0.y, "after Reset, Lab Properties is back where the game puts it");
check(reset.tasks.x === tasks0.x && reset.tasks.y === tasks0.y, "after Reset, Task Mangler is back in the column");
check((await page.evaluate(() => localStorage.getItem("flt.windows.frontier-95"))) === null, "Reset forgets the saved positions");
await shot("8-after-reset", "8. Reset: back where the game puts them");
await page.click("[data-testid=start-button]");
await page.click("[data-fly=settings] > button");
await settle();
check(await page.$eval("[data-testid=start-reset-windows]", (e) => e.disabled), "with nothing moved, Reset is greyed out");
await page.keyboard.press("Escape");

// A message box drags too (Run… an unknown program), but is not remembered: the next one opens in the middle.
await page.click("[data-testid=start-button]");
await page.click("[data-testid=start-run]");
await page.fill("[data-testid=run-input]", "agi.exe");
await page.keyboard.press("Enter");
await page.waitForSelector("section.f95-errbox", { timeout: 10_000 });
await settle();
const card0 = await rect("section.f95-errbox");
await page.mouse.move(card0.x + 60, card0.y + 14);
await page.mouse.down();
await page.mouse.move(card0.x - 300, card0.y + 200, { steps: 8 });
await page.mouse.up();
await settle();
const card1 = await rect("section.f95-errbox");
check(Math.abs(card1.x - (card0.x - 360)) <= 1 && Math.abs(card1.y - (card0.y + 186)) <= 1, `an error box drags out of the way (${card0.x},${card0.y} → ${card1.x},${card1.y})`);
check((await page.$("section.f95-errbox")) !== null, "letting go over the backdrop does not dismiss it");
check((await page.evaluate(() => localStorage.getItem("flt.windows.frontier-95"))) === null, "a message box's place is not saved");
await shot("8b-errbox", "An error box dragged aside");
await ctx.close();

// A phone: the title bar does not drag, saved desktop positions are not applied, and the Reset item is not offered.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await phone.addInitScript(() => localStorage.setItem("flt.windows.frontier-95", JSON.stringify({ "f95-lab": { x: 300, y: 400, w: 600 }, arena: { x: 10, y: 300, w: 400 } })));
const pp = await phone.newPage();
pp.on("pageerror", (e) => errors.push(String(e)));
await pp.goto(base + query, { waitUntil: "networkidle" });
await pp.waitForTimeout(6000);
check((await pp.$$("section.f95-win.drag")).length === 0, "on a phone no window is draggable");
check((await pp.$$("section.f95-win.moved")).length === 0, "on a phone saved desktop positions are not applied");
await pp.screenshot({ path: `${out}/9-phone.png` });
await phone.close();
await browser.close();

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);

// The filmstrip: the frames side by side with their captions, drawn by the same browser.
const strip = frames.slice(0, 4);
const b2 = await chromium.launch();
const sp = await b2.newPage({ viewport: { width: 1440, height: 900 } });
const img = (f) => `data:image/png;base64,${readFileSync(f.path).toString("base64")}`;
await sp.setContent(`<body style="margin:0;background:#008080;font:bold 22px sans-serif;color:#fff">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px">
  ${strip.map((f) => `<figure style="margin:0"><img src="${img(f)}" style="width:100%;display:block;border:2px solid #000"><figcaption style="padding:6px 2px">${f.caption}</figcaption></figure>`).join("")}
  </div></body>`);
const h = await sp.evaluate(() => document.body.scrollHeight);
await sp.setViewportSize({ width: 1440, height: h });
await sp.screenshot({ path: `${out}/filmstrip.png` });
await b2.close();
writeFileSync(`${out}/checks.txt`, `${lines.join("\n")}\n\n${failures.length ? `${failures.length} check(s) failed` : "all checks passed"}\n`);
console.log(`\nwrote ${resolve(out)}/filmstrip.png and ${frames.length + 1} frames`);
console.log(failures.length ? `${failures.length} check(s) failed` : "all checks passed");
process.exit(failures.length ? 1 : 0);
