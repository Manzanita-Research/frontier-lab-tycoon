#!/usr/bin/env node
// FLT-97: an announcer read through Fal (ElevenLabs v3 TTS, a stock library voice: no cloning, no sound-alikes), with
// word timestamps for the captions. Every call is cached by its inputs, so re-cutting a trailer never pays twice, and
// every paid call is appended to a ledger with its estimated cost.
//
//   node scripts/trailer/voice.mjs --name tvad-v1 --voice Brian --text "[excited] This fall..." [--stability 0.3]
//   node scripts/trailer/voice.mjs --ledger        # print the ledger and the total
//
// Needs FAL_KEY (an FLT-only machine variable; never printed). Writes shots/trailer/voice/<name>.{mp3,json}.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const dir = arg("out", "shots/trailer/voice");
const ledger = join(dir, "ledger.csv");
mkdirSync(dir, { recursive: true });
const ENDPOINT = "fal-ai/elevenlabs/tts/eleven-v3";
const USD_PER_1K_CHARS = 0.1; // https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/elevenlabs/tts/eleven-v3

if (process.argv.includes("--ledger")) {
  const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").trim().split("\n").slice(1) : [];
  for (const r of rows) console.log(r);
  console.log(`total: $${rows.reduce((s, r) => s + Number(r.split(",")[4]), 0).toFixed(3)} over ${rows.length} calls`);
  process.exit(0);
}

const name = arg("name");
const text = arg("text") ?? (arg("file") && readFileSync(arg("file"), "utf8").trim());
if (!name || !text) throw new Error("--name and --text (or --file) are required");
const input = { text, voice: arg("voice", "Brian"), stability: Number(arg("stability", "0.5")), timestamps: true };
const key = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 12);
const cache = join(dir, `.cache-${key}.json`);

let result;
if (existsSync(cache)) {
  result = JSON.parse(readFileSync(cache, "utf8"));
  console.log(`${name}: cached (${key}), no charge`);
} else {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not set");
  const res = await fetch(`https://fal.run/${ENDPOINT}`, {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`${ENDPOINT}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  result = await res.json();
  writeFileSync(cache, JSON.stringify(result));
  const cost = (text.length / 1000) * USD_PER_1K_CHARS;
  if (!existsSync(ledger)) writeFileSync(ledger, "time,endpoint,name,chars,usd\n");
  appendFileSync(ledger, `${new Date().toISOString()},${ENDPOINT},${name},${text.length},${cost.toFixed(4)}\n`);
  console.log(`${name}: ${text.length} chars, about $${cost.toFixed(3)}`);
}
const audio = await fetch(result.audio.url);
writeFileSync(join(dir, `${name}.mp3`), Buffer.from(await audio.arrayBuffer()));
writeFileSync(join(dir, `${name}.json`), JSON.stringify({ input, timestamps: result.timestamps ?? null }, null, 1));
console.log(`wrote ${join(dir, `${name}.mp3`)}`);
