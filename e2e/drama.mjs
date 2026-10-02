import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

// FLT-78: Today's Drama on a phone, added to the lab on screen. Play five days, open Today's Drama, "Add to my lab":
// no reload, the same day and cash, a headline on the ticker, "In your lab ✓"; the pack's card turns up within a few
// days; save to a slot, reload, open it, and the pack is still in the lab. Run it against a local build
// (`pnpm build && pnpm preview --port 4173`):
//   pnpm e2e:drama --url http://localhost:4173/
const at = process.argv.indexOf("--url");
if (at < 0 || !process.argv[at + 1]) throw new Error("Usage: pnpm e2e:drama --url <preview URL>");
const url = new URL(process.argv[at + 1]);
url.searchParams.set("drama", "fixture"); // the fixture feed: the same packs on every run
const out = process.env.FLT_E2E_OUT ?? "e2e/results/drama";
await mkdir(out, { recursive: true });

const DAYS = 5;
const ARRIVE_WITHIN = 8; // game days from the add to the card (ARRIVE_DAYS is 2; the card budget may add a few)
const PACK = "drama-2026-09-29";
const CARD = "drama-2026-09-29-perks";
const PLAY_CAP = 6 * 60_000;
const viewport = { width: 390, height: 844 };
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
let navigations = 0;
page.on("framenavigated", (f) => { if (f === page.mainFrame()) navigations++; });
const result = { url: url.href, viewport, steps: [] };
const step = (name, data = {}) => {
  result.steps.push({ name, ...data });
  console.log(`✓ ${name}${Object.keys(data).length ? ` ${JSON.stringify(data)}` : ""}`);
};

const probe = () => page.evaluate(() => window.__fltProbe());
const ready = async () => {
  await page.waitForFunction(() => typeof window.__fltProbe === "function", { timeout: 120_000 });
  return probe();
};
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const speed = (name) => page.locator("[role=group][aria-label='Game speed']").getByRole("button", { name }).first();
const checkErrors = () => { if (errors.length) throw new Error(`Console errors: ${errors.join("; ")}`); };

/** Answer whatever is in the way (a card with its first choice, a confirm, a New! card); true if something was. */
async function clearWay(p) {
  if (p.pendingConfirm) {
    await page.locator("[aria-modal=true]:visible").getByRole("button", { name: /^(Cancel|Keep the runway)$/i }).first().click({ timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
    return true;
  }
  if (p.event) {
    const choice = page.locator(".f95-choices button:visible, button.choice:visible, .choices button:visible").first();
    if (await choice.count()) await choice.click({ timeout: 5000 }).catch(() => undefined);
    else await page.locator("[aria-modal=true]:visible").last().locator("button").first().click({ timeout: 5000 }).catch(() => undefined);
    return true;
  }
  if (p.unlockCard) {
    await page.keyboard.press("Escape");
    return true;
  }
  return false;
}

async function pause() {
  for (let i = 0; i < 10 && !(await probe()).paused; i++) {
    await speed("Pause").click({ timeout: 5000 }).catch(() => page.keyboard.press(" "));
    await page.waitForTimeout(300);
  }
  if (!(await probe()).paused) throw new Error("Couldn't pause the game");
}

try {
  await page.goto(url.href, { waitUntil: "networkidle", timeout: 120_000 });
  const first = await ready();
  step("a fresh lab", { day: first.day, cash: first.cash, coach: first.coachId });

  // ── the coach's first step holds the clock until Start is pressed: press it, as a player does ──
  if (first.coachId) {
    await page.locator("[data-coach-active]:visible").first().click({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape"); // the build panel Start opened
  }

  // ── play five game days at 10×, answering anything that comes up ──
  const started = Date.now();
  for (;;) {
    const p = await probe();
    checkErrors();
    if (p.day >= first.day + DAYS && !p.event && !p.pendingConfirm) break;
    if (Date.now() - started > PLAY_CAP) throw new Error(`Only reached day ${p.day} in ${PLAY_CAP / 60_000} minutes`);
    if (!(await clearWay(p)) && p.speed !== 10) await speed("10× speed").click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await pause();
  const before = await probe();
  step(`played ${before.day - first.day} game days, paused`, { day: before.day, cash: before.cash, tick: before.tick });
  if (before.modsAdded.length) throw new Error("No mod should be in the lab yet");

  // ── Today's Drama → Add to my lab ──
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.getByRole("button", { name: /Today's Drama/ }).first().click({ timeout: 10_000 });
  const add = page.getByRole("button", { name: "Add to my lab" }).first();
  await add.waitFor({ timeout: 30_000 });
  await page.getByText("Arrives in your lab right now. No restart. Probably fine.").first().waitFor({ timeout: 5000 });
  await shot("1-drama-window");
  step("opened Today's Drama: Add to my lab");
  const navBefore = navigations;
  await add.click();
  await page.getByText("In your lab ✓").first().waitFor({ timeout: 30_000 });
  await page.waitForFunction((id) => window.__fltProbe().modsAdded.some((m) => m.id === id), PACK, { timeout: 30_000 });
  await shot("2-in-your-lab");
  const added = await probe();
  if (navigations !== navBefore || !(await page.evaluate(() => window.__sameDocument === true))) throw new Error("Adding the pack reloaded the page");
  if (new URL(page.url()).searchParams.has("mod")) throw new Error("Adding the pack put a ?mod= on the address");
  if (added.day !== before.day || added.cash !== before.cash) throw new Error(`The lab changed: day ${before.day}→${added.day}, cash ${before.cash}→${added.cash}`);
  if (!added.mods.includes(PACK)) throw new Error(`The session should list ${PACK}: ${added.mods.join(", ")}`);
  const flash = added.news.find((t) => t.startsWith("📼 Just in: today's Drama"));
  if (!flash) throw new Error(`No news flash on the ticker: ${added.news.slice(-4).join(" | ")}`);
  const headline = added.news.find((t) => /private moon|nap pods|handwritten letter/.test(t));
  if (!headline) throw new Error("None of the pack's headlines reached the ticker");
  if (!added.toasts.some((t) => t.text === "📼 Today's Drama added")) throw new Error(`No "Today's Drama added" toast: ${added.toasts.map((t) => t.text).join(" | ")}`);
  step("added with no reload: same day and cash, a headline on the ticker", { day: added.day, cash: added.cash, tick: added.tick, flash, headline });

  // ── the card turns up within a few days ──
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close" }).first().click({ timeout: 2000 }).catch(() => undefined);
  const addedDay = added.day;
  let arrived = null;
  const resumed = Date.now();
  for (;;) {
    const p = await probe();
    checkErrors();
    if (p.event === CARD) { arrived = p.day; break; }
    if (p.day > addedDay + ARRIVE_WITHIN) break;
    if (Date.now() - resumed > PLAY_CAP) throw new Error(`Only reached day ${p.day} waiting for the card`);
    if (!(await clearWay(p)) && p.speed !== 3) await speed("3× speed").click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  if (arrived === null) throw new Error(`The pack's card didn't turn up within ${ARRIVE_WITHIN} days of day ${addedDay}`);
  await shot("3-the-card");
  step(`the card turned up ${arrived - addedDay} days after the add`, { day: arrived });
  await clearWay(await probe());
  await page.waitForFunction(() => !window.__fltProbe().event, null, { timeout: 10_000 });
  await pause();

  // ── save to a slot, reload, open it: the pack is still in the lab ──
  const saved = await probe();
  await page.keyboard.press("Control+s");
  const dialog = page.getByRole("dialog", { name: "Save / Load" });
  await dialog.waitFor({ timeout: 10_000 });
  await dialog.getByRole("button", { name: "Save", exact: true }).click({ timeout: 5000 });
  await dialog.locator("[role=option]:not(.empty)").nth(1).waitFor({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k === "flt.save.1" && !!localStorage.getItem(k)), null, { timeout: 10_000 });
  step("saved to slot 1", { day: saved.day, cash: saved.cash });

  const back = new URL(url.href);
  back.searchParams.set("load", "1");
  await page.goto(back.href, { waitUntil: "networkidle", timeout: 120_000 });
  await ready();
  await page.waitForFunction(([day, id]) => { const p = window.__fltProbe(); return p.day === day && p.modsAdded.some((m) => m.id === id) && p.mods.includes(id); }, [saved.day, PACK], { timeout: 60_000 });
  const loaded = await probe();
  await page.getByRole("button", { name: /Today's Drama/ }).first().click({ timeout: 10_000 });
  await page.getByText("In your lab ✓").first().waitFor({ timeout: 30_000 });
  await shot("4-after-reload");
  if (new URL(page.url()).searchParams.has("mod")) throw new Error("The load put a ?mod= on the address");
  step("reloaded: the pack is still in the lab", { day: loaded.day, cash: loaded.cash, mods: loaded.mods, modsAdded: loaded.modsAdded });
  checkErrors();
  result.ok = true;
} catch (error) {
  result.ok = false;
  result.error = String(error?.message ?? error);
  await shot("failure").catch(() => undefined);
  console.error(`✗ ${result.error}`);
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
process.exit(result.ok ? 0 : 1);
