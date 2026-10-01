#!/usr/bin/env node
// FLT-80: how loud a clip sounds, not just how much energy it has. RMS says the nap's low sine pad is as loud as
// walkies; the ear disagrees. This is ITU BS.1770 integrated loudness (K-weighting, 400 ms blocks, the -70 LUFS and
// -10 LU gates) at 48 kHz, plus the same measure through an A-weighting filter: the music plays at background level,
// where the ear barely hears a 130 Hz sine, and BS.1770 doesn't model that; and "laptop", A-weighting through a
// small speaker (a 12 dB/octave roll-off below 200 Hz), which is how most players will hear the nap pad.
//
//   node scripts/music-loudness.mjs shots/music-before shots/music-after   # a table per directory of WAVs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The BS.1770 K-weighting filter at 48 kHz: a high shelf (the head) and a high-pass (RLB).
const STAGES = [
  { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
  { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] },
];

// A-weighting (IEC 61672): s^4 / ((s+w1)^2 (s+w2) (s+w3) (s+w4)^2) as first-order bilinear sections, prewarped.
function aStages(fs) {
  const K = 2 * fs;
  const w = (f) => 2 * fs * Math.tan((Math.PI * f) / fs);
  const hp = (f) => { const v = w(f); return { b: [K / (K + v), -K / (K + v), 0], a: [(v - K) / (K + v), 0] }; };
  const lp = (f) => { const v = w(f); return { b: [v / (K + v), v / (K + v), 0], a: [(v - K) / (K + v), 0] }; };
  return [hp(20.598997), hp(20.598997), hp(107.65265), hp(737.86223), lp(12194.217), lp(12194.217)];
}
const filter = (x, stages) => {
  for (const { b, a } of stages) {
    const y = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    x = y;
  }
  return x;
};
/** A second-order Butterworth high-pass (RBJ): a laptop speaker's bass roll-off. */
function speaker(fs, f = 200) {
  const w0 = (2 * Math.PI * f) / fs, alpha = Math.sin(w0) / Math.SQRT2, c = Math.cos(w0), a0 = 1 + alpha;
  return [{ b: [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], a: [(-2 * c) / a0, (1 - alpha) / a0] }];
}
/** A 1 kHz sine reads 0 dB through the A-weighting. */
const A_NORM = (() => {
  const fs = 48000, n = fs;
  const y = filter(Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1000 * i) / fs)), aStages(fs));
  let e = 0;
  for (let i = n / 2; i < n; i++) e += y[i] * y[i];
  return 0.5 / (e / (n / 2));
})();

/** Integrated loudness (LUFS) of mono samples at 48 kHz; -Infinity for silence. `weighting`: "K" (BS.1770), "A" or "laptop". */
export function lufs(samples, sampleRate = 48000, weighting = "K") {
  if (sampleRate !== 48000) throw new Error("lufs: weighting coefficients are for 48 kHz");
  const stages = weighting === "K" ? STAGES : [...aStages(sampleRate), ...(weighting === "laptop" ? speaker(sampleRate) : [])];
  const x = filter(Float64Array.from(samples), stages).map((v) => (weighting === "K" ? v : v * Math.sqrt(A_NORM)));
  const block = Math.round(0.4 * sampleRate), hop = Math.round(0.1 * sampleRate);
  const blocks = [];
  for (let i = 0; i + block <= x.length; i += hop) {
    let e = 0;
    for (let j = i; j < i + block; j++) e += x[j] * x[j];
    blocks.push(e / block);
  }
  const loud = (ms) => -0.691 + 10 * Math.log10(ms);
  const mean = (bs) => bs.reduce((s, v) => s + v, 0) / bs.length;
  const abs = blocks.filter((ms) => loud(ms) > -70);
  if (!abs.length) return -Infinity;
  const gate = loud(mean(abs)) - 10;
  const rel = abs.filter((ms) => loud(ms) > gate);
  return loud(mean(rel));
}

/** Mono 16-bit PCM WAV, as `music-clips.mjs` writes them. */
export function readWav(file) {
  const buf = readFileSync(file);
  const sampleRate = buf.readUInt32LE(24);
  let at = 12;
  while (buf.toString("ascii", at, at + 4) !== "data") at += 8 + buf.readUInt32LE(at + 4);
  const length = buf.readUInt32LE(at + 4) / 2;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = buf.readInt16LE(at + 8 + i * 2) / 32768;
  return { sampleRate, samples };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2);
  const files = [...new Set(dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".wav"))))].sort((a, b) => parseInt(a) - parseInt(b));
  console.log(`| Clip | ${dirs.join(" | ")} |\n|---|${dirs.map(() => "---|").join("")}`);
  // Each cell: K-weighted LUFS / A-weighted / A-weighted through a laptop speaker.
  for (const f of files) {
    const cells = dirs.map((d) => {
      const p = join(d, f);
      try { statSync(p); } catch { return "-"; }
      const { samples, sampleRate } = readWav(p);
      return ["K", "A", "laptop"].map((w) => lufs(samples, sampleRate, w).toFixed(1)).join(" / ");
    });
    console.log(`| ${f} | ${cells.join(" | ")} |`);
  }
}
