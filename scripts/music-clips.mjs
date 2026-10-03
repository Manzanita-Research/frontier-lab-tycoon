#!/usr/bin/env node
// FLT-66 show-and-tell: render the band offline (OfflineAudioContext, the game's own buses, voices and limiter) to WAVs,
// one per speed, a few transitions and the skins' flavours, plus a loudness table.
//
//   pnpm build && (pnpm preview &) && sleep 2
//   node scripts/music-clips.mjs [--url http://localhost:4173/?debug=1] [--out shots/music] [--only 1-nap,3-fetch]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const url = arg("url", "http://localhost:4173/?debug=1&speed=0");
const out = arg("out", "shots/music");
const only = arg("only", "").split(",").filter(Boolean);
// One fixed makeup gain for every clip (the game plays them at master 0.7 × music 0.3), so their loudness compares.
const MAKEUP_DB = 15;

const clips = [
  { name: "1-nap", takes: [{ at: 0, mode: "nap" }], seconds: 10, about: "Paused, or a card is open: a held pad that breathes (an octave up too, since FLT-80), and a bell." },
  { name: "2-walkies", takes: [{ at: 0, mode: "walkies" }], seconds: 12, about: "1×: the first pass's music, note for note." },
  { name: "3-fetch", takes: [{ at: 0, mode: "fetch" }], seconds: 12, about: "3×: the same tune jogging: bass, kick, claps, hats, an eighth-note arpeggio, and the whistled hook (the choir's tune); bar 8 squeaks." },
  { name: "4-zoomies", takes: [{ at: 0, mode: "zoomies" }], seconds: 12, about: "10×: 168 bpm hyperpop. The chipmunk choir sings \"ship it\" and \"o-kay! scale, SCAAALE!\", the inbox overflows on bar 8." },
  { name: "5-walkies-to-zoomies", takes: [{ at: 0, mode: "walkies" }, { at: 6.1, mode: "zoomies" }], seconds: 14, about: "The press at 6.1 s (mid-bar): a riser fills the wait, the drop lands on the next bar line." },
  { name: "6-zoomies-to-pause", takes: [{ at: 0, mode: "zoomies" }, { at: 4.9, mode: "nap" }], seconds: 11, about: "Pause at 4.9 s: the tape stops on the next bar line and the nap pad swells in." },
  { name: "7-tour", takes: [{ at: 0, mode: "walkies" }, { at: 5.4, mode: "fetch" }, { at: 11.2, mode: "zoomies" }, { at: 20.4, mode: "fetch" }, { at: 25.1, mode: "walkies" }, { at: 30.3, mode: "nap" }, { at: 35.2, mode: "walkies" }], seconds: 41, about: "1× → 3× → 10× → 3× → 1× → pause → 1×, every press off the beat." },
  { name: "8-zoomies-frontier-95", takes: [{ at: 0, mode: "zoomies" }], seconds: 12, skin: "frontier-95", about: "Frontier 95's zoomies: a General MIDI card, square waves and a desktop *ding*." },
  { name: "9-zoomies-karaoke-night", takes: [{ at: 0, mode: "zoomies" }], seconds: 8, skin: "karaoke-night", about: "Karaoke Night: disco saws and a wide chorus." },
  { name: "10-zoomies-field-almanac", takes: [{ at: 0, mode: "zoomies" }], seconds: 8, skin: "field-almanac", about: "Field Almanac: sines, soft drums and a kalimba for the inbox." },
  // FLT-80: the polish pass, each also on Frontier 95 (the default skin).
  { name: "11-walkies-to-fetch", takes: [{ at: 0, mode: "walkies" }, { at: 6.1, mode: "fetch" }], seconds: 16, about: "3× pressed at 6.1 s: fetch comes in on the next bar line." },
  { name: "12-nap-frontier-95", takes: [{ at: 0, mode: "nap" }], seconds: 10, skin: "frontier-95", about: "Frontier 95's nap." },
  { name: "13-fetch-frontier-95", takes: [{ at: 0, mode: "fetch" }], seconds: 12, skin: "frontier-95", about: "Frontier 95's fetch." },
  { name: "15-walkies-frontier-95", takes: [{ at: 0, mode: "walkies" }], seconds: 12, skin: "frontier-95", about: "Frontier 95's walkies, for the nap's loudness next to it." },
  { name: "16-choir", takes: [{ at: 0, mode: "zoomies" }], seconds: 12, solo: "choir", about: "The zoomies choir on its own (no band): can you make out the words?" },
  { name: "17-choir-frontier-95", takes: [{ at: 0, mode: "zoomies" }], seconds: 12, skin: "frontier-95", solo: "choir", about: "Frontier 95's choir on its own." },
  { name: "14-walkies-nap-walkies", takes: [{ at: 0, mode: "walkies" }, { at: 4.9, mode: "nap" }, { at: 12.2, mode: "walkies" }], seconds: 18, about: "1×, Space at 4.9 s (the tape stops into the nap), Space again at 12.2 s." },
  // FLT-105 pass 2: the trip's tape wow. `trip.points` is the strength over the clip ([seconds, 0 to 1]); in the game it comes from the trip's slew.
  { name: "18-acid-trip-frontier-95", takes: [{ at: 0, mode: "walkies" }], seconds: 30, skin: "frontier-95", trip: { points: [[0, 0], [3, 0], [8, 1], [20, 1], [27, 0]] }, about: "ACID MOD(E): in tune for 3 s, the wow comes on over 5 s (±80 cents every 4 s, a light flutter), holds, and eases back into tune by 27 s." },
  { name: "19-acid-enough-frontier-95", takes: [{ at: 0, mode: "walkies" }], seconds: 16, skin: "frontier-95", trip: { points: [[0, 1], [8, 1], [8.4, 0]] }, about: "Full wow, then \"I've had enough\" at 8 s: back in tune within about a second, no swoop." },
  { name: "20-acid-calm-frontier-95", takes: [{ at: 0, mode: "walkies" }], seconds: 20, skin: "frontier-95", trip: { points: [[0, 0], [2, 0], [6, 1], [14, 1], [18, 0]], calm: true }, about: "The calm (reduced motion) trip: a slower ±35-cent sway, no flutter." },
].filter((c) => !only.length || only.includes(c.name));

function wav(samples, sampleRate) {
  const gain = 10 ** (MAKEUP_DB / 20);
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8); head.write("fmt ", 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : "-inf");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__sound?.renderMusic, null, { timeout: 60000 });
mkdirSync(out, { recursive: true });
const rows = [];
for (const clip of clips) {
  const started = Date.now();
  const { sampleRate, float32 } = await page.evaluate(({ takes, seconds, skin, solo, trip }) => window.__sound.renderMusic(takes, seconds, skin, "1", solo, trip), clip);
  const raw = Buffer.from(float32, "base64");
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  let energy = 0; let peak = 0; let silent = 0;
  for (const x of samples) { energy += x * x; peak = Math.max(peak, Math.abs(x)); }
  // Gaps: 50 ms windows with nothing in them (a hard cut or a dead bar line shows up here).
  const win = sampleRate / 20;
  for (let i = 0; i + win <= samples.length; i += win) { let e = 0; for (let j = i; j < i + win; j++) e += samples[j] ** 2; if (Math.sqrt(e / win) < 1e-5) silent++; }
  const file = `${clip.name}.wav`;
  writeFileSync(join(out, file), wav(samples, sampleRate));
  rows.push({ ...clip, file, rms: Math.sqrt(energy / samples.length), peak, silent, renderMs: Date.now() - started });
  console.log(`${file}: rms ${db(Math.sqrt(energy / samples.length))} dBFS, peak ${db(peak)} dBFS, silent 50 ms windows ${silent}, ${Date.now() - started} ms`);
}
await browser.close();
const table = ["| Clip | Skin | Length | RMS (dBFS) | Peak (dBFS) | Silent 50 ms windows | What to listen for |", "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| [${r.file}](${r.file}) | ${r.skin ?? "Classic"} | ${r.seconds} s | ${db(r.rms)} | ${db(r.peak)} | ${r.silent} | ${r.about} |`)].join("\n");
writeFileSync(join(out, "README.md"), `# Music clips\n\nRendered offline by \`node scripts/music-clips.mjs\` (OfflineAudioContext in headless Chromium, the game's own Band, voices and limiter at the default mixer, then +${MAKEUP_DB} dB on every clip alike). Levels are before the makeup gain.\n\n${table}\n`);
console.log(table);
