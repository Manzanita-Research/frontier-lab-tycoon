// A real ten-minute play session: no URL parameters, clock overrides, sim writes or debug hooks.
// node scripts/pacing-shots.mjs http://localhost:4173/ docs/evidence/FLT-16-sequence
import { chromium } from 'playwright';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
const [url = 'http://localhost:4173/', dir = 'docs/evidence/FLT-16-sequence'] = process.argv.slice(2);
if (new URL(url).search) throw new Error('Evidence must use a clean URL.');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', error => errors.push(String(error)));
const camera = new OrthographicCamera(-720, 720, 450, -450, -100, 200);
camera.zoom = 48; camera.position.set(18.8, 20, 24.2); camera.lookAt(-1.2, 0, 4.2); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
const screen = (x, z, w = 1, d = 1) => { const p = new Vector3(x + w / 2 - 12, 0.001, z + d / 2 - 12).project(camera); return [720 + p.x * 720, 450 - p.y * 450]; };
const parkPointer = () => page.mouse.move(720, 100);
async function tool(title) { await page.getByTitle(title, { exact: true }).click(); await page.waitForTimeout(500); }
async function place(x, z, w = 1, d = 1) { const [px, py] = screen(x, z, w, d); await page.mouse.click(px, py); await page.waitForTimeout(550); await parkPointer(); }
const log = [];
async function shot(minute) {
  await parkPointer();
  await page.screenshot({ path: `${dir}/minute-${String(minute).padStart(2, '0')}.png` });
  const status = await page.locator('.lab-date').innerText();
  const cash = await page.locator('.stat.cash .value').innerText();
  const instruction = await page.locator('.toasts').innerText();
  log.push({ minute, elapsedSeconds: Math.round((Date.now() - started) / 1000), date: status, cash, message: instruction });
  console.log(JSON.stringify(log.at(-1)));
}
await page.goto(url, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '1x speed', exact: true }).waitFor();
await page.waitForTimeout(2000);
const started = Date.now();
try {
  await shot(0);
  // The UI is the only input: paths, hall, gateway, and an SRE. Timing leaves room to read each instruction.
  const actions = [
    [8, async () => { await tool('Path'); for (let z = 18; z >= 10; z--) await place(11, z); for (let x = 4; x <= 19; x++) if (x !== 11) await place(x, 16); await page.keyboard.press('Escape'); }],
    [65, async () => { await tool('Training Hall'); await place(12, 11, 3, 3); await page.keyboard.press('Escape'); }],
    [82, async () => { await tool('API Gateway'); await place(7, 17, 2, 2); await page.keyboard.press('Escape'); }],
    [104, async () => { await page.locator('.staff-tool').click(); await page.waitForTimeout(500); await page.locator('.staff-hire li').filter({ hasText: 'SRE' }).getByRole('button', { name: /^Hire/ }).click(); await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.waitForTimeout(500); await page.locator('.toast.hint').click({ force: true }); }],
    [158, async () => { await tool('Kombucha Bar'); await place(12, 19); await page.keyboard.press('Escape'); }],
    [200, async () => { await tool('Snack Wall'); await place(9, 17); await page.keyboard.press('Escape'); }],
    [238, async () => { await tool('Nap Pods'); await place(6, 15, 2, 1); await page.keyboard.press('Escape'); }],
    [315, async () => { await tool('Demo Stage'); await place(14, 17, 2, 2); await page.keyboard.press('Escape'); }],
    [390, async () => { await tool('API Gateway'); await place(9, 13, 2, 2); await page.keyboard.press('Escape'); }],
    [460, async () => { await tool('Compute Cluster'); await place(12, 14, 2, 2); await page.keyboard.press('Escape'); }],
    [530, async () => { await tool('Demo Stage'); await place(14, 14, 2, 2); await page.keyboard.press('Escape'); }],
  ];
  let action = 0, minute = 1, released = false;
  while (Date.now() - started < 605000) {
    const seconds = (Date.now() - started) / 1000;
    // Resolve real cards via the same buttons a player uses. A low bid avoids gambling the first-run budget.
    const card = page.getByRole('dialog');
    if (await card.count()) {
      const choices = card.locator('button.choice, button.era-go');
      if (await choices.count()) { await choices.first().click(); await page.waitForTimeout(6000); }
    }
    if (!released && (await page.locator('.chip-title').innerText()).includes('Frontier-3')) {
      released = true;
      await page.screenshot({ path: `${dir}/first-release.png` });
      console.log('Captured first release at '+Math.round(seconds)+' seconds.');
    }
    if (action < actions.length && seconds >= actions[action][0]) { await actions[action++][1](); }
    if (minute <= 10 && seconds >= minute * 60) await shot(minute++);
    await page.waitForTimeout(1000);
  }
  await writeFile(`${dir}/session.json`, JSON.stringify({ url, speed: '1× throughout', viewport: '1440×900', seed: 'default (1)', errors, log }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} finally { await browser.close(); }
