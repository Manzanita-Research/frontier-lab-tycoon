// Paid playtest through ordinary UI inputs at 1×, clean URL, no debug hooks or sim writes.
import { chromium } from "playwright";
import { OrthographicCamera, Vector3 } from "three";
import { mkdir, writeFile } from "node:fs/promises";
const [url = "http://localhost:4173/"] = process.argv.slice(2);
if (new URL(url).search) throw new Error("Use the clean opening URL.");
const dir = "docs/evidence/FLT-16-playtest";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], actions = [];
page.on("pageerror", e => errors.push(String(e)));
const camera = new OrthographicCamera(-720, 720, 450, -450, -100, 200);
camera.zoom = 48; camera.position.set(18.8, 20, 24.2); camera.lookAt(-1.2, 0, 4.2); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
const screen = (x, z, w = 1, d = 1) => { const p = new Vector3(x + w / 2 - 12, 0.001, z + d / 2 - 12).project(camera); return [720 + p.x * 720, 450 - p.y * 450]; };
let confirmations = 0;
async function approveIfAsked() {
  const dialog = page.getByRole("dialog", { name: "Low runway confirmation" });
  if (!await dialog.count()) return;
  confirmations++;
  const message = await dialog.locator("p").innerText();
  if (confirmations === 1) {
    await page.screenshot({ path: `${dir}/clean-confirmation.png` });
    const date = await page.locator(".lab-date").innerText();
    const cash = await page.locator(".stat.cash .value").innerText();
    await page.waitForTimeout(7000);
    if (date !== await page.locator(".lab-date").innerText() || cash !== await page.locator(".stat.cash .value").innerText()) throw new Error("Confirmation burned time or money");
  }
  actions.push({ confirmation: message });
  await dialog.getByRole("button", { name: /^Confirm/ }).click();
  await page.waitForTimeout(500);
}
async function tool(title) { await page.getByTitle(title, { exact: true }).click(); await page.waitForTimeout(350); }
async function place(x, z, w = 1, d = 1) {
  const [px, py] = screen(x, z, w, d);
  await page.mouse.click(px, py);
  await page.mouse.move(720, 100);
  await page.waitForTimeout(500);
  await approveIfAsked();
  actions.push({ placed: [x, z, w, d] });
}
try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "1x speed", exact: true }).waitFor();
  await page.waitForTimeout(1500);
  await tool("Path");
  for (let z = 18; z >= 10; z--) await place(11, z);
  for (let x = 12; x <= 15; x++) await place(x, 12);
  await tool("Compute Cluster");
  await place(9, 16, 2, 2); await place(9, 13, 2, 2);
  await tool("Training Hall");
  await place(12, 19, 3, 3); await place(12, 16, 3, 3); await place(12, 13, 3, 3);
  await tool("API Gateway"); await place(12, 10, 2, 2);
  await tool("Kombucha Bar"); await place(15, 13);
  await page.keyboard.press("Escape");
  await page.locator(".staff-tool").click();
  await page.waitForTimeout(500);
  for (const job of ["Janitor Bot", "SRE", "Comms Rep", "Security"])
    { await page.locator(".staff-hire li").filter({ hasText: job }).getByRole("button", { name: /^Hire/ }).click(); await page.waitForTimeout(500); await approveIfAsked(); }
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.waitForTimeout(500);
  // Revenue lands on the first midnight. A newly revealed tutorial step can pause again;
  // acknowledge each plain Continue control exactly as a player does.
  for (let i = 0; i < 30; i++) {
    const hint = page.locator(".toast.hint");
    if (await hint.count() && (await hint.innerText()).includes("Continue")) await hint.click({ force: true });
    await page.waitForTimeout(500);
  }
  const dateBefore = await page.locator(".lab-date").innerText();
  await page.screenshot({ path: `${dir}/clean-opening.png` });
  await page.waitForTimeout(6500);
  await page.screenshot({ path: `${dir}/clean-moving.png` });
  const dateAfter = await page.locator(".lab-date").innerText();
  if (dateBefore === dateAfter) throw new Error("Time did not resume after acknowledgement");
  const staff = await page.locator(".staff-tool").innerText();
  if (!staff.includes("Staff (4)")) throw new Error("Missing a hire: " + staff);
  const goal = await page.locator(".obj-list").innerText();
  if (!goal.includes("Ship 3 models (0/3), next: Frontier-2")) throw new Error("Incorrect release goal: " + goal);
  const warning = await page.locator(".toasts").innerText();
  if (warning.includes("entrance isn't connected")) throw new Error("Opening stranded at gate");
  if (!confirmations) throw new Error("Never warned before overspending");
  const report = { url, speed: "1× throughout", viewport: "1440×900", confirmations, goal, warning, staff, dateBefore, dateAfter, date: await page.locator(".lab-date").innerText(), cash: await page.locator(".stat.cash .value").innerText(), actions, errors };
  await writeFile(`${dir}/clean-session.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (errors.length) throw new Error(errors.join("\n"));
} finally { await browser.close(); }
