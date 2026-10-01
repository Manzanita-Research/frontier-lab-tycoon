#!/usr/bin/env node
// FLT-89: the software store's 3D props, generated on Fal (text-to-3D) and cleaned in Blender, logging every call.
//
//   node scripts/fal3d/props.mjs gen <prop>              # one Tripo H3.1 text-to-3D run from src/intro/assets/props.jobs.json
//   node scripts/fal3d/props.mjs clean <prop> <raw.glb>  # Blender (weld, fix normals, decimate, bake colour to the palette,
//                                                        # fit) → quantize + meshopt → src/intro/assets/props/<prop>.glb
//
// Needs FAL_KEY (never printed) for `gen`, and Blender from scripts/fal3d/install-blender.sh for `clean`. Raw models land
// in shots/fal3d/ (gitignored). Calls go to the same ledger as the printed art (FAL_LEDGER, docs/evidence/flt-89-art/).
// gltf-transform runs through `pnpm dlx`, so the game's install doesn't carry it.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LEDGER = process.env.FAL_LEDGER ?? "docs/evidence/flt-89-art/fal-ledger.jsonl";
const STATS = "docs/evidence/flt-89-art/props.json";
const RAW = "shots/fal3d";
const OUT = "src/intro/assets/props";
const ENDPOINT = "tripo3d/h3.1/text-to-3d";
// Tripo bills in credits ($0.01 each) and this key can't read usage, so a run is booked at FLT-13's upper bound.
const PRICE = 0.4;
const BLENDER = process.env.BLENDER ?? join(homedir(), ".cache/blender/blender-headless");
const GLTF = ["dlx", "@gltf-transform/cli@4.5.1"];

const [cmd, id, rawArg] = process.argv.slice(2);
const job = JSON.parse(readFileSync("src/intro/assets/props.jobs.json", "utf8")).find((j) => j.id === id);
if (!job) throw new Error(`usage: gen|clean <prop>; no prop "${id}"`);
mkdirSync(RAW, { recursive: true });
mkdirSync(dirname(LEDGER), { recursive: true });

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").slice(4, 13);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function falQueue(endpoint, input) {
  const auth = { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" };
  const sub = await fetch(`https://queue.fal.run/${endpoint}`, { method: "POST", headers: auth, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`${endpoint} ${sub.status}: ${(await sub.text()).slice(0, 400)}`);
  const { request_id, status_url, response_url } = await sub.json();
  for (;;) {
    await sleep(5000);
    const st = await (await fetch(status_url, { headers: auth })).json();
    if (st.status === "COMPLETED") break;
    if (st.status !== "IN_QUEUE" && st.status !== "IN_PROGRESS") throw new Error(`${endpoint} ${request_id}: ${JSON.stringify(st).slice(0, 300)}`);
  }
  const res = await fetch(response_url, { headers: auth });
  const body = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${request_id} ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return { body, requestId: request_id };
}

/** Every file URL in a result, whatever Fal calls the key. */
function files(data, seen = new Map()) {
  if (data && typeof data === "object") {
    if (typeof data.url === "string") seen.set(data.url, data);
    for (const v of Object.values(data)) files(v, seen);
  }
  return [...seen.values()];
}

if (cmd === "gen") {
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not set");
  const input = { prompt: job.prompt, negative_prompt: "text, letters, words, logo, brand, watermark", texture: true, pbr: false, texture_quality: "standard", geometry_quality: "standard" };
  const t0 = Date.now();
  let entry = { endpoint: ENDPOINT, prop: id, usd: PRICE, est: true };
  try {
    const { body, requestId } = await falQueue(ENDPOINT, input);
    const glb = files(body).find((f) => /\.glb(\?|$)/i.test(f.url) || f.content_type === "model/gltf-binary");
    if (!glb) throw new Error(`no .glb in ${JSON.stringify(Object.keys(body))}`);
    const path = join(RAW, `${id}-${stamp()}.glb`);
    writeFileSync(path, Buffer.from(await (await fetch(glb.url)).arrayBuffer()));
    entry = { ...entry, requestId, ms: Date.now() - t0, files: [path] };
    console.log(path);
  } catch (err) {
    // A failed run may still be billed: book it, so the total stays an upper bound.
    entry = { ...entry, ms: Date.now() - t0, failed: String(err.message ?? err).slice(0, 200) };
    console.error(entry.failed);
  }
  appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  const total = readFileSync(LEDGER, "utf8").trim().split("\n").reduce((s, l) => s + JSON.parse(l).usd, 0);
  console.log(`logged $${PRICE} (${ENDPOINT}, estimate); running total $${total.toFixed(4)}`);
} else if (cmd === "clean") {
  if (!rawArg || !existsSync(rawArg)) throw new Error("clean <prop> <raw.glb>");
  mkdirSync(OUT, { recursive: true });
  const tmp = join("/tmp", "fal3d-props");
  mkdirSync(tmp, { recursive: true });
  const cleaned = join(tmp, `${id}.blender.glb`);
  const stats = join(tmp, `${id}.json`);
  const args = ["--in", rawArg, "--out", cleaned, "--kind", job.kind, "--tris", String(job.tris), "--fit", job.fit.join(","), "--rot-y", String(job.rotY ?? 0), "--stats", stats];
  execFileSync(BLENDER, ["-b", "--factory-startup", "--python", "scripts/fal3d/clean.py", "--", ...args], { stdio: "ignore" });
  const dest = join(OUT, `${id}.glb`);
  execFileSync("pnpm", [...GLTF, "quantize", cleaned, join(tmp, `${id}.q.glb`)], { stdio: "ignore" });
  execFileSync("pnpm", [...GLTF, "meshopt", join(tmp, `${id}.q.glb`), dest, "--level", "high"], { stdio: "ignore" });
  const row = { prop: id, raw: rawArg, raw_bytes: statSync(rawArg).size, blender_bytes: statSync(cleaned).size, final_bytes: statSync(dest).size, ...JSON.parse(readFileSync(stats, "utf8")) };
  const all = existsSync(STATS) ? JSON.parse(readFileSync(STATS, "utf8")) : {};
  all[id] = row;
  writeFileSync(STATS, JSON.stringify(all, null, 2) + "\n");
  console.log(`${id}: ${(row.raw_bytes / 1e6).toFixed(1)} MB, ${row.raw_tris} tris → ${row.final_tris} tris, ${(row.final_bytes / 1e3).toFixed(0)} kB  ${JSON.stringify(row.palette_faces)}`);
} else {
  throw new Error("usage: gen|clean <prop>");
}
