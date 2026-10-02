#!/usr/bin/env node
// The link-preview art (FLT-99): the 1200×630 Open Graph card and the icons, rendered from HTML in headless Chromium
// and committed under public/ (crawlers fetch them from stable paths, so they are not part of the hashed build).
//
//   node scripts/og-card.mjs            # writes public/og/card.jpg, public/icons/*.png, public/favicon.ico
//   node scripts/og-card.mjs --only card
//
// The card is the trailer's synthwave end card (FLT-97, scripts/trailer/cuts/final.json) with the big box (FLT-70)
// standing in it. It has to read as a thumbnail, so the title is huge and nothing important sits near an edge
// (X and Slack crop it a little). It is a JPEG because WhatsApp drops a preview image over about 300 KB. Fonts are
// Liberation Sans/Mono, as in the trailer.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const only = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const dataUrl = (file, type) => `data:${type};base64,${readFileSync(root + file).toString("base64")}`;
const front = dataUrl("src/intro/assets/box-front.webp", "image/webp");
const mark = dataUrl("public/favicon.svg", "image/svg+xml");

const CARD = /* html */ `<!doctype html><html><head><style>
* { box-sizing: border-box; }
body { margin: 0; width: 1200px; height: 630px; overflow: hidden; position: relative; font-family: "Liberation Sans", sans-serif; }
.bg { position: absolute; inset: 0; background: linear-gradient(#12052e 0%, #3b0f63 52%, #c2306e 100%); }
.stars { position: absolute; inset: 0 0 40% 0; background-image:
  radial-gradient(1.6px 1.6px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 31% 9%, #fff 50%, transparent 51%),
  radial-gradient(1.4px 1.4px at 47% 26%, #ffd6f5 50%, transparent 51%), radial-gradient(1.2px 1.2px at 66% 7%, #fff 50%, transparent 51%),
  radial-gradient(1.8px 1.8px at 88% 12%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 94% 38%, #ffd6f5 50%, transparent 51%),
  radial-gradient(1.4px 1.4px at 4% 44%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 58% 40%, #fff 50%, transparent 51%);
  opacity: .8; }
.sun { position: absolute; left: 640px; top: 40px; width: 360px; height: 360px; border-radius: 50%;
  background: linear-gradient(#ffe45c, #ff6a3d 70%, #ff3d8b);
  -webkit-mask: linear-gradient(#000 0 46%, transparent 0) top / 100% 100% no-repeat,
    repeating-linear-gradient(#000 0 26px, transparent 26px 34px);
  box-shadow: 0 0 80px #ff6a3d55; opacity: .95; }
.horizon { position: absolute; left: 0; right: 0; top: 404px; height: 3px; background: #ff9ae6; box-shadow: 0 0 18px #ff5fd2; }
.floor { position: absolute; left: -30%; right: -30%; top: 404px; height: 420px; transform-origin: top; transform: perspective(380px) rotateX(58deg);
  background-color: #1d0640;
  background-image: linear-gradient(#ff5fd2 3px, transparent 3px), linear-gradient(90deg, #ff5fd2 3px, transparent 3px);
  background-size: 90px 70px; background-position: center top; }
.floor::after { content: ""; position: absolute; inset: 0; background: linear-gradient(#12052e 0%, transparent 35%); }

.stage { position: absolute; left: 60px; top: 52px; width: 430px; height: 540px; perspective: 1400px; }
.box { position: absolute; left: 70px; top: 0; width: 405px; height: 498px; transform-style: preserve-3d; transform: rotateY(26deg) rotateZ(-1deg); }
.face { position: absolute; top: 0; height: 100%; backface-visibility: hidden; }
.front { left: 0; width: 100%; background: url(${front}) center / cover; border-radius: 3px; }
.front::after { content: ""; position: absolute; inset: 0; border-radius: 3px;
  background: linear-gradient(115deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 70%, rgba(255,255,255,.12) 100%); }
.side { left: -84px; width: 84px; transform-origin: right; transform: rotateY(-90deg); background: linear-gradient(90deg, #0d1f5e, #1b3a9a);
  display: flex; align-items: center; justify-content: center; }
.side span { writing-mode: vertical-rl; transform: rotate(180deg); font: italic 900 31px/1 "Liberation Sans"; color: #ffd84a; letter-spacing: 1px;
  -webkit-text-stroke: 1.5px #0a1440; white-space: nowrap; }
.shadow { position: absolute; left: 40px; top: 470px; width: 440px; height: 60px; border-radius: 50%; background: radial-gradient(#000a 0%, transparent 70%); }

.copy { position: absolute; left: 556px; right: 40px; top: 46px; text-align: center; }
h1 { margin: 0; font: italic 900 104px/0.92 "Liberation Sans"; color: #ffe14a; letter-spacing: -2px;
  -webkit-text-stroke: 4px #1d0a52; paint-order: stroke fill; text-shadow: 6px 6px 0 #ff3d8b, 12px 12px 0 #1d0a52; }
.pitch { margin-top: 26px; font: italic 900 46px/1.05 "Liberation Sans"; color: #fff; text-shadow: 4px 4px 0 #1d0a52; }
.free { margin-top: 14px; font: 700 30px/1.1 "Liberation Sans"; color: #ffd6f5; text-shadow: 3px 3px 0 #1d0a52; }
.url { display: inline-block; margin-top: 26px; padding: 8px 26px; font: 700 40px "Liberation Mono"; background: #fff; color: #1d0a52;
  border: 5px solid #1d0a52; box-shadow: 8px 8px 0 #ff3d8b; }
.badge { position: absolute; left: 28px; top: 26px; width: 150px; height: 150px; transform: rotate(-12deg); z-index: 2;
  display: flex; align-items: center; justify-content: center; text-align: center;
  font: italic 900 21px/1 "Liberation Sans"; color: #d10f1a;
  background: #ffe600; clip-path: polygon(50% 0%, 61% 14%, 79% 6%, 81% 24%, 98% 28%, 88% 44%, 100% 58%, 83% 66%, 88% 85%, 69% 83%, 60% 100%, 47% 87%, 31% 98%, 27% 80%, 8% 82%, 14% 64%, 0% 52%, 13% 39%, 4% 22%, 23% 20%, 25% 2%, 40% 13%); }
.tag { position: absolute; right: 40px; bottom: 22px; font: 700 18px "Liberation Sans"; color: #ffe14a; letter-spacing: 3px; }
</style></head><body>
<div class="bg"></div><div class="stars"></div><div class="sun"></div><div class="floor"></div><div class="horizon"></div>
<div class="stage"><div class="shadow"></div><div class="box"><div class="face side"><span>FRONTIER LAB TYCOON</span></div><div class="face front"></div></div></div>
<div class="badge">AS SEEN<br>BEFORE<br>THE<br>SENATE!</div>
<div class="copy">
  <h1>FRONTIER<br>LAB<br>TYCOON</h1>
  <div class="pitch">Run your very own AI lab.</div>
  <div class="free">Free. In your browser.</div>
  <div class="url">frontierlabtycoon.com</div>
</div>
<div class="tag">AGES 8 TO ADULT · PC CD-ROM NOT REQUIRED</div>
</body></html>`;

// The icons: the sunrise mark on Frontier 95's desktop teal, a square tile so iOS has nothing transparent to fill black.
// `pad` is the space around the mark as a share of the tile (maskable icons keep it inside the central 80% circle).
const icon = (size, pad) => /* html */ `<!doctype html><html><head><style>
body { margin: 0; width: ${size}px; height: ${size}px; background: linear-gradient(#0a9a9a, #006a6a); display: flex; align-items: center; justify-content: center; }
img { width: ${Math.round(size * (1 - 2 * pad))}px; height: ${Math.round(size * (1 - 2 * pad))}px; }
</style></head><body><img src="${mark}"></body></html>`;

// A .ico is a tiny directory of PNGs; every browser that still asks for /favicon.ico reads PNG entries.
const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.png)]);
};

const browser = await chromium.launch();
const render = async (html, size, path, transparent = false, jpeg = false) => {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ ...(jpeg ? { type: "jpeg", quality: 86 } : { type: "png", omitBackground: transparent }), ...(path ? { path } : {}) });
  await page.close();
  return png;
};

mkdirSync(root + "public/og", { recursive: true });
mkdirSync(root + "public/icons", { recursive: true });
const wrote = [];
if (!only || only === "card") {
  await render(CARD, [1200, 630], root + "public/og/card.jpg", false, true);
  wrote.push("public/og/card.jpg");
}
if (!only || only === "icons") {
  await render(icon(180, 0.1), [180, 180], root + "public/apple-touch-icon.png");
  await render(icon(192, 0.1), [192, 192], root + "public/icons/icon-192.png");
  await render(icon(512, 0.1), [512, 512], root + "public/icons/icon-512.png");
  await render(icon(512, 0.2), [512, 512], root + "public/icons/icon-maskable-512.png");
  const small = [];
  for (const size of [16, 32, 48]) small.push({ size, png: await render(`<body style="margin:0"><img src="${mark}" width="${size}" height="${size}" style="display:block">`, [size, size], undefined, true) });
  writeFileSync(root + "public/favicon.ico", ico(small));
  wrote.push("public/apple-touch-icon.png", "public/icons/icon-{192,512,maskable-512}.png", "public/favicon.ico");
}
await browser.close();
for (const f of wrote) console.log(f, f.includes("{") ? "" : `${(statSync(root + f).size / 1024).toFixed(0)} KB`);
