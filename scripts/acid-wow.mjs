#!/usr/bin/env node
// FLT-105 pass 2: how far and how smoothly the trip's tape wow bends. A plain 440 Hz sine goes through the game's own
// Wobble offline (the same `trip` envelopes as scripts/music-clips.mjs), and its pitch is tracked period by period.
//
//   pnpm build && (pnpm preview &) && sleep 2 && node scripts/acid-wow.mjs [--url http://localhost:4173/?debug=1&speed=0]
import { chromium } from "playwright";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const url = arg("url", "http://localhost:4173/?debug=1&speed=0");
const HZ = 440;
const cases = [
  { name: "full trip", trip: { points: [[0, 0], [3, 0], [8, 1], [20, 1], [27, 0]] }, seconds: 32, marks: { "in tune (0–3 s)": [0.5, 3], "full (10–20 s)": [10, 20], "after the ease back (29–32 s)": [29, 32] } },
  { name: "\"I've had enough\" at 8 s", trip: { points: [[0, 1], [8, 1], [8.4, 0]] }, seconds: 14, marks: { "full (2–8 s)": [2, 8], "8–9 s": [8, 9], "9–10 s": [9, 10], "10–14 s": [10, 14] } },
  { name: "calm trip", trip: { points: [[0, 0], [2, 0], [6, 1], [14, 1], [18, 0]], calm: true }, seconds: 22, marks: { "full calm (8–14 s)": [8, 14], "after (19–22 s)": [19, 22] } },
];

/** Upward zero crossings (interpolated) → one pitch reading per period, in cents from HZ. */
function track(samples, rate) {
  const at = [];
  for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) at.push((i - 1 + samples[i - 1] / (samples[i - 1] - samples[i])) / rate);
  const out = [];
  for (let i = 1; i < at.length; i++) out.push([at[i], 1200 * Math.log2(1 / (at[i] - at[i - 1]) / HZ)]);
  return out;
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__sound?.renderWowTone, null, { timeout: 60000 });
// The level column shows the wow never dips or jumps the volume (it is a delay line, never a crossfade).
const rows = ["| Case | Window | Bend (cents from 440 Hz) | Fastest glide (cents per 50 ms) | Level (dB, min to max) |", "|---|---|---|---|---|"];
for (const c of cases) {
  const decode = ({ float32 }) => { const raw = Buffer.from(float32, "base64"); return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4); };
  const out = await page.evaluate(({ trip, seconds }) => window.__sound.renderWowTone(trip, seconds), c);
  const mix = decode(out);
  const sampleRate = out.sampleRate;
  // From 0.1 s, once the 60 ms line has filled.
  const pitch = track(mix, sampleRate).filter(([t]) => t > 0.1);
  // RMS in 50 ms windows of the real mix (dB re a full-scale sine).
  const win = sampleRate / 20;
  const level = (a, b) => { const out = []; for (let i = Math.floor(a * sampleRate); i + win <= Math.min(mix.length, b * sampleRate); i += win) { let e = 0; for (let j = i; j < i + win; j++) e += mix[j] ** 2; out.push(20 * Math.log10(Math.sqrt(e / win) * Math.SQRT2 + 1e-9)); } return out; };
  for (const [label, [a, b]] of Object.entries(c.marks)) {
    const w = pitch.filter(([t]) => t >= a && t < b);
    const lo = Math.min(...w.map(([, x]) => x));
    const hi = Math.max(...w.map(([, x]) => x));
    // Readings 50 ms apart: how quickly the pitch moves at worst (a swoop or a glitch shows here).
    let glide = 0;
    for (let i = 0, j = 0; i < w.length; i++) { while (j < w.length && w[j][0] < w[i][0] + 0.05) j++; if (j < w.length) glide = Math.max(glide, Math.abs(w[j][1] - w[i][1])); }
    const db = level(a, b);
    rows.push(`| ${c.name} | ${label} | ${lo.toFixed(0)} to +${hi.toFixed(0)} | ${glide.toFixed(0)} | ${Math.min(...db).toFixed(1)} to ${Math.max(...db).toFixed(1)} |`);
  }
}
await browser.close();
console.log(rows.join("\n"));
