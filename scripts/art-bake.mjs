#!/usr/bin/env node
// FLT-70 art pass: turn the Fal picks (lossless PNGs in shots/fal/) into the intro's shipped textures.
//
//   node scripts/art-bake.mjs rects                # find the key-colour placeholders, write src/intro/assets/art.rects.json
//   node scripts/art-bake.mjs foil                 # crop the foil to the COA strip's aspect (shots/fal/coa-foil-crop.png, for Patina)
//   node scripts/art-bake.mjs bake                 # composite + convert everything into src/intro/assets/*.webp
//
// The art carries flat key colours where something is filled in later: magenta (#FF00FF) for the box back's three
// screenshot frames and the COA key box, green (#00FF00) for the COA foil strip. Rects are found on the lossless PNG
// (webp would smear the key). No image libraries on the machine, so all pixel work runs in headless Chromium's canvas.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const PICKS = JSON.parse(readFileSync("src/intro/assets/art.picks.json", "utf8"));
const RECTS = "src/intro/assets/art.rects.json";
const cmd = process.argv[2];

const browser = await chromium.launch();
const page = await browser.newPage();
const png = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;

// Runs inside the page: load images, find rects, draw, export.
await page.addScriptTag({
  content: `
  window.load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  window.canvasOf = (img, w = img.width, h = img.height) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); return c; };
  // Bounding boxes of the connected blobs of one key colour, largest first, in pixels of the source.
  window.findRects = (img, key) => {
    const S = 4, w = Math.floor(img.width / S), h = Math.floor(img.height / S);
    const d = canvasOf(img, w, h).getContext('2d').getImageData(0, 0, w, h).data;
    const hit = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      hit[i] = key === 'magenta' ? (r > 200 && g < 90 && b > 200) : (g > 200 && r < 90 && b < 90);
    }
    const seen = new Uint8Array(w * h), out = [];
    for (let s = 0; s < w * h; s++) {
      if (!hit[s] || seen[s]) continue;
      let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0; const st = [s]; seen[s] = 1;
      while (st.length) {
        const p = st.pop(), x = p % w, y = (p / w) | 0; n++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < w * h && hit[q] && !seen[q] && Math.abs((q % w) - x) <= 1) { seen[q] = 1; st.push(q); }
      }
      if (n > 40) out.push({ x: x0 * S, y: y0 * S, w: (x1 - x0 + 1) * S, h: (y1 - y0 + 1) * S, n });
    }
    return out.sort((a, b) => b.n - a.n).map(({ n, ...r }) => r);
  };
  window.toWebp = async (c, q) => { const b = await new Promise((ok) => c.toBlob(ok, 'image/webp', q)); return [...new Uint8Array(await b.arrayBuffer())]; };
  `,
});

if (cmd === "rects") {
  const rects = {};
  for (const [id, key, count] of [["box-back", "magenta", 3], ["coa-paper", "magenta", 1], ["coa-paper", "green", 1]]) {
    const r = await page.evaluate(async ([src, key]) => { const i = await load(src); return { w: i.width, h: i.height, rects: findRects(i, key) }; }, [png(PICKS[id]), key]);
    const found = r.rects.slice(0, count).sort((a, b) => a.x - b.x);
    if (found.length !== count) throw new Error(`${id}: wanted ${count} ${key} rects, found ${r.rects.length}`);
    // Normalised to the image (0..1, y down), so the runtime doesn't care what size the texture ships at.
    rects[`${id}.${key}`] = found.map((q) => ({ x: +(q.x / r.w).toFixed(4), y: +(q.y / r.h).toFixed(4), w: +(q.w / r.w).toFixed(4), h: +(q.h / r.h).toFixed(4) }));
    console.log(id, key, found);
  }
  writeFileSync(RECTS, JSON.stringify(rects, null, 2) + "\n");
  console.log(`wrote ${RECTS}`);
} else if (cmd === "foil") {
  // The COA strip is much taller than the 1:3 foil; keep the full height and crop the middle to the strip's aspect.
  const rects = JSON.parse(readFileSync(RECTS, "utf8"));
  const strip = rects["coa-paper.green"][0];
  const aspect = (strip.w * 1344) / (strip.h * 960); // width / height in paper pixels
  const bytes = await page.evaluate(async ([src, aspect]) => {
    const i = await load(src); const cw = Math.round(i.height * aspect);
    const H = Math.min(2048, i.height), W = Math.round((H * aspect) / 16) * 16; // Patina takes at most 2048 px a side
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(i, (i.width - cw) / 2, 0, cw, i.height, 0, 0, W, H);
    const b = await new Promise((ok) => c.toBlob(ok, 'image/png')); return [...new Uint8Array(await b.arrayBuffer())];
  }, [png(PICKS["coa-foil"]), aspect]);
  writeFileSync("shots/fal/coa-foil-crop.png", Buffer.from(bytes));
  console.log("wrote shots/fal/coa-foil-crop.png");
} else if (cmd === "bake") {
  const rects = JSON.parse(readFileSync(RECTS, "utf8"));
  for (const [id, spec] of Object.entries(PICKS.bake)) {
    if (spec.pack) {
      // Maps: channels packed from Patina's greyscale outputs (three reads roughness from G, metalness from B), or one
      // map as is. Lossless, so lossy chroma never smears a packed channel.
      const bytes = await page.evaluate(async ([pack, W]) => {
        const out = new ImageData(W, 1);
        let c, g, d;
        for (const [ch, src] of Object.entries(pack)) {
          const i = await load(src); const H = Math.round((W * i.height) / i.width);
          if (!c) { c = document.createElement('canvas'); c.width = W; c.height = H; g = c.getContext('2d'); d = g.createImageData(W, H); for (let k = 3; k < d.data.length; k += 4) d.data[k] = 255; }
          const s = canvasOf(i, W, H).getContext('2d').getImageData(0, 0, W, H).data;
          if (ch === 'rgb') { for (let k = 0; k < s.length; k += 4) { d.data[k] = s[k]; d.data[k + 1] = s[k + 1]; d.data[k + 2] = s[k + 2]; } }
          else { const o = 'rgb'.indexOf(ch); for (let k = 0; k < s.length; k += 4) d.data[k + o] = s[k]; }
        }
        g.putImageData(d, 0, 0);
        return toWebp(c, 1); // quality 1 is lossless in Chromium
      }, [Object.fromEntries(Object.entries(spec.pack).map(([k, v]) => [k, png(v)])), spec.width]);
      writeFileSync(`src/intro/assets/${id}.webp`, Buffer.from(bytes));
      console.log(`src/intro/assets/${id}.webp  ${(bytes.length / 1024).toFixed(0)} KB`);
      continue;
    }
    const shots = (spec.screens ?? []).map(png);
    const bytes = await page.evaluate(async ([src, spec, shots, rects]) => {
      const img = await load(src);
      const W = spec.width ?? img.width, H = Math.round((W * img.height) / img.width);
      const c = canvasOf(img, W, H), g = c.getContext('2d');
      const px = (r, grow = 0) => [r.x * W - grow, r.y * H - grow, r.w * W + 2 * grow, r.h * H + 2 * grow];
      // Screenshots cover-fit into the magenta frames (grown a hair to eat the anti-aliased fringe).
      for (const [k, s] of shots.entries()) {
        const shot = await load(s); const [x, y, w, h] = px(rects['box-back.magenta'][k], 3);
        const sc = Math.max(w / shot.width, h / shot.height), sw = w / sc, sh = h / sc;
        g.drawImage(shot, (shot.width - sw) / 2, (shot.height - sh) / 2, sw, sh, x, y, w, h);
      }
      // The COA: the key box becomes a plain printed panel (the key is drawn on it at runtime), the green strip a
      // neutral grey the foil shader replaces.
      if (spec.coa) {
        const [kx, ky, kw, kh] = px(rects['coa-paper.magenta'][0], 3);
        g.fillStyle = '#f4f7ef'; g.fillRect(kx, ky, kw, kh);
        g.strokeStyle = '#1f5b3a'; g.lineWidth = Math.max(2, W / 500); g.strokeRect(kx + 6, ky + 6, kw - 12, kh - 12);
        const [sx, sy, sw, sh] = px(rects['coa-paper.green'][0], 3);
        g.fillStyle = '#b8bcc0'; g.fillRect(sx, sy, sw, sh);
      }
      return toWebp(c, spec.q ?? 0.86);
    }, [png(spec.src), spec, shots, rects]);
    const out = `src/intro/assets/${id}.webp`;
    writeFileSync(out, Buffer.from(bytes));
    console.log(`${out}  ${(bytes.length / 1024).toFixed(0)} KB`);
  }
} else {
  console.log("usage: rects | foil | bake");
}
await browser.close();
