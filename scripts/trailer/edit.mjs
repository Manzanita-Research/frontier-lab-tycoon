#!/usr/bin/env node
// FLT-97: cut a trailer from an edit list (JSON): footage from capture.mjs, title cards drawn as HTML, the game's music
// from music.mjs, an announcer from voice.mjs, and captions burned in (X autoplays muted). One ffmpeg pass: H.264 + AAC,
// yuv420p, +faststart, the voice ducking the music, loudness at -14 LUFS.
//
//   node scripts/trailer/edit.mjs scripts/trailer/cuts/tvad.json [--out shots/trailer/out/tvad.mp4] [--size 1080x1920]
//
// An edit list:
//   size: [w, h] (default [1920, 1080]); fps (30); clips dir (default shots/trailer/clips)
//   segments: [{ src: "box-pick" (a clip name, .mp4/.png path, or a card name), in: s, dur: s,
//               zoom: [from, to] (a slow push), at: [fx, fy] (zoom focus, 0..1), flash: true (cut in from white),
//               gray: true, eq: "brightness=-0.1:saturation=0.8", fadeIn/fadeOut: s,
//               fit: "cover" | "contain" (for --size other than 16:9: crop to fill, or letterbox on a blur),
//               scale: k (contain only: the frame at k× the width, cropped around `at`, so a HUD window stays legible),
//               portrait: { ...overrides for a 9:16 / 1:1 cut } }]
//   cards: { name: { html: "<div>...</div>", css: "...", portrait: { html?, css? } } }   drawn once at the output size, cached by content
//   music: { file, gain: dB, duck: dB under the voice, fadeOut: s }
//   voice: [{ file: "shots/trailer/voice/x.mp3", at: s, gain: dB }]
//   captions: { from: "voice" (word timestamps from voice[0]'s .json) | [{ start, end, text }], style: "tv" | "trailer" | "infomercial",
//               fix: { "A.I.": "AI" }, maxWords: 5, until: s (no lines that start later, e.g. over the end card) }
//   supers: [{ start, end, text, x, y, size, color, rotate, box: true, star: true }]   big on-screen words (ASS)
//   look: "vhs" | null
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const editPath = process.argv[2];
const edl = JSON.parse(readFileSync(editPath, "utf8"));
const [W, H] = arg("size") ? arg("size").split("x").map(Number) : edl.size ?? [1920, 1080];
const FPS = edl.fps ?? 30;
const clipsDir = edl.clips ?? "shots/trailer/clips";
const out = arg("out", `shots/trailer/out/${basename(editPath, ".json")}${W !== 1920 || H !== 1080 ? `-${W}x${H}` : ""}.mp4`);
const work = join(dirname(out), ".work");
mkdirSync(work, { recursive: true });
const portrait = W / H < 16 / 9 - 0.01;

// ---- Cards: HTML at the output size, screenshotted once. ----
const CARD_BASE = `html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}body{font-family:"Liberation Sans",Arial,sans-serif}`;
async function renderCards() {
  const cards = Object.entries(edl.cards ?? {});
  const todo = cards.map(([name, card]) => {
    const c = cardAt(card);
    const html = `<!doctype html><style>${CARD_BASE}${c.css ?? ""}</style>${c.html}`;
    const hash = createHash("sha256").update(html).digest("hex").slice(0, 10);
    return { name, html, file: join(work, `card-${name}-${W}x${H}-${hash}.png`) };
  }).filter((c) => !existsSync(c.file));
  if (!todo.length) return;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (const c of todo) {
    // Cards may show frames from the footage: <img src="clip:box-pick@3.2"> is that clip's frame at 3.2 s.
    const html = c.html.replace(/clip:([\w-]+)@([\d.]+)/g, (_, clip, t) => `data:image/png;base64,${frame(clip, Number(t)).toString("base64")}`);
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: c.file });
    console.log(`card ${c.name}`);
  }
  await browser.close();
}
function frame(clip, t) {
  return execFileSync("ffmpeg", ["-loglevel", "error", "-ss", String(t), "-i", join(clipsDir, `${clip}.mp4`), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 64 << 20 });
}
const cardAt = (card) => (portrait && card.portrait ? { ...card, ...card.portrait } : card);
const cardFile = (name) => {
  const c = cardAt(edl.cards[name]);
  const html = `<!doctype html><style>${CARD_BASE}${c.css ?? ""}</style>${c.html}`;
  return join(work, `card-${name}-${W}x${H}-${createHash("sha256").update(html).digest("hex").slice(0, 10)}.png`);
};

// ---- Captions and supers: one ASS file. ----
const ass = (s) => {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const sec = (t % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${sec}`;
};
const STYLES = {
  // A 1997 TV spot: heavy italic, yellow fill sweeping over white as the words are said, a thick outline and drop.
  tv: { font: "Liberation Sans", size: 0.072, bold: 1, italic: 1, primary: "&H0000E1FF", secondary: "&H00FFFFFF", outline: "&H00301000", back: "&H99000000", bord: 0.006, shadow: 0.004, marginV: 0.07 },
  infomercial: { font: "Liberation Sans", size: 0.075, bold: 1, italic: 0, primary: "&H0000F0FF", secondary: "&H00FFFFFF", outline: "&H00200080", back: "&HAA000000", bord: 0.007, shadow: 0.004, marginV: 0.07 },
  trailer: { font: "Liberation Serif", size: 0.06, bold: 1, italic: 0, primary: "&H00FFFFFF", secondary: "&H00A0A0A0", outline: "&H00000000", back: "&H80000000", bord: 0.003, shadow: 0.002, marginV: 0.08 },
};
function words(voice) {
  const meta = JSON.parse(readFileSync(voice.file.replace(/\.mp3$/, ".json"), "utf8"));
  const chars = []; const starts = []; const ends = [];
  for (const c of meta.timestamps) { chars.push(...c.characters); starts.push(...c.character_start_times_seconds); ends.push(...c.character_end_times_seconds); }
  const list = []; let cur = ""; let st = 0; let en = 0;
  const push = () => { if (cur && !/^\[.*\]$/.test(cur)) list.push({ w: cur, start: st + voice.at, end: en + voice.at }); cur = ""; };
  chars.forEach((ch, i) => {
    if (ch === " ") return push();
    if (!cur) st = starts[i];
    cur += ch; en = ends[i];
  });
  push();
  return list;
}
function captionEvents(cap) {
  if (Array.isArray(cap.from)) return cap.from.map((c) => ({ ...c, karaoke: null }));
  const list = (edl.voice ?? []).flatMap(words);
  const fix = cap.fix ?? {};
  const max = cap.maxWords ?? 5;
  const lines = []; let line = [];
  for (const w of list) {
    line.push({ ...w, w: fix[w.w] ?? w.w });
    if (/[.!?,…]$|\.\.\.$/.test(w.w) || line.length >= max) { lines.push(line); line = []; }
  }
  if (line.length) lines.push(line);
  return lines.filter((l) => cap.until == null || l[0].start < cap.until).map((l, i) => {
    const next = lines[i + 1];
    const end = next && next[0].start - l.at(-1).end < 0.6 ? next[0].start : l.at(-1).end + 0.35;
    return { start: l[0].start, end, text: l.map((w) => w.w).join(" "), karaoke: l };
  });
}
function star(r1, r2, n = 12) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1; const a = (Math.PI * i) / n; pts.push(`${Math.round(r * Math.cos(a))} ${Math.round(r * Math.sin(a))}`); }
  return `m ${pts[0]} l ${pts.slice(1).join(" ")}`;
}
function writeAss() {
  const st = STYLES[edl.captions?.style ?? "tv"];
  const u = Math.min(W, H) / 1080; // sizes are fractions of a 1080 frame's height, so a 9:16 cut keeps them legible
  const fs = Math.round(st.size * 1080 * u * (portrait ? 0.9 : 1));
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`
    + `Style: Cap,${st.font},${fs},${st.primary},${st.secondary},${st.outline},${st.back},${st.bold ? -1 : 0},${st.italic ? -1 : 0},0,0,100,100,0,0,1,${Math.max(2, Math.round(st.bord * 1080 * u))},${Math.round(st.shadow * 1080 * u)},2,${Math.round(W * 0.06)},${Math.round(W * 0.06)},${Math.round((portrait ? 0.2 : st.marginV) * H)},1\n`
    + `Style: Super,Liberation Sans,${Math.round(110 * u)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,-1,0,0,100,100,0,0,1,${Math.round(7 * u)},${Math.round(5 * u)},5,0,0,0,1\n`
    + `Style: Star,Liberation Sans,20,&H0000E1FF,&H0000E1FF,&H000020C0,&H00000000,0,0,0,0,100,100,0,0,1,${Math.round(6 * u)},0,7,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const ev = [];
  if (edl.captions) for (const c of captionEvents(edl.captions)) {
    const text = c.karaoke
      ? c.karaoke.map((w, i) => { const d = Math.max(1, Math.round(((c.karaoke[i + 1]?.start ?? w.end) - (i ? w.start : c.start)) * 100)); return `{\\kf${d}}${w.w}`; }).join(" ")
      : c.text;
    ev.push(`Dialogue: 1,${ass(c.start)},${ass(c.end)},Cap,,0,0,0,,{\\fad(60,60)}${text}`);
  }
  for (const s of edl.supers ?? []) {
    const x = Math.round((s.x ?? 0.5) * W); const y = Math.round((s.y ?? 0.4) * H);
    const size = Math.round((s.size ?? 110) * u);
    const pop = `\\fscx40\\fscy40\\t(0,120,\\fscx112\\fscy112)\\t(120,200,\\fscx100\\fscy100)`;
    if (s.star) {
      const r = Math.round((s.star === true ? 1.6 : s.star) * size * Math.max(1.2, s.text.length * 0.28));
      ev.push(`Dialogue: 2,${ass(s.start)},${ass(s.end)},Star,,0,0,0,,{\\an7\\pos(${x},${y})\\frz${s.rotate ?? -8}${pop}\\c${s.starColor ?? "&H0000E1FF&"}\\p1}${star(r, r * 0.72, 14)}{\\p0}`);
    }
    ev.push(`Dialogue: 3,${ass(s.start)},${ass(s.end)},Super,,0,0,0,,{\\pos(${x},${y})\\fs${size}\\frz${s.rotate ?? -8}${pop}\\c${s.color ?? "&H00FFFFFF&"}\\3c${s.outline ?? "&H00000000&"}}${s.text}`);
  }
  const file = resolve(work, `${basename(out, ".mp4")}.ass`);
  writeFileSync(file, head + ev.join("\n") + "\n");
  return file;
}

// ---- The cut. ----
await renderCards();
const segs = edl.segments.map((s) => (portrait && s.portrait ? { ...s, ...s.portrait } : s));
const inputs = []; const filters = []; let total = 0;
segs.forEach((s, i) => {
  const isCard = edl.cards?.[s.src];
  const file = isCard ? cardFile(s.src) : s.src.includes(".") ? s.src : join(clipsDir, `${s.src}.mp4`);
  if (/\.png$/.test(file)) inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(s.dur), "-i", file);
  else inputs.push("-ss", String(s.in ?? 0), "-t", String(s.dur), "-i", file);
  const [z0, z1] = s.zoom ?? [1, 1];
  const [fx, fy] = s.at ?? [0.5, 0.5];
  const chain = [];
  // Fit the source to the output: 16:9 → 16:9 is a plain scale; a 9:16 cut either crops ("cover", around `at`) or
  // puts the whole frame on a blurred copy of itself ("contain", the default for HUD shots).
  const ar = W / H;
  if (portrait && (s.fit ?? "contain") === "contain" && !isCard) {
    filters.push(`[${i}:v]split[a${i}][b${i}]`);
    filters.push(`[a${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:2,eq=brightness=-0.15[bg${i}]`);
    const fw = 2 * Math.round((W * (s.scale ?? 1)) / 2);
    filters.push(`[b${i}]scale=${fw}:-2,crop=${W}:ih:(iw-${W})*${fx}:0[fg${i}]`);
    filters.push(`[bg${i}][fg${i}]overlay=0:(H-h)/2*0.8,setsar=1[f${i}]`);
  } else if (!isCard && Math.abs(ar - 16 / 9) > 0.01) {
    filters.push(`[${i}:v]scale=-2:${H},crop=${W}:${H}:(iw-${W})*${fx}:0,setsar=1[f${i}]`);
  } else filters.push(`[${i}:v]scale=${W}:${H},setsar=1[f${i}]`);
  if (z0 !== 1 || z1 !== 1) {
    // zoompan, one output frame per input frame: a crop that changes size each frame would lose its focus point.
    const z = `${z0}+(${z1}-${z0})*on/${Math.round(s.dur * FPS)}`;
    chain.push(`fps=${FPS}`, `zoompan=z='${z}':x='(iw-iw/zoom)*${fx}':y='(ih-ih/zoom)*${fy}':d=1:s=${W}x${H}:fps=${FPS}`);
  }
  if (s.gray) chain.push("hue=s=0", "eq=contrast=1.1");
  if (s.eq) chain.push(`eq=${s.eq}`);
  chain.push(`fps=${FPS}`, `trim=duration=${s.dur}`, "setpts=PTS-STARTPTS", "format=yuv420p");
  if (s.flash) chain.push(`fade=in:st=0:d=0.18:color=white`);
  if (s.fadeOut) chain.push(`fade=out:st=${s.dur - s.fadeOut}:d=${s.fadeOut}`);
  if (s.fadeIn) chain.push(`fade=in:st=0:d=${s.fadeIn}`);
  filters.push(`[f${i}]${chain.join(",")}[v${i}]`);
  total += s.dur;
});
filters.push(`${segs.map((_, i) => `[v${i}]`).join("")}concat=n=${segs.length}:v=1:a=0[cut]`);
const assFile = writeAss();
const look = edl.look === "vhs"
  // A light tape look: a touch of grain, chroma bleed and soft scanlines; the HUD has to stay readable.
  ? `,noise=c0s=7:c0f=t,rgbashift=rh=2:bh=-2,eq=saturation=1.08:contrast=1.03,drawgrid=w=iw:h=4:t=1:c=black@0.10`
  : "";
filters.push(`[cut]subtitles=filename='${assFile}'${look}[vout]`);

// Audio: music bed (ducked by the voice), voice lines delayed to their marks, loudness to -14 LUFS.
let n = segs.length;
const amix = [];
if (edl.music) {
  inputs.push("-i", edl.music.file);
  const fo = edl.music.fadeOut ?? 1.5;
  filters.push(`[${n}:a]atrim=0:${total},asetpts=PTS-STARTPTS,volume=${edl.music.gain ?? 0}dB,afade=t=out:st=${total - fo}:d=${fo}[mus]`);
  n++;
}
const voices = edl.voice ?? [];
voices.forEach((v, k) => {
  inputs.push("-i", v.file);
  const ms = Math.round(v.at * 1000);
  filters.push(`[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${v.gain ?? 0}dB,adelay=${ms}|${ms},apad[vo${k}]`);
  n++;
});
if (voices.length) filters.push(`${voices.map((_, k) => `[vo${k}]`).join("")}amix=inputs=${voices.length}:normalize=0,atrim=0:${total}[vox]`);
if (edl.music && voices.length) {
  filters.push(`[vox]asplit[vox1][vkey]`);
  filters.push(`[mus]aformat=sample_rates=48000:channel_layouts=stereo[mus48]`);
  filters.push(`[mus48][vkey]sidechaincompress=threshold=0.02:ratio=${edl.music.duck ?? 6}:attack=15:release=350[duck]`);
  filters.push(`[duck][vox1]amix=inputs=2:normalize=0[mix]`);
} else filters.push(`[${edl.music ? "mus" : "vox"}]anull[mix]`);
filters.push(`[mix]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);

mkdirSync(dirname(out), { recursive: true });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stats", ...inputs, "-filter_complex", filters.join(";"), "-map", "[vout]", "-map", "[aout]",
  "-c:v", "libx264", "-preset", arg("preset", "medium"), "-crf", arg("crf", "18"), "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS),
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "-t", String(total), out], { stdio: "inherit" });
console.log(`${out}: ${total.toFixed(1)} s, ${W}×${H}`);
