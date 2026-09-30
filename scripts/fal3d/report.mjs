#!/usr/bin/env node
// FLT-13: builds the results tables (markdown) from the ledger, per-candidate stats, measurements and hand-written scores.
//   node scripts/fal3d/report.mjs > docs/experiments/flt-13/tables.md
import { existsSync, readFileSync } from "node:fs";

const OUT = "docs/experiments/flt-13";
const read = (p) => JSON.parse(readFileSync(`${OUT}/${p}`, "utf8"));
const ledger = readFileSync(`${OUT}/ledger.csv`, "utf8").trim().split("\n").slice(1).map((l) => {
  const [time, endpoint, subject, reference, price, seconds, requestId, ...note] = l.split(",");
  return { time, endpoint, subject, reference, price: Number(price), seconds: Number(seconds), note: note.join(",") };
});
const scores = existsSync(`${OUT}/scores.json`) ? read("scores.json") : {};
const m = existsSync(`${OUT}/measurements.json`) ? read("measurements.json") : [];
const find = (subject, variant, copies) => m.find((r) => r.subject === subject && r.variant === variant && r.copies === copies);
const mb = (n) => (n / 1e6).toFixed(1) + " MB";
const kb = (n) => (n / 1e3).toFixed(0) + " kB";
const fmt = (n, d = 0) => (n == null ? "n/a" : Number(n).toFixed(d));

const lines = [];
lines.push("| Model | Fal cost (est.) | Gen time | Raw tris | Raw size | Clean tris | Blender GLB | Final (meshopt) | Load / parse (ms) | Calls, tris in scene (x1) | Frame ms x1 / x12 | Style (1-5) |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const subject of ["hall", "cluster", "float"]) {
  const base1 = find(subject, "proc", 1);
  const base12 = find(subject, "proc", 12);
  lines.push(`| **${subject} procedural** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | ${base1 ? `${base1.calls}, ${base1.triangles}` : ""} | ${base1 ? `${fmt(base1.meanMs, 1)} / ${fmt(base12?.meanMs, 1)}` : ""} | ${scores[`${subject}-proc`]?.[0] ?? ""} |`);
  const files = ledger.filter((r) => r.subject === subject && r.reference.includes("/") && r.note.startsWith("ok"));
  for (const r of files) {
    const [ref, gen] = r.reference.split("/");
    const name = `${subject}-${gen}-${ref}`;
    if (!existsSync(`${OUT}/stats/${name}.json`)) continue;
    const s = read(`stats/${name}.json`);
    const a = find(subject, name, 1);
    const b = find(subject, name, 12);
    lines.push(`| ${gen} ${ref} | $${r.price.toFixed(2)} | ${fmt(r.seconds)} s | ${(s.raw_tris / 1e3).toFixed(0)}k | ${mb(s.raw_bytes)} | ${s.final_tris} | ${kb(s.blender_bytes)} | ${kb(s.final_bytes)} | ${a ? `${fmt(a.loadMs)} / ${fmt(a.parseMs)}` : ""} | ${a ? `${a.calls}, ${a.triangles}` : ""} | ${a ? `${fmt(a.meanMs, 1)} / ${fmt(b?.meanMs, 1)}` : ""} | ${scores[name]?.[0] ?? ""} |`);
  }
}
lines.push("");
lines.push("Failed or rejected calls:");
for (const r of ledger.filter((r) => !r.note.startsWith("ok") && !r.note.startsWith("concept"))) lines.push(`- ${r.time} ${r.endpoint} ${r.subject} ${r.reference}: ${r.note} ($${r.price.toFixed(2)} counted)`);
const total = ledger.reduce((n, r) => n + r.price, 0);
lines.push("");
lines.push(`Total spend, upper-bound estimate: **$${total.toFixed(2)}** over ${ledger.length} calls.`);
console.log(lines.join("\n"));
