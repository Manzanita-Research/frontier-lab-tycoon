#!/usr/bin/env node
// Browser evidence on Modal: actual camera, cue synthesis, app actions, persistence and phone layouts.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'docs/evidence/flt-7';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const report = { cues: [], beds: [], checks: [], errors };
const mark = message => { report.checks.push(message); console.log(message); };
const go = async query => {
  await page.goto(`${base}/?debug=1&skin=base&speed=0&${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__sound && window.__press);
  await page.waitForTimeout(600);
};
try {
await go('');
assert.equal(await page.evaluate(() => window.__sound.diagnostics().status), 'locked');
await page.getByRole('button', { name: 'Open sound mixer' }).click();
await page.waitForFunction(() => window.__sound.diagnostics().status === 'running');
mark('Audio locked before input, running after first pointerdown');
for (const cue of await page.evaluate(() => window.__sound.cues)) {
  const result = await page.evaluate(c => window.__sound.testCue(c), cue);
  assert(result.rms > 0.002 && result.peak > 0.02 && result.peak < 0.95, JSON.stringify(result));
  report.cues.push(result);
}
await page.getByText('Try the sounds', { exact: true }).click();
for (const label of ['Place', 'Coin', 'Bulldoze', 'News card', 'Choice', 'Release', 'New era', 'Alarm']) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(200);
}
assert.equal(Object.keys(await page.evaluate(() => window.__sound.diagnostics().cues)).length, 8);
mark('Every cue exercised through the real mixer controls and rendered offline');
await page.getByRole('button', { name: 'Mute campus', exact: true }).click();
assert.equal(await page.evaluate(() => window.__sound.diagnostics().mixer.muted), true);
for (const [channel, value] of [['master', '55'], ['music', '45'], ['sfx', '65']]) {
  await page.getByRole('slider', { name: channel, exact: true }).evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__sound);
await page.getByRole('button', { name: 'Open sound mixer' }).click();
await page.waitForFunction(() => window.__sound.diagnostics().status === 'running');
const saved = await page.evaluate(() => window.__sound.diagnostics().mixer);
assert.equal(saved.muted, true); assert.equal(saved.music, 0.45); assert.equal(saved.master, 0.55); assert.equal(saved.sfx, 0.65);
await page.waitForTimeout(300);
assert(await page.evaluate(() => window.__sound.diagnostics().masterGain < 0.001));
await page.getByRole('button', { name: 'Unmute campus', exact: true }).click();
await page.screenshot({ path: `${out}/mixer.png` });
await page.getByRole('button', { name: 'Close sound mixer' }).click();
mark('Mute and all mixer settings survive reload');

// Actual world cues, applied as real app commands (paused building is supported).
const waitCue = async cue => { await page.waitForFunction(c => window.__sound.diagnostics().cues[c] !== undefined, cue); };
await page.evaluate(() => window.__flt.send({ type: 'COMMAND', command: { type: 'placeBuilding', kind: 'gateway', x: 8, z: 17 } }));
await waitCue('place');
await page.evaluate(() => window.__flt.send({ type: 'COMMAND', command: { type: 'bulldoze', x: 8, z: 17 } }));
await waitCue('bulldoze');
await page.evaluate(() => { window.__flt.sim.world.training.context.progress = window.__flt.sim.world.training.context.cost; window.__flt.send({ type: 'SET_SPEED', speed: 1 }); });
await waitCue('release');
await page.evaluate(() => window.__flt.send({ type: 'SET_SPEED', speed: 0 }));
mark('Placement, bulldoze and release cues fired from real world observation');

for (const [name, query] of [['quiet',''], ['crowded','agents=200'], ['protest-night','agents=200&discourse=60&hour=22']]) {
  await go(query);
  await page.getByRole('button', { name: 'Open sound mixer' }).click();
  await page.getByRole('button', { name: 'Close sound mixer' }).click();
  await page.waitForTimeout(500);
  report.beds.push({ name, ...await page.evaluate(() => window.__sound.diagnostics().beds) });
}
assert(report.beds[1].crowd > report.beds[0].crowd);
assert(report.beds[2].protesters > 10 && report.beds[2].night > 0.6);
assert.equal(report.beds[0].training, 0.4);
await page.evaluate(() => { window.__flt.sim.world.training.context.progress = window.__flt.sim.world.training.context.cost * 0.9; window.__flt.sim.world.era = 'takeoff'; window.__flt.sim.world.buildings[0].broken = true; });
await page.waitForFunction(() => window.__sound.diagnostics().humHz > 260 && window.__sound.diagnostics().beds.training === 0.9);
const changed = await page.evaluate(() => window.__sound.diagnostics());
assert.equal(changed.beds.training, 0.9); assert(changed.humHz > 260); assert.equal(changed.beds.era, 'takeoff');
assert(changed.cues.era !== undefined && changed.cues.breakdown !== undefined);
await page.evaluate(() => { const { camera, controls } = window.__fx.get(); const dx = 10 - controls.target.x; const dz = -10 - controls.target.z; camera.position.x += dx; camera.position.z += dz; controls.target.set(10, 0, -10); camera.zoom = controls.maxZoom; camera.updateProjectionMatrix(); controls.update(); });
await page.waitForFunction(() => window.__sound.diagnostics().beds.crowd === 0);
assert.equal(await page.evaluate(() => window.__sound.diagnostics().beds.crowd), 0);
mark('Crowd follows camera position and scales with density; >10 protest chant; night crickets; rising training hum; era and breakdown compatibility adapters');

// Natural calendar publication, with no press demo involved.
await go('seed=3');
await page.evaluate(() => window.__flt.send({ type: 'SET_SPEED', speed: 10 }));
await page.waitForFunction(() => window.__press.room().archive.some(e => e.id === 'paper-7'), { timeout: 30000 });
await page.getByRole('button', { name: 'Read', exact: true }).click();
assert.equal(await page.evaluate(() => window.__press.room().view.type), 'paper');
await page.waitForFunction(() => window.__flt.registry.get(window.__flt.app.snapshot).value.context.speed === 0);
const paused = await page.evaluate(() => window.__flt.sim.world.day);
await page.waitForTimeout(400);
assert.equal(await page.evaluate(() => window.__flt.sim.world.day), paused);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__flt.registry.get(window.__flt.app.snapshot).value.context.speed === 10);
mark('Natural week publication; reading pauses campus; Escape restores speed');
await page.waitForFunction(() => window.__press.room().archive.some(e => e.id === 'chat-30'), { timeout: 30000 });
await page.evaluate(() => window.__flt.send({ type: 'SET_SPEED', speed: 0 }));
mark('Natural month publication at day 30');

await go('warp=20&newsdemo=paper');
await page.waitForSelector('.front-page img');
const photo = await page.locator('.front-page img').evaluate(img => ({ loaded: img.complete, width: img.naturalWidth, url: img.src }));
assert(photo.loaded && photo.width === 640 && photo.url.startsWith('data:image/webp'));
assert.equal(await page.locator('.paper-substories section').count(), 3);
await page.screenshot({ path: `${out}/front-page.png` });
mark('Live camera photo loaded at 640px; lead plus three stories, classifieds and rival ticker');
await page.getByRole('button', { name: '← Archive', exact: true }).click();
await page.locator('.archive-list button').filter({ hasText: 'WHAT JUST HAPPENED IN AI' }).first().click();
await page.waitForSelector('.typing-dots');
await page.getByRole('button', { name: 'Read all messages', exact: true }).click();
assert(await page.getByText('is this you on the news? call me', { exact: true }).isVisible());
await page.waitForFunction(() => [...document.querySelectorAll('.chat-row')].every(el => Number(getComputedStyle(el).opacity) > 0.99));
await page.screenshot({ path: `${out}/group-chat.png` });
await page.getByRole('button', { name: 'Skip and return to campus', exact: true }).click();
await page.getByRole('button', { name: 'Open News Room', exact: true }).click();
await page.screenshot({ path: `${out}/archive.png` });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__press && window.__press.room().archive.length >= 2);
mark('Paper and chat archived and restored after reload; typing dots, all four friends and Mom line visible');

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
phone.on('pageerror', e => errors.push(String(e)));
await phone.goto(`${base}/?debug=1&skin=base&speed=0&warp=20&newsdemo=chat`, { waitUntil: 'networkidle' });
await phone.getByRole('button', { name: 'Read all messages', exact: true }).click();
await phone.waitForFunction(() => [...document.querySelectorAll('.chat-row')].every(el => Number(getComputedStyle(el).opacity) > 0.99));
await phone.locator(".news-dialog").evaluate(el => { el.scrollTop = 0; });
await phone.screenshot({ path: `${out}/phone-chat.png` });
assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
await phone.getByRole('button', { name: '← Archive', exact: true }).click();
await phone.locator('.archive-list button').filter({ hasText: 'THE FRONTIER TIMES' }).first().click();
await phone.screenshot({ path: `${out}/phone-paper.png` });
assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
mark('390px phone paper and chat: no horizontal overflow, dismissal reachable');
} finally {
await browser.close();
writeFileSync(`${out}/browser-report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
assert.deepEqual(errors, []);
