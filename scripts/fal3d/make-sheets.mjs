#!/usr/bin/env node
// FLT-13: the side-by-side sheets that go in the write-up, from the shots in docs/experiments/flt-13/img.
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const D = "docs/experiments/flt-13/img";
const sheet = (out, cols, cell, ...items) => execFileSync("node", ["scripts/fal3d/sheet.mjs", `${D}/${out}`, String(cols), String(cell), ...items], { stdio: "inherit" });
for (const [name, gen] of [["hall", "tripo-B"], ["cluster", "tripo-B"], ["float", "tripo-B"]]) {
  const before = name === "float" ? "blockout" : "procedural";
  sheet(`sbs-${name}.png`, 2, 640, `${name} ${before}, normal=${D}/${name}-proc.png`, `${name} generated (${gen}), normal=${D}/${name}-gen.png`, `${name} ${before}, photo mode=${D}/${name}-proc-photo.png`, `${name} generated (${gen}), photo mode=${D}/${name}-gen-photo.png`);
}
// The campus shot is wide, so stack the two frames instead of cropping them square.
const [a, b] = await Promise.all(["campus-proc", "campus-gen"].map((n) => sharp(`${D}/${n}.png`).toBuffer()));
const { width, height } = await sharp(a).metadata();
await sharp({ create: { width, height: height * 2 + 40, channels: 3, background: "#3a2a1c" } })
  .composite([{ input: a, top: 0, left: 0 }, { input: b, top: height + 40, left: 0 }])
  .png()
  .toFile(`${D}/sbs-campus.png`);
console.log("saved", `${D}/sbs-campus.png`);
