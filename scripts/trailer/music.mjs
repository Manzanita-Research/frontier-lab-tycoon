#!/usr/bin/env node
// FLT-97: the game's own music as a WAV bed for a video. Renders the Band offline in headless Chromium (the same
// `window.__sound.renderMusic` hook as scripts/music-clips.mjs, which `?debug=1` exposes), so a trailer can cut to the
// bar lines of walkies, fetch, zoomies or the nap, in any skin's flavour.
//
//   node scripts/trailer/music.mjs --takes walkies@0,zoomies@6.1 --seconds 40 [--skin frontier-95] [--era 1] [--out shots/trailer/music.wav]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const base = arg("base", "https://app.frontierlabtycoon.com");
const takes = arg("takes", "zoomies@0").split(",").map((t) => { const [mode, at] = t.split("@"); return { mode, at: Number(at ?? 0) }; });
const seconds = Number(arg("seconds", "40"));
const skin = arg("skin", "frontier-95");
const era = arg("era", "1");
const out = arg("out", "shots/trailer/music.wav");
// The game plays music at master 0.7 × music 0.3; a fixed makeup gain brings the bed up to a usable level.
const gain = 10 ** (Number(arg("gain-db", "15")) / 20);

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
// A staged seed and paused: a fresh context, never anyone's autosave.
await page.goto(`${base}/?debug=1&seed=3&speed=0`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__sound?.renderMusic, null, { timeout: 90000 });
const { sampleRate, float32 } = await page.evaluate(({ takes, seconds, skin, era }) => window.__sound.renderMusic(takes, seconds, skin, era), { takes, seconds, skin, era });
await browser.close();
const raw = Buffer.from(float32, "base64");
const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
// 16-bit stereo (the same signal on both sides).
const data = Buffer.alloc(samples.length * 4);
for (let i = 0; i < samples.length; i++) {
  const v = Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767);
  data.writeInt16LE(v, i * 4); data.writeInt16LE(v, i * 4 + 2);
}
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8); head.write("fmt ", 12);
head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(sampleRate, 24);
head.writeUInt32LE(sampleRate * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(data.length, 40);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([head, data]));
console.log(`${out}: ${seconds} s of ${takes.map((t) => `${t.mode}@${t.at}`).join(" → ")} (${skin}, era ${era}), ${sampleRate} Hz`);
