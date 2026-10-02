// FLT-67, cloud saves in a browser: a flag-on build behind the prod Worker (D1, R2, Hugging Face faked), played as a
// stranger would. Log On from the Start menu (huggingface.co is routed straight back to the Worker's callback), play a
// little, save to a slot; clear this computer's storage, come back to the bare root, and continue from the cloud. Then
// a second computer comes in through the box intro, logs on, and finds the lab in "Welcome back". Screenshots of the
// cloud slots and both Continues go to --out.
//
//   VITE_FLT_AUTH=on pnpm exec vite build --outDir dist-accounts --emptyOutDir
//   node worker/dev.ts --port 8787 &
//   node e2e/accounts.mjs [--url http://localhost:8787] [--out docs/img/flt-67]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { throughTheBox } from "./box.mjs";

const { values: args } = parseArgs({ options: { url: { type: "string", default: "http://localhost:8787" }, out: { type: "string", default: "shots/accounts" } } });
const base = args.url.replace(/\/$/, "");
await mkdir(args.out, { recursive: true });

const WAIT = 120_000;
const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s] ${s}`);
const fail = (s) => {
  console.error(`FAIL: ${s}`);
  process.exitCode = 1;
  throw new Error(s);
};

let last = null;
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });

async function computer(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL: base });
  // Hugging Face's consent page, answered "yes" at once: back to the Worker's callback, with the code its fake accepts.
  await context.route("https://huggingface.co/**", (route) => {
    const state = new URL(route.request().url()).searchParams.get("state");
    return route.fulfill({ status: 302, headers: { location: `${base}/api/auth/callback/huggingface?code=good-code&state=${state}` } });
  });
  const page = await context.newPage();
  last = page;
  if (process.env.DEBUG_ACCOUNTS) {
    page.on("request", (r) => r.url().includes("/api/") && log(`${name}: → ${r.method()} ${new URL(r.url()).pathname}`));
    page.on("response", (r) => r.url().includes("/api/") && log(`${name}: ← ${r.status()} ${new URL(r.url()).pathname}`));
    page.on("console", (m) => log(`${name}: console ${m.text().slice(0, 160)}`));
  }
  page.on("pageerror", (e) => log(`${name}: page error: ${e.message}`));
  return { context, page };
}

const probe = (page) => page.evaluate(() => window.__fltProbe());
const shot = async (page, file) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(args.out, file) });
  log(`screenshot ${join(args.out, file)}`);
};

async function logOn(page) {
  await page.getByTestId("start-button").click();
  const item = page.getByTestId("start-account");
  await item.waitFor({ timeout: WAIT });
  if (!(await item.textContent()).includes("Log On")) fail(`the Start menu says "${await item.textContent()}"`);
  await item.click();
  // Back from Hugging Face, the account asks who this is again.
  const back = page.waitForResponse((r) => r.url().includes("/api/auth/get-session") && r.request().frame() === page.mainFrame(), { timeout: WAIT });
  await page.locator(".f95-logon").getByRole("button", { name: "Log On", exact: true }).click();
  await back;
  await page.waitForFunction(() => typeof window.__fltProbe === "function", null, { timeout: WAIT });
  log(`logged on, back at ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
  // The Frontier Network window says hello, unless a cloud lab is on offer (which closes it): OK.
  const hello = page.locator(".f95-logon").getByRole("button", { name: "OK", exact: true });
  const offer = page.getByRole("button", { name: "☁ Continue from the cloud" }).first();
  await Promise.race([hello.waitFor({ timeout: WAIT }), offer.waitFor({ timeout: WAIT })]);
  await page.waitForTimeout(500);
  if (await hello.isVisible()) await hello.click({ timeout: 5_000 }).catch(() => {});
}

/** Save As / Open (Ctrl+S), once the HUD is up to hear it. */
async function openSaves(page) {
  await page.getByTestId("start-button").waitFor({ timeout: WAIT });
  const win = page.locator(".f95-saves");
  for (let i = 0; i < 5; i++) {
    if (await win.isVisible()) return;
    await page.keyboard.press("Control+s");
    await win.waitFor({ timeout: 5_000 }).catch(() => {});
  }
  await win.waitFor({ timeout: WAIT });
}

/** The slot rows in the Frontier Network drive. */
async function cloudRows(page) {
  await openSaves(page);
  await page.locator("[data-testid=cloud-saves]").waitFor({ timeout: WAIT });
  return page.locator("[data-testid=cloud-saves] [role=option]");
}

const title = (page) => page.locator(".f95-lab .f95-tt").first();
const labOnScreen = async (page) => ((await title(page).textContent()) ?? "").replace(/\s*—\s*Lab Properties.*$/, "").trim();
const welcomedBack = (page, lab) => page.waitForFunction((lab) => window.__fltProbe().toasts.some((t) => t.text.includes(`Welcome back to ${lab}`)), lab, { timeout: WAIT });

try {
  // ---- Computer B, a guest: through the box, and a lab saved to slot 2 on this computer only. ----
  const b = await computer("B");
  await b.page.goto("/");
  const boxed = await throughTheBox(b.page, { skip: true, log });
  if (boxed.door !== "box") fail("a stranger's first visit didn't open on the box");
  await openSaves(b.page);
  await b.page.locator(".f95-saves .f95-saverow", { hasText: "2" }).first().click().catch(() => {});
  await b.page.locator(".f95-saves").getByRole("button", { name: "Save", exact: true }).click();
  await b.page.waitForFunction(() => Object.keys(localStorage).some((k) => /^flt\.save\.[123]$/.test(k)), null, { timeout: WAIT });
  await b.page.keyboard.press("Escape");
  const garage = await labOnScreen(b.page);
  log(`B: a guest's garage, "${garage}", saved on this computer`);

  // ---- Computer A: the box, Log On, then another lab (seed 4242) saved to slot 1, which goes up. ----
  const a = await computer("A");
  await a.page.goto("/");
  log(`A: ${JSON.stringify(await throughTheBox(a.page, { skip: true, log }))}`);
  await logOn(a.page);
  await a.page.goto("/?seed=4242");
  await a.page.waitForFunction(() => typeof window.__fltProbe === "function", null, { timeout: WAIT });
  await openSaves(a.page);
  await a.page.locator(".f95-saves").getByRole("button", { name: "Save", exact: true }).click();
  await a.page.waitForFunction(() => localStorage.getItem("flt.save.1") !== null, null, { timeout: WAIT });
  const saved = await a.page.evaluate(() => JSON.parse(localStorage.getItem("flt.save.1")));
  if (saved.lab === garage) fail(`seed 4242 made the same lab as today's, "${garage}"`);
  log(`A: saved "${saved.lab}" (seed ${saved.seed}, day ${saved.day}) to slot 1`);
  await cloudRows(a.page);
  await a.page.locator("[data-testid=cloud-saves] [role=option]", { hasText: saved.lab }).waitFor({ timeout: WAIT });
  const rows = await a.page.locator("[data-testid=cloud-saves] [role=option]").allTextContents();
  log(`A: the Frontier Network has ${rows.length} saves: ${rows.join(" | ")}`);
  await shot(a.page, "cloud-slots.png");

  // ---- A, storage cleared: the bare root sends a logged-on player to the game (not the box), which offers the lab. ----
  await a.page.evaluate(() => localStorage.clear());
  await a.page.goto("/");
  const door = await throughTheBox(a.page, { skip: true, log });
  if (door.door !== "game") fail("a logged-on player with no local saves was sent to the box");
  log(`A, storage cleared: came in by the ${door.door} door, on "${await labOnScreen(a.page)}"`);
  const alone = a.page.locator("[role=dialog][aria-label='Welcome back']");
  await alone.waitFor({ timeout: WAIT });
  log("A: Welcome back offers the cloud's lab");
  await shot(a.page, "cloud-continue-alone.png");
  await alone.getByRole("button", { name: "☁ Continue from the cloud" }).click();
  await welcomedBack(a.page, saved.lab);
  if ((await labOnScreen(a.page)) !== saved.lab) fail(`"${await labOnScreen(a.page)}" is on screen, not "${saved.lab}"`);
  log(`A: "${saved.lab}" is back from the cloud, day ${(await probe(a.page)).day} (saved on ${saved.day})`);
  await a.context.close();

  // ---- B logs on: "Welcome back" offers the cloud's newer lab beside this computer's garage. ----
  await logOn(b.page);
  const w = b.page.locator(".f95-welcome");
  await w.getByRole("button", { name: "☁ Continue from the cloud" }).waitFor({ timeout: WAIT });
  log("B: Welcome back has Continue from the cloud");
  await shot(b.page, "cloud-continue-welcome.png");
  await w.getByRole("button", { name: "☁ Continue from the cloud" }).click();
  await welcomedBack(b.page, saved.lab);
  if ((await labOnScreen(b.page)) !== saved.lab) fail(`"${await labOnScreen(b.page)}" is on screen, not "${saved.lab}"`);
  log(`B: logged on after the box, and "${saved.lab}" replaced the garage`);
  await b.context.close();
  log("PASS: log on, save, storage cleared, log on again (and on a second computer, through the box): the lab comes back");
} catch (e) {
  process.exitCode = 1;
  console.error(e.message?.split("\n")[0] ?? e);
  if (last && !last.isClosed()) await last.screenshot({ path: join(args.out, "failed.png") }).catch(() => {});
  if (last && !last.isClosed()) console.error(`at ${last.url()}; screenshot in ${join(args.out, "failed.png")}`);
} finally {
  await browser.close();
}
