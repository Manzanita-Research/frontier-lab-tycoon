#!/usr/bin/env node
// FLT-70 art pass: generate the big box's printed pieces on Fal and pull PBR maps out of them, logging every call.
//
//   node scripts/fal-art.mjs gen <job-id> [--n 1]          # a printed piece, from src/intro/assets/art.jobs.json
//   node scripts/fal-art.mjs patina <png> [--maps normal,roughness,metalness,height]
//   node scripts/fal-art.mjs material "<prompt>" --name <name> [--maps normal,roughness,height]
//   node scripts/fal-art.mjs ledger                         # the spend so far
//
// Needs FAL_KEY (an FLT-only machine variable; never printed). Raw outputs land in shots/fal/ (gitignored scratch);
// the picks are converted and copied into src/intro/assets/ by hand. Every call appends a line to
// docs/evidence/flt-70-art/fal-ledger.jsonl with its endpoint, inputs and cost (Fal's price table; see `cost`).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error("FAL_KEY is not set");
const OUT = "shots/fal";
// Each task keeps its own ledger (FLT-89: FAL_LEDGER=docs/evidence/flt-89-art/fal-ledger.jsonl), so its budget adds up alone.
const LEDGER = process.env.FAL_LEDGER ?? "docs/evidence/flt-70-art/fal-ledger.jsonl";
mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(LEDGER), { recursive: true });

const [cmd, arg, ...rest] = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

// Fal's published price for GPT Image 2.5 Sunburst is per token; this is its table for canonical sizes, per image.
// Other sizes are scaled by pixel count from the nearest row. Patina: $0.01 + $0.01 per megapixel per output map.
const SUNBURST = { low: 0.00588, medium: 0.01317, high: 0.05268, xhigh: 0.09366, max: 0.21072 }; // 1024x1024
function cost(endpoint, input, out) {
  if (endpoint.includes("gpt-image-2.5")) {
    const { width, height } = input.image_size;
    const per = SUNBURST[input.quality] * ((width * height) / (1024 * 1024));
    const refs = (input.image_urls?.length ?? 0) * 0.01; // reference images are input tokens
    return +(per * (input.num_images ?? 1) + refs).toFixed(4);
  }
  if (endpoint.includes("patina/material")) {
    const mp = (out?.w ?? 1024) * (out?.h ?? 1024) / 1e6;
    return +(0.01 + 0.0025 + mp * 0.01 * (1 + (input.maps?.length ?? 5))).toFixed(4);
  }
  if (endpoint.includes("patina")) {
    const mp = (out?.w ?? 1024) * (out?.h ?? 1024) / 1e6;
    return +(0.01 + mp * 0.01 * (input.maps?.length ?? 5)).toFixed(4);
  }
  return null;
}

async function run(endpoint, input) {
  const t0 = Date.now();
  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${text.slice(0, 600)}`);
  return { body: JSON.parse(text), ms: Date.now() - t0, requestId: res.headers.get("x-fal-request-id") };
}

async function download(url, path) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  return path;
}

function log(entry) {
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  const total = ledger().reduce((s, e) => s + (e.usd ?? 0), 0);
  console.log(`logged $${entry.usd} (${entry.endpoint}); running total $${total.toFixed(4)}`);
  if (total > 10) console.log("!!! over the $10 budget");
}

function ledger() {
  return existsSync(LEDGER) ? readFileSync(LEDGER, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
}

const dataUri = (path) => `data:image/${extname(path).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(path).toString("base64")}`;
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(4, 13);

if (cmd === "gen") {
  const jobs = JSON.parse(readFileSync("src/intro/assets/art.jobs.json", "utf8"));
  const job = jobs.find((j) => j.id === arg);
  if (!job) throw new Error(`no job ${arg}; have ${jobs.map((j) => j.id).join(", ")}`);
  const refs = job.refs ?? [];
  const endpoint = refs.length ? "openai/gpt-image-2.5/sunburst/edit" : "openai/gpt-image-2.5/sunburst/text-to-image";
  const input = {
    prompt: [job.prompt, ...(job.text?.length ? [`The ONLY words printed anywhere are, spelled exactly: ${job.text.map((t) => `"${t}"`).join("; ")}.`] : []), STYLE_RULES].join("\n\n"),
    image_size: job.size,
    quality: job.quality ?? "high",
    num_images: Number(opt("n", 1)),
    output_format: "png",
    ...(refs.length ? { image_urls: refs.map(dataUri) } : {}),
  };
  const { body, ms, requestId } = await run(endpoint, input);
  const files = [];
  for (const [i, img] of body.images.entries()) files.push(await download(img.url, `${OUT}/${job.id}-${stamp()}-${i}.png`));
  log({ endpoint, job: job.id, quality: input.quality, size: input.image_size, n: input.num_images, refs: refs.map((r) => basename(r)), requestId, ms, files, usd: cost(endpoint, input) });
  console.log(files.join("\n"));
} else if (cmd === "patina") {
  const maps = opt("maps", "normal,roughness,metalness,height").split(",");
  const endpoint = "fal-ai/patina";
  const input = { image_url: dataUri(arg), maps, output_format: "png" };
  const { body, ms, requestId } = await run(endpoint, input);
  const name = basename(arg, extname(arg));
  const files = [];
  for (const img of body.images) files.push(await download(img.url, `${OUT}/${name}.${img.map_type}.png`));
  const size = JSON.parse(execSize(arg));
  log({ endpoint, source: basename(arg), maps, requestId, ms, files, usd: cost(endpoint, input, size) });
  console.log(files.join("\n"));
} else if (cmd === "material") {
  const maps = opt("maps", "normal,roughness,height").split(",");
  const endpoint = "fal-ai/patina/material/extract";
  const input = { prompt: arg, maps, image_size: "square_hd", output_format: "png", tiling_mode: "both" };
  const { body, ms, requestId } = await run(endpoint, input);
  const name = opt("name", "material");
  const files = [];
  for (const [i, img] of body.images.entries()) files.push(await download(img.url, `${OUT}/${name}.${img.map_type ?? `texture${i}`}.png`));
  log({ endpoint, prompt: arg, maps, requestId, ms, files, usd: cost(endpoint, input, { w: 1024, h: 1024 }) });
  console.log(files.join("\n"));
} else if (cmd === "ledger") {
  const all = ledger();
  for (const e of all) console.log(`${e.at.slice(0, 16)}  $${e.usd.toFixed(4)}  ${e.endpoint}  ${e.job ?? e.source ?? e.prompt ?? ""}`);
  console.log(`total $${all.reduce((s, e) => s + e.usd, 0).toFixed(4)} over ${all.length} calls`);
} else {
  console.log("usage: gen <job> | patina <png> | material <prompt> --name <n> | ledger");
}

/** PNG width and height from the IHDR chunk, no dependencies. */
function execSize(path) {
  const b = readFileSync(path);
  if (b.toString("ascii", 1, 4) !== "PNG") return JSON.stringify({ w: 1024, h: 1024 });
  return JSON.stringify({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
}

// Shared by every printed piece: flat print scans, and the parody rules (no real marks of any kind).
var STYLE_RULES = [
  "Render it as a flat, straight-on, full-bleed scan of the printed artwork only: no perspective, no box edges, no table, no hands, no mockup, no shadow around it.",
  "Strictly no real-world logos, trademarks, brands, operating system logos (no four-pane window flags), publisher marks, console marks, rating-board marks, barcodes from real products or real people's faces. Every mark is original and invented.",
  "Spell all text exactly as given, in clean legible type, and add no other words, numbers or fake microtext.",
].join(" ");
