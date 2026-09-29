#!/usr/bin/env node
// Contact sheet for the FLT-13 write-up: node scripts/fal3d/sheet.mjs out.png <cols> <cell-px> "label=path.png" ...
import sharp from "sharp";

const [out, colsArg, cellArg, ...items] = process.argv.slice(2);
const cols = Number(colsArg);
const cell = Number(cellArg);
const LABEL = 34;
const rows = Math.ceil(items.length / cols);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const layers = [];
for (const [i, item] of items.entries()) {
  const at = item.indexOf("=");
  const label = item.slice(0, at);
  const path = item.slice(at + 1);
  const x = (i % cols) * cell;
  const y = Math.floor(i / cols) * (cell + LABEL);
  layers.push({ input: await sharp(path).resize(cell, cell, { fit: "cover" }).flatten({ background: "#ffffff" }).toBuffer(), left: x, top: y + LABEL });
  layers.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${LABEL}"><rect width="100%" height="100%" fill="#3a2a1c"/><text x="12" y="23" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff3d0">${esc(label)}</text></svg>`),
    left: x,
    top: y,
  });
}
await sharp({ create: { width: cols * cell, height: rows * (cell + LABEL), channels: 3, background: "#ffffff" } }).composite(layers).png().toFile(out);
console.log("saved", out);
