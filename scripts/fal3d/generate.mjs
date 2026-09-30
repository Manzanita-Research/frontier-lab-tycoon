#!/usr/bin/env node
// FLT-13: reference images and image-to-3D through Fal. FAL_KEY comes from the environment and is never printed.
//
//   node scripts/fal3d/generate.mjs image <subject>                    styled concept image B from the procedural render A
//   node scripts/fal3d/generate.mjs model <subject> <A|B> <gen>        one image-to-3D generation (gen: tripo | hunyuan | trellis)
//   node scripts/fal3d/generate.mjs refetch <subject> <A|B> <gen> <requestId>   re-download a finished request (free)
//   node scripts/fal3d/generate.mjs ledger                             print the running total
//
// Every call is appended to docs/experiments/flt-13/ledger.csv before the next one starts, and the script refuses to
// start a call that could take the total past the hard stop.
import { fal } from "@fal-ai/client";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "docs/experiments/flt-13";
const RAW = join(OUT, "raw");
const LEDGER = join(OUT, "ledger.csv");
const HARD_STOP = 8;

// Fal's pricing endpoint gives unit prices (Tripo $0.01/credit, Hunyuan rapid $0.015/unit, Trellis 2 $0.05/unit, nano-banana
// edit $0.0398/image) but this API key cannot read usage or billing, so per-call cost is an upper-bound estimate.
// Exact figures are on the Fal dashboard.
const PRICE = {
  "fal-ai/nano-banana/edit": 0.0398,
  "tripo3d/h3.1/image-to-3d": 0.4,
  "fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d": 0.3,
  "fal-ai/trellis-2": 0.25,
};
const GEN = {
  tripo: { endpoint: "tripo3d/h3.1/image-to-3d", input: (image_url) => ({ image_url, texture: true, pbr: false, texture_quality: "standard", geometry_quality: "standard" }) },
  hunyuan: { endpoint: "fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d", input: (input_image_url) => ({ input_image_url, enable_pbr: false, enable_geometry: false }) },
  trellis: { endpoint: "fal-ai/trellis-2", input: (image_url) => ({ image_url }) },
};
const FLAVOUR = {
  hall: "a domed AI training hall: a cream drum with a ring of small windows, a big pale dome, one antenna",
  cluster: "a compact data-centre building made of four stacked server-rack towers of different heights, with a rooftop fan",
  float: "a parade float: a flatbed trailer carrying a giant papier-mache water bottle wearing sunglasses, with two protest banners on poles",
};
const ACCENT = { hall: "purple", cluster: "blue", float: "orange" };
const STYLE = "bright low-poly toy diorama, isometric, cream walls, one accent colour, soft shadows, white background";

fal.config({ credentials: process.env.FAL_KEY });
mkdirSync(RAW, { recursive: true });

const total = () => {
  if (!existsSync(LEDGER)) return 0;
  return readFileSync(LEDGER, "utf8").trim().split("\n").slice(1).reduce((sum, row) => sum + Number(row.split(",")[4] ?? 0), 0);
};
function record(endpoint, subject, reference, price, extra) {
  if (!existsSync(LEDGER)) writeFileSync(LEDGER, "time,endpoint,subject,reference,price_usd,seconds,request_id,note\n");
  appendFileSync(LEDGER, [new Date().toISOString(), endpoint, subject, reference, price.toFixed(4), extra.seconds.toFixed(1), extra.requestId ?? "", extra.note ?? ""].join(",") + "\n");
}
function guard(endpoint) {
  if (total() + PRICE[endpoint] > HARD_STOP) throw new Error(`hard stop: ${total().toFixed(2)} spent, ${PRICE[endpoint]} more would pass $${HARD_STOP}`);
}
async function upload(path) {
  return fal.storage.upload(new File([readFileSync(path)], path.split("/").pop(), { type: "image/png" }));
}
/** Every downloadable file in a result, whatever the key (Fal names them differently per model, and Hunyuan's "model_glb" is an OBJ). */
function filesIn(data) {
  const seen = new Map();
  const walk = (v) => {
    if (!v || typeof v !== "object") return;
    if (typeof v.url === "string") seen.set(v.url, v);
    for (const child of Object.values(v)) walk(child);
  };
  walk(data);
  return [...seen.values()];
}
const isGlb = (f) => /\.glb(\?|$)/i.test(f.url) || f.content_type === "model/gltf-binary";
const isObj = (f) => /\.obj(\?|$)/i.test(f.url) || f.content_type === "model/obj";

/** Saves a result as raw/<name>.glb, or as a raw/<name>/ folder (model.obj, material.mtl, texture) when the model comes back as OBJ. */
async function saveModel(data, name) {
  const files = filesIn(data);
  const glb = files.find(isGlb);
  if (glb) {
    await download(glb.url, join(RAW, `${name}.glb`));
    return { path: join(RAW, `${name}.glb`), kind: "glb", bytes: glb.file_size ?? 0 };
  }
  const obj = files.find(isObj);
  if (!obj) throw new Error("no model file in the result: " + files.map((f) => f.content_type).join(","));
  const dir = join(RAW, name);
  mkdirSync(dir, { recursive: true });
  await download(obj.url, join(dir, "model.obj"));
  let bytes = obj.file_size ?? 0;
  for (const f of files) {
    if (f === obj || (f.content_type ?? "").startsWith("model/") || !f.file_name || /preview/i.test(f.file_name)) continue;
    await download(f.url, join(dir, f.file_name));
    bytes += f.file_size ?? 0;
  }
  return { path: join(dir, "model.obj"), kind: "obj", bytes };
}
async function run(endpoint, input, label, retry = true) {
  guard(endpoint);
  const t0 = Date.now();
  try {
    const res = await fal.subscribe(endpoint, { input, logs: false });
    return { res, seconds: (Date.now() - t0) / 1000 };
  } catch (err) {
    const seconds = (Date.now() - t0) / 1000;
    const msg = String(err?.message ?? err).replace(/\s+/g, " ").slice(0, 160);
    // A failed call may or may not be billed; count it, to stay under the stop.
    record(endpoint, ...label, PRICE[endpoint], { seconds, note: `FAILED ${msg}` });
    if (!retry) throw err;
    console.log(`${label.join(" ")}: failed (${msg}); retrying once`);
    return run(endpoint, input, label, false);
  }
}
const download = async (url, path) => writeFileSync(path, Buffer.from(await (await fetch(url)).arrayBuffer()));

const [cmd, subject, ref, gen] = process.argv.slice(2);
if (cmd === "ledger") {
  console.log(`spent (estimated, upper bound): $${total().toFixed(2)} of $${HARD_STOP}`);
} else if (cmd === "image") {
  const endpoint = "fal-ai/nano-banana/edit";
  const image = await upload(join(OUT, "ref", `${subject}-A.png`));
  // First try ("Keep the same camera angle and framing") came back almost identical to the render, so it was rejected (B0).
  const prompt = `Reimagine this as ${FLAVOUR[subject]}. Style: ${STYLE}. Accent colour: ${ACCENT[subject]}. Give it a chunkier, more characterful silhouette and more personality than the input, like a collectible toy. A single object, no text, no ground plane.`;
  const { res, seconds } = await run(endpoint, { prompt, image_urls: [image], num_images: 1, output_format: "png" }, [subject, "A->B"]);
  await download(res.data.images[0].url, join(OUT, "ref", `${subject}-B.png`));
  record(endpoint, subject, "A->B", PRICE[endpoint], { seconds, requestId: res.requestId, note: "concept image" });
  console.log(`${subject}: concept image saved (${seconds.toFixed(0)} s), total $${total().toFixed(2)}`);
} else if (cmd === "model") {
  const g = GEN[gen];
  if (!g || !["A", "B"].includes(ref)) throw new Error("usage: model <subject> <A|B> <tripo|hunyuan|trellis>");
  const image = await upload(join(OUT, "ref", `${subject}-${ref}.png`));
  const { res, seconds } = await run(g.endpoint, g.input(image), [subject, `${ref}/${gen}`]);
  const saved = await saveModel(res.data, `${subject}-${gen}-${ref}`);
  record(g.endpoint, subject, `${ref}/${gen}`, PRICE[g.endpoint], { seconds, requestId: res.requestId, note: `ok ${saved.kind} ${saved.bytes}` });
  console.log(`${subject} ${gen}-${ref}: saved ${saved.path} (${saved.kind}, ${(saved.bytes / 1e6).toFixed(1)} MB, ${seconds.toFixed(0)} s), total $${total().toFixed(2)}`);
} else if (cmd === "refetch") {
  // Re-download a finished request by id. Free: it reads the stored result and generates nothing.
  const [, , , , requestId] = process.argv.slice(2);
  const g = GEN[gen];
  const data = (await fal.queue.result(g.endpoint, { requestId })).data;
  const saved = await saveModel(data, `${subject}-${gen}-${ref}`);
  console.log(`${subject} ${gen}-${ref}: refetched ${saved.path} (${saved.kind}, ${(saved.bytes / 1e6).toFixed(1)} MB)`);
} else {
  console.error("usage: generate.mjs image <subject> | model <subject> <A|B> <tripo|hunyuan|trellis> | ledger");
  process.exit(2);
}
