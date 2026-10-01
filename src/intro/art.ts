// Placeholder art for the big box, painted on canvases (the art pass, M1, replaces the hero props with real art).
// Everything is procedural and seeded, so the shelf ships no image files and looks the same on every visit.
import { createRng } from "../sim/rng";
import { BIOS, COA, DISC_LABEL, EULA, HERO, OVERLAY_KEYS, REGISTRATION, SPLASH, STORE, type ShelfBox } from "./content";
import { CHAPTERS, type Block, type Page } from "./manual";

export const UI_FONT = "Nunito, system-ui, sans-serif";
export const RETRO_FONT = "W95FA, 'Courier New', monospace";

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d")!;

/** Wrap `text` to `width`, returning the lines. */
export function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** Set a font at `size`, or smaller if `text` would be wider than `width`. */
function fitFont(g: CanvasRenderingContext2D, text: string, width: number, weight: number, size: number, family = UI_FONT) {
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > width) g.font = `${weight} ${(size * width) / w}px ${family}`;
}

/** Text that shrinks until it fits `width` in at most `maxLines` lines. Returns the height used. */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, weight: number, maxLines: number, family = UI_FONT, lead = 1.02): number {
  let s = size;
  let lines: string[] = [];
  for (; s > 10; s -= 2) {
    g.font = `${weight} ${s}px ${family}`;
    lines = wrap(g, text, width);
    if (lines.length <= maxLines && lines.every((l) => g.measureText(l).width <= width)) break;
  }
  lines.forEach((l, i) => g.fillText(l, x, y + i * s * lead));
  return lines.length * s * lead;
}

function starburst(g: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, fill: string, stroke: string) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.78;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = r * 0.05;
  g.strokeStyle = stroke;
  g.stroke();
}

/** Chunky chrome-bevel lettering: a dark outline, a chrome gradient, a highlight edge. */
function chromeText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  g.font = `900 ${size}px ${UI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.lineJoin = "round";
  g.fillStyle = "#0b1440";
  g.fillText(text, x + size * 0.06, y + size * 0.08);
  g.lineWidth = size * 0.16;
  g.strokeStyle = "#0b1440";
  g.strokeText(text, x, y);
  const grad = g.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.45, "#c9d4e6");
  grad.addColorStop(0.5, "#5d6c86");
  grad.addColorStop(0.62, "#aab6ca");
  grad.addColorStop(1, "#f4f7fb");
  g.fillStyle = grad;
  g.fillText(text, x, y);
  g.lineWidth = size * 0.03;
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.strokeText(text, x, y - size * 0.02);
}

/** A little isometric campus: grass, paths, cream buildings with one accent each, tiny people and glowing agents. */
function diorama(g: CanvasRenderingContext2D, cx: number, cy: number, tile: number, seed: number, people = 90) {
  const rng = createRng(seed);
  const iso = (x: number, z: number) => [cx + (x - z) * tile, cy + (x + z) * tile * 0.5] as const;
  const N = 7;
  for (let z = -N; z <= N; z++)
    for (let x = -N; x <= N; x++) {
      const [px, py] = iso(x, z);
      const path = x === 0 || z === 1 || (z === -3 && x > -4 && x < 5);
      g.beginPath();
      g.moveTo(px, py - tile * 0.5);
      g.lineTo(px + tile, py);
      g.lineTo(px, py + tile * 0.5);
      g.lineTo(px - tile, py);
      g.closePath();
      g.fillStyle = path ? "#e8d3a2" : (x + z) % 2 === 0 ? "#63c05a" : "#58b24f";
      g.fill();
    }
  const block = (x: number, z: number, w: number, d: number, h: number, wall: string, roof: string) => {
    const [ax, ay] = iso(x, z);
    const [bx, by] = iso(x + w, z);
    const [cx2, cy2] = iso(x + w, z + d);
    const [dx, dy] = iso(x, z + d);
    const H = h * tile;
    g.fillStyle = shade(wall, 0.82);
    g.beginPath(); g.moveTo(dx, dy); g.lineTo(cx2, cy2); g.lineTo(cx2, cy2 - H); g.lineTo(dx, dy - H); g.fill();
    g.fillStyle = shade(wall, 0.68);
    g.beginPath(); g.moveTo(bx, by); g.lineTo(cx2, cy2); g.lineTo(cx2, cy2 - H); g.lineTo(bx, by - H); g.fill();
    g.fillStyle = roof;
    g.beginPath(); g.moveTo(ax, ay - H); g.lineTo(bx, by - H); g.lineTo(cx2, cy2 - H); g.lineTo(dx, dy - H); g.fill();
    // windows
    g.fillStyle = "rgba(120,200,255,0.9)";
    for (let i = 0.2; i < 0.9; i += 0.25) {
      const wx = dx + (cx2 - dx) * i;
      const wy = dy + (cy2 - dy) * i;
      g.fillRect(wx, wy - H * 0.7, tile * 0.18, H * 0.25);
    }
  };
  block(-5, -6, 3, 2, 2.2, "#f4ecd8", "#e2533b");
  block(2, -6, 3, 2, 1.6, "#f4ecd8", "#3b7be2");
  block(-5, 2, 2, 2, 1.2, "#f4ecd8", "#f07ab8");
  block(2, 2, 3, 3, 2.8, "#f4ecd8", "#8a5ae2");
  block(-3, -2, 2, 1, 1, "#f4ecd8", "#f2b233");
  block(3, -2, 1, 1, 3.6, "#dfe6ee", "#6ff0ff");
  // tiny people and agents on the paths
  for (let i = 0; i < people; i++) {
    const onX = rng.chance(0.5);
    const t = rng.next() * 12 - 6;
    const [px, py] = onX ? iso(0.2 + rng.next() * 0.6, t) : iso(t, 1.2 + rng.next() * 0.6);
    const agent = rng.chance(0.3);
    if (agent) {
      g.fillStyle = "rgba(111,240,255,0.35)";
      g.beginPath(); g.arc(px, py - tile * 0.2, tile * 0.28, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6ff0ff";
    } else g.fillStyle = rng.pick(["#2b2b3a", "#e2533b", "#3b7be2", "#f2b233", "#5a3a8a", "#ffffff"]);
    g.fillRect(px - tile * 0.07, py - tile * 0.34, tile * 0.14, tile * 0.3);
    g.fillStyle = "#f2c6a0";
    g.beginPath(); g.arc(px, py - tile * 0.4, tile * 0.08, 0, Math.PI * 2); g.fill();
  }
  // a protester at the gate, with a sign
  const [gx, gy] = iso(0.5, 6.5);
  g.fillStyle = "#fff";
  g.fillRect(gx - tile * 0.45, gy - tile * 1.3, tile * 0.9, tile * 0.45);
  g.fillStyle = "#c8102e";
  g.font = `900 ${tile * 0.28}px ${UI_FONT}`;
  g.textAlign = "center";
  g.fillText("SLOW DOWN", gx, gy - tile * 0.98);
  g.fillStyle = "#553";
  g.fillRect(gx - tile * 0.03, gy - tile * 0.85, tile * 0.06, tile * 0.6);
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const gg = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${gg},${b})`;
}

/** A spine: the title on its side. */
export function paintSpine(title: string, colors: [string, string, string], c = canvas(128, 960)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-Math.PI / 2);
  g.fillStyle = colors[2];
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${W * 0.34}px ${UI_FONT}`;
  let s = W * 0.34;
  while (g.measureText(title).width > H * 0.9 && s > 12) g.font = `900 ${(s -= 2)}px ${UI_FONT}`;
  g.fillText(title, 0, 0);
  g.restore();
  return c;
}

/** Someone else's box on the shelf: gradient, a motif, a big title, a CD-ROM band. */
export function paintShelfFront(box: ShelfBox, c = canvas(384, 480)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  const [top, bottom, ink] = box.colors;
  const grad = g.createLinearGradient(0, 0, W * 0.3, H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const rng = createRng([...box.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
  g.save();
  g.globalAlpha = 0.35;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 4;
  const cy = H * 0.62;
  switch (box.motif) {
    case "grid":
      for (let x = 0; x < W; x += 32) for (let y = H * 0.4; y < H * 0.88; y += 32) if ((x + y) % 64 === 0) g.fillRect(x, y, 32, 32);
      break;
    case "rings":
      for (let r = 20; r < W * 0.6; r += 26) { g.beginPath(); g.arc(W / 2, cy, r, 0, Math.PI * 2); g.stroke(); }
      break;
    case "stars":
      for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rng.next() * W, H * 0.35 + rng.next() * H * 0.55, 1 + rng.next() * 4, 0, Math.PI * 2); g.fill(); }
      break;
    case "chart":
      g.beginPath(); g.moveTo(W * 0.1, H * 0.85);
      for (let i = 1; i <= 8; i++) g.lineTo(W * 0.1 + i * W * 0.1, H * 0.85 - Math.pow(i / 8, 3) * H * 0.45);
      g.lineWidth = 10; g.stroke();
      break;
    case "blob":
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(W * (0.2 + rng.next() * 0.6), H * (0.45 + rng.next() * 0.4), 20 + rng.next() * 50, 0, Math.PI * 2); g.fill(); }
      break;
    case "stripes":
      for (let i = -H; i < W; i += 40) { g.beginPath(); g.moveTo(i, H); g.lineTo(i + H * 0.6, H * 0.35); g.lineWidth = 14; g.stroke(); }
      break;
    case "sun":
      g.beginPath(); g.arc(W / 2, cy, W * 0.18, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * W * 0.22, cy + Math.sin(a) * W * 0.22); g.lineTo(W / 2 + Math.cos(a) * W * 0.34, cy + Math.sin(a) * W * 0.34); g.stroke(); }
      break;
  }
  g.restore();
  g.fillStyle = ink;
  g.textAlign = "center";
  fitText(g, box.title, W / 2, H * 0.14, W * 0.86, W * 0.13, 900, 3);
  g.font = `700 ${W * 0.05}px ${UI_FONT}`;
  g.globalAlpha = 0.9;
  wrap(g, box.sub, W * 0.86).forEach((l, i) => g.fillText(l, W / 2, H * 0.42 + i * W * 0.06));
  g.globalAlpha = 1;
  g.fillStyle = "rgba(0,0,0,0.75)";
  g.fillRect(0, H * 0.92, W, H * 0.08);
  g.fillStyle = "#fff";
  g.font = `800 ${W * 0.045}px ${UI_FONT}`;
  g.fillText("CD-ROM · for Frontier 95", W / 2, H * 0.975);
  return c;
}

/** A round sticker: "NEW!" starburst or a price. */
export function paintSticker(kind: "new" | "price", c = canvas(256, 256)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W } = c;
  g.clearRect(0, 0, W, W);
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (kind === "new") {
    starburst(g, W / 2, W / 2, W * 0.48, 14, "#c8102e", "#ffe14d");
    g.fillStyle = "#ffe14d";
    g.font = `900 ${W * 0.26}px ${UI_FONT}`;
    g.fillText(HERO.sticker, W / 2, W * 0.53);
  } else {
    g.fillStyle = "#fff36b";
    g.beginPath(); g.roundRect(W * 0.04, W * 0.24, W * 0.92, W * 0.52, W * 0.06); g.fill();
    g.strokeStyle = "#e0a800"; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#c8102e";
    g.font = `900 ${W * 0.2}px ${UI_FONT}`;
    g.fillText(HERO.price, W / 2, W * 0.53);
    g.font = `800 ${W * 0.07}px ${UI_FONT}`;
    g.fillStyle = "#000";
    g.fillText("SALE", W / 2, W * 0.33);
  }
  return c;
}

/** The store's header sign above the shelf. */
export function paintSign(c = canvas(1024, 160)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#c8102e";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#ffe14d";
  g.fillRect(0, H * 0.82, W, H * 0.18);
  g.fillStyle = "#fff";
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.font = `900 ${H * 0.4}px ${UI_FONT}`;
  g.fillText(STORE.name, W * 0.03, H * 0.42);
  // The aisle name takes what's left of the line, shrunk to fit.
  const room = W * 0.94 - g.measureText(STORE.name).width - W * 0.05;
  g.textAlign = "right";
  fitFont(g, STORE.aisle, room, 800, H * 0.22);
  g.fillText(STORE.aisle, W * 0.97, H * 0.42);
  g.fillStyle = "#c8102e";
  g.textAlign = "center";
  g.font = `900 ${H * 0.13}px ${UI_FONT}`;
  g.fillText(STORE.sign, W / 2, H * 0.91);
  return c;
}

/** The shelf-talker card clipped under our box. */
export function paintTalker(c = canvas(512, 128)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#fffbe0";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#c8102e"; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  g.fillStyle = "#c8102e";
  g.textAlign = "center";
  fitText(g, STORE.talker, W / 2, H * 0.4, W * 0.9, H * 0.26, 800, 2);
  return c;
}

/** The cardboard scientist's speech balloon (FLT-89), with a "NEW!" burst on its corner; `back` is its plain card back. */
export function paintBalloon(back = false, c = canvas(512, 352)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.clearRect(0, 0, W, H);
  g.fillStyle = back ? "#b08a5c" : "#fff";
  g.strokeStyle = back ? "#8a6a42" : "#111";
  g.lineWidth = 8;
  // The tail points down and right, at the scientist's head.
  g.beginPath();
  g.roundRect(W * 0.17, H * 0.14, W * 0.8, H * 0.58, H * 0.14);
  g.moveTo(W * 0.64, H * 0.71);
  g.lineTo(W * 0.9, H * 0.97);
  g.lineTo(W * 0.8, H * 0.71);
  g.fill();
  g.stroke();
  // Paint over the tail's join, so the balloon reads as one outline.
  g.fillRect(W * 0.64 + 5, H * 0.66, W * 0.16 - 10, H * 0.08);
  if (back) return c;
  g.fillStyle = "#111";
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitText(g, STORE.standee, W * 0.6, H * 0.34, W * 0.64, H * 0.17, 900, 2);
  g.font = `italic 700 ${H * 0.07}px ${UI_FONT}`;
  g.fillText(STORE.standeeSmall, W * 0.6, H * 0.64);
  starburst(g, W * 0.13, H * 0.17, H * 0.16, 12, "#c8102e", "#ffe14d");
  g.fillStyle = "#ffe14d";
  g.font = `900 ${H * 0.085}px ${UI_FONT}`;
  g.fillText(HERO.sticker, W * 0.13, H * 0.18);
  return c;
}

/** The card on the bargain bin (FLT-89). */
export function paintBinCard(c = canvas(512, 256)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#ffe14d";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "#c8102e";
  g.lineWidth = 10;
  g.strokeRect(5, 5, W - 10, H - 10);
  g.fillStyle = "#c8102e";
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitFont(g, STORE.bin.head, W * 0.86, 900, H * 0.2);
  g.fillText(STORE.bin.head, W / 2, H * 0.19);
  g.font = `900 ${H * 0.4}px ${UI_FONT}`;
  g.fillText(STORE.bin.price, W / 2, H * 0.52);
  g.fillStyle = "#111";
  fitFont(g, STORE.bin.sub, W * 0.86, 800, H * 0.13);
  g.fillText(STORE.bin.sub, W / 2, H * 0.83);
  return c;
}

/** The linoleum floor tile. */
export function paintFloor(c = canvas(256, 256)): HTMLCanvasElement {
  const g = ctx2d(c);
  const rng = createRng(3);
  const s = c.width / 4;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#e9e4d6" : "#d8d1bf";
      g.fillRect(x * s, y * s, s, s);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = rng.chance(0.5) ? "rgba(90,80,60,0.15)" : "rgba(255,255,255,0.3)";
        g.fillRect(x * s + rng.next() * s, y * s + rng.next() * s, 2, 2);
      }
    }
  return c;
}

// ---- The manual ------------------------------------------------------------------------------------------------

const PAPER = "#fbf7ec";
const INK = "#1d1a14";

/** One manual page. The cover and back cover are art; the rest is laid out from blocks. */
export function paintPage(page: Page, index: number, c = canvas(600, 780)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  if (page.kind === "cover") return paintManualCover(c);
  if (page.kind === "back") return paintManualBack(c);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);
  // a spine shadow on the inner edge
  const left = index % 2 === 1;
  const sg = g.createLinearGradient(left ? W : 0, 0, left ? W - 40 : 40, 0);
  sg.addColorStop(0, "rgba(0,0,0,0.18)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sg;
  g.fillRect(0, 0, W, H);
  const M = W * 0.1;
  let y = H * 0.08;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  if (page.chapter) {
    g.fillStyle = "#c8102e";
    g.font = `900 ${W * 0.032}px ${UI_FONT}`;
    g.fillText(page.chapter.toUpperCase(), M, y);
    y += W * 0.06;
  }
  if (page.title) {
    g.fillStyle = "#0b1440";
    g.font = `900 ${W * 0.07}px ${UI_FONT}`;
    g.fillText(page.title, M, y + W * 0.03);
    y += W * 0.07;
    g.fillStyle = "#ffe14d";
    g.fillRect(M, y - W * 0.01, W * 0.3, W * 0.012);
    y += W * 0.05;
  }
  for (const b of page.blocks) y = paintBlock(g, b, M, y, W - M * 2) + W * 0.028;
  if (page.folio) {
    g.fillStyle = "#6b6456";
    g.font = `700 ${W * 0.026}px ${UI_FONT}`;
    g.textAlign = left ? "left" : "right";
    g.fillText(String(page.folio), left ? M : W - M, H - H * 0.04);
  }
  return c;
}

function paintBlock(g: CanvasRenderingContext2D, b: Block, x: number, y: number, w: number): number {
  const size = w * 0.042;
  const lead = size * 1.38;
  g.textAlign = "left";
  switch (b.t) {
    case "h":
      g.fillStyle = "#0b1440";
      g.font = `900 ${size * 1.2}px ${UI_FONT}`;
      g.fillText(b.text, x, y + size);
      return y + size * 1.6;
    case "p": {
      g.fillStyle = INK;
      g.font = `600 ${size}px ${UI_FONT}`;
      const lines = wrap(g, b.text, w);
      lines.forEach((l, i) => g.fillText(l, x, y + size + i * lead));
      return y + lines.length * lead;
    }
    case "list": {
      g.font = `600 ${size}px ${UI_FONT}`;
      let yy = y;
      b.items.forEach((item, i) => {
        g.fillStyle = "#c8102e";
        g.font = `900 ${size}px ${UI_FONT}`;
        g.fillText(b.numbered ? `${i + 1}.` : "•", x, yy + size);
        g.fillStyle = INK;
        g.font = `600 ${size}px ${UI_FONT}`;
        const lines = wrap(g, item, w - size * 1.6);
        lines.forEach((l, j) => g.fillText(l, x + size * 1.6, yy + size + j * lead));
        yy += lines.length * lead + size * 0.3;
      });
      return yy;
    }
    case "tip": {
      g.font = `700 ${size}px ${UI_FONT}`;
      const lines = wrap(g, b.text, w - size * 3.2);
      const h = lines.length * lead + size * 1.2;
      g.fillStyle = "#fff6c2";
      g.fillRect(x, y, w, h);
      g.fillStyle = "#e0a800";
      g.fillRect(x, y, size * 0.4, h);
      g.fillStyle = "#c8102e";
      g.font = `900 ${size * 1.3}px ${UI_FONT}`;
      g.fillText("!", x + size * 1.1, y + size * 1.7);
      g.fillStyle = INK;
      g.font = `700 ${size}px ${UI_FONT}`;
      lines.forEach((l, i) => g.fillText(l, x + size * 2.4, y + size * 1.5 + i * lead));
      return y + h;
    }
    case "code": {
      const cs = size * 0.78;
      g.font = `400 ${cs}px ${RETRO_FONT}`;
      const lines = b.text.split("\n");
      const h = lines.length * cs * 1.25 + cs;
      g.fillStyle = "#1d2433";
      g.fillRect(x, y, w, h);
      g.fillStyle = "#b8f5c8";
      lines.forEach((l, i) => g.fillText(l, x + cs * 0.6, y + cs * 1.3 + i * cs * 1.25));
      return y + h;
    }
    case "table": {
      let yy = y;
      for (const [k, v] of b.rows) {
        g.font = `900 ${size}px ${UI_FONT}`;
        g.fillStyle = "#0b1440";
        const kw = Math.max(w * 0.28, 0);
        const klines = wrap(g, k, kw - size * 0.4);
        g.font = `600 ${size}px ${UI_FONT}`;
        const vlines = wrap(g, v, w - kw);
        const n = Math.max(klines.length, vlines.length);
        g.fillStyle = "rgba(11,20,64,0.06)";
        g.fillRect(x, yy, w, n * lead + size * 0.5);
        g.fillStyle = "#0b1440";
        g.font = `900 ${size}px ${UI_FONT}`;
        klines.forEach((l, i) => g.fillText(l, x + size * 0.3, yy + size * 1.1 + i * lead));
        g.fillStyle = INK;
        g.font = `600 ${size}px ${UI_FONT}`;
        vlines.forEach((l, i) => g.fillText(l, x + kw, yy + size * 1.1 + i * lead));
        yy += n * lead + size * 0.7;
      }
      return yy;
    }
    case "stamp": {
      g.save();
      g.translate(x + w * 0.62, y + size * 1.4);
      g.rotate(-0.08);
      g.strokeStyle = "rgba(200,16,46,0.8)";
      g.fillStyle = "rgba(200,16,46,0.8)";
      g.lineWidth = 4;
      g.font = `900 ${size * 1.2}px ${UI_FONT}`;
      const tw = g.measureText(b.text).width;
      g.strokeRect(-tw / 2 - size * 0.5, -size * 1.2, tw + size, size * 1.8);
      g.textAlign = "center";
      g.fillText(b.text, 0, 0);
      g.restore();
      return y + size * 3;
    }
  }
}

function paintManualCover(c: HTMLCanvasElement): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#0b1440";
  g.fillRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.rect(W * 0.06, H * 0.3, W * 0.88, H * 0.48); g.clip();
  g.fillStyle = "#58b24f"; g.fillRect(0, 0, W, H);
  diorama(g, W * 0.5, H * 0.5, W * 0.05, 21, 60);
  g.restore();
  chromeText(g, "FRONTIER LAB", W / 2, H * 0.13, W * 0.11);
  chromeText(g, "TYCOON", W / 2, H * 0.24, W * 0.16);
  g.fillStyle = "#ffe14d";
  g.textAlign = "center";
  g.font = `900 ${W * 0.06}px ${UI_FONT}`;
  g.fillText("Player's Guide", W / 2, H * 0.86);
  g.fillStyle = "#fff";
  g.font = `700 ${W * 0.035}px ${UI_FONT}`;
  g.fillText("& Reference Manual · for Frontier 95", W / 2, H * 0.91);
  return c;
}

function paintManualBack(c: HTMLCanvasElement): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#0b1440";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.font = `800 ${W * 0.045}px ${UI_FONT}`;
  g.fillText(COA.maker, W / 2, H * 0.84);
  g.font = `700 ${W * 0.03}px ${UI_FONT}`;
  g.fillStyle = "#c0c8e0";
  g.fillText("Printed on 100% recycled training data.", W / 2, H * 0.89);
  g.fillText(`Contents: ${CHAPTERS.length} chapters, ${CHAPTERS.filter((ch) => ch.printed).length} printed.`, W / 2, H * 0.93);
  return c;
}

// ---- Paper in the box ------------------------------------------------------------------------------------------

export function paintCard(c = canvas(600, 400)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#eaf6ff";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#0b3d91";
  g.fillRect(0, 0, W, H * 0.16);
  g.fillStyle = "#fff";
  g.font = `900 ${H * 0.08}px ${UI_FONT}`;
  g.textAlign = "left";
  g.fillText(REGISTRATION.title, W * 0.05, H * 0.11);
  g.fillStyle = "#0b1440";
  g.font = `700 ${H * 0.06}px ${UI_FONT}`;
  REGISTRATION.lines.forEach((l, i) => fitText(g, l, W * 0.05, H * (0.3 + i * 0.13), W * 0.9, H * 0.06, 700, 1));
  g.fillStyle = "#555";
  fitText(g, REGISTRATION.fine, W * 0.05, H * 0.84, W * 0.9, H * 0.045, 600, 2);
  return c;
}

export function paintEula(c = canvas(420, 600)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#f7f7f2";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#000";
  g.textAlign = "center";
  g.font = `900 ${W * 0.05}px ${UI_FONT}`;
  g.fillText(EULA.title, W / 2, H * 0.07);
  g.textAlign = "left";
  let y = H * 0.12;
  for (const p of EULA.body) y += fitText(g, p, W * 0.07, y, W * 0.86, W * 0.034, 600, 4, UI_FONT, 1.3) + H * 0.015;
  // the seal band
  g.fillStyle = "#006b5a";
  g.fillRect(0, H * 0.72, W, H * 0.14);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  fitText(g, EULA.seal, W / 2, H * 0.775, W * 0.9, W * 0.042, 900, 2);
  return c;
}

export function paintOverlay(c = canvas(1024, 160)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#ffe14d";
  g.fillRect(0, 0, W, H);
  const kw = W / OVERLAY_KEYS.length;
  OVERLAY_KEYS.forEach((k, i) => {
    g.strokeStyle = "#0b1440";
    g.lineWidth = 3;
    g.strokeRect(i * kw + 4, 8, kw - 8, H - 16);
    g.fillStyle = "#0b1440";
    g.textAlign = "center";
    const [key, ...rest] = k.split(" ");
    g.font = `900 ${H * 0.2}px ${UI_FONT}`;
    g.fillText(key!, i * kw + kw / 2, H * 0.35);
    g.fillStyle = "#c8102e";
    fitText(g, rest.join(" "), i * kw + kw / 2, H * 0.58, kw - 16, H * 0.15, 800, 2);
  });
  return c;
}

export function paintFloppy(n: number, c = canvas(256, 256)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W } = c;
  g.fillStyle = "#1b1b1f";
  g.fillRect(0, 0, W, W);
  g.fillStyle = "#b9bec6";
  g.fillRect(W * 0.28, 0, W * 0.44, W * 0.32);
  g.fillStyle = "#1b1b1f";
  g.fillRect(W * 0.52, W * 0.04, W * 0.1, W * 0.22);
  g.fillStyle = "#fffdf2";
  g.fillRect(W * 0.1, W * 0.42, W * 0.8, W * 0.52);
  g.fillStyle = "#c8102e";
  g.fillRect(W * 0.1, W * 0.42, W * 0.8, W * 0.06);
  g.fillStyle = "#0b1440";
  g.textAlign = "center";
  g.font = `900 ${W * 0.08}px ${UI_FONT}`;
  g.fillText("FRONTIER LAB", W / 2, W * 0.6);
  g.fillText("TYCOON", W / 2, W * 0.7);
  g.font = `800 ${W * 0.08}px ${UI_FONT}`;
  g.fillStyle = "#c8102e";
  g.fillText(`Disk ${n} of 7`, W / 2, W * 0.84);
  return c;
}

/** The CD label: a circle, with a hole. */
/**
 * The disc's printed label (FLT-95), on a transparent canvas the disc's shader lays over the silver: a few spot colours
 * screened straight onto the disc, as a 1997 pressing plant would. The top half is the sunrise (the hub is the sun,
 * coming up behind the title); the bottom half is ink on bare silver, so the data's rainbow shows through around it.
 * `inner` and `outer` are the printable band, as fractions of the disc's radius.
 */
export function paintDisc(inner: number, outer: number, c = canvas(1024, 1024)): HTMLCanvasElement {
  const g = ctx2d(c);
  const W = c.width;
  const o = W / 2;
  const R = W / 2;
  const NAVY = "#000080";
  const GOLD = "#ffe14d";
  const horizon = o + R * 0.04;
  g.clearRect(0, 0, W, W);
  const band = () => {
    g.beginPath();
    g.arc(o, o, R * outer, 0, Math.PI * 2);
    g.arc(o, o, R * inner, 0, Math.PI * 2, true);
  };

  g.save();
  band();
  g.clip();
  // The sky, down to the horizon, with a scatter of stars still out.
  const sky = g.createLinearGradient(0, o - R, 0, horizon);
  sky.addColorStop(0, "#00004a");
  sky.addColorStop(0.6, NAVY);
  sky.addColorStop(1, "#008080");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);
  const rng = createRng(95);
  g.fillStyle = "#fff6d6";
  for (let i = 0; i < 70; i++) {
    const x = rng.next() * W;
    const y = rng.next() * (horizon - R * 0.5);
    g.fillRect(x, y, R * 0.006, R * 0.006);
  }
  // The rays, and the sun coming up behind the hub.
  g.fillStyle = "rgba(255,225,77,0.32)";
  for (let i = 0; i < 13; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 13);
    g.beginPath();
    g.moveTo(o, horizon);
    g.arc(o, horizon, R, a - 0.05, a + 0.05);
    g.closePath();
    g.fill();
  }
  g.fillStyle = "#ff9f1c";
  g.beginPath();
  g.arc(o, horizon, R * 0.6, Math.PI, 0);
  g.fill();
  g.fillStyle = GOLD;
  g.beginPath();
  g.arc(o, horizon, R * 0.57, Math.PI, 0);
  g.fill();
  // The horizon, and the sun's road across the water, printed straight onto the silver.
  g.fillRect(0, horizon, W, R * 0.018);
  g.fillStyle = NAVY;
  for (let i = 0; i < 3; i++) g.fillRect(0, horizon + R * (0.06 + i * 0.055), W, R * (0.014 - i * 0.003));
  g.restore();

  // The title, round the top.
  g.font = `900 ${R * 0.13}px ${UI_FONT}`;
  g.lineJoin = "round";
  g.lineWidth = R * 0.022;
  g.strokeStyle = "#00003a";
  arcText(g, DISC_LABEL.title.join(" "), o, o, R * 0.79, true, (ch, x, y) => {
    g.strokeText(ch, x, y);
    g.fillStyle = "#fff6d6";
    g.fillText(ch, x, y);
  });

  // Below the hub, ink on silver: the platform, the badges either side, the warning.
  g.fillStyle = NAVY;
  g.textAlign = "center";
  g.textBaseline = "middle";
  fitFont(g, DISC_LABEL.platform, R * 1.2, 900, R * 0.082);
  g.fillText(DISC_LABEL.platform, o, o + R * 0.64);
  paintSunrise(g, o - R * 0.66, o + R * 0.3, R * 0.13);
  const bw = R * 0.34;
  const bh = R * 0.17;
  const bx = o + R * 0.66 - bw / 2;
  const by = o + R * 0.3 - bh / 2;
  g.fillStyle = NAVY;
  g.beginPath();
  g.roundRect(bx, by, bw, bh, R * 0.03);
  g.fill();
  g.fillStyle = GOLD;
  fitFont(g, DISC_LABEL.disc, bw * 0.84, 900, R * 0.05);
  g.fillText(DISC_LABEL.disc, bx + bw / 2, by + bh * 0.33);
  fitFont(g, DISC_LABEL.badge, bw * 0.84, 800, R * 0.042);
  g.fillText(DISC_LABEL.badge, bx + bw / 2, by + bh * 0.7);
  // "Do not microwave", with the sign: a microwave, struck through.
  g.fillStyle = NAVY;
  g.font = `800 ${R * 0.05}px ${UI_FONT}`;
  const warnW = g.measureText(DISC_LABEL.warning).width;
  const icon = R * 0.075;
  const wy = o + R * 0.78;
  const ix = o - (warnW + icon * 1.3) / 2;
  g.fillText(DISC_LABEL.warning, ix + icon * 1.3 + warnW / 2, wy);
  g.lineWidth = R * 0.008;
  g.strokeStyle = NAVY;
  g.strokeRect(ix, wy - icon * 0.35, icon, icon * 0.7);
  g.fillRect(ix + icon * 0.12, wy - icon * 0.22, icon * 0.5, icon * 0.44);
  g.beginPath();
  g.arc(ix + icon * 0.82, wy, icon * 0.07, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#d4202a";
  g.lineWidth = R * 0.012;
  g.beginPath();
  g.arc(ix + icon / 2, wy, icon * 0.62, 0, Math.PI * 2);
  g.moveTo(ix + icon / 2 - icon * 0.44, wy - icon * 0.44);
  g.lineTo(ix + icon / 2 + icon * 0.44, wy + icon * 0.44);
  g.stroke();

  // The matrix code, etched faintly into the mirror band inside the print.
  g.fillStyle = "rgba(40,44,56,0.4)";
  g.font = `700 ${R * 0.024}px ${UI_FONT}`;
  arcText(g, DISC_LABEL.matrix, o, o, R * (inner - 0.06), true, (ch, x, y) => g.fillText(ch, x, y));
  // The microprint round the rim, and the plant's keylines at either edge of the print.
  g.fillStyle = NAVY;
  g.font = `700 ${R * 0.03}px ${UI_FONT}`;
  arcText(g, DISC_LABEL.rim, o, o, R * 0.9, false, (ch, x, y) => g.fillText(ch, x, y));
  g.strokeStyle = NAVY;
  g.lineWidth = R * 0.006;
  for (const at of [inner + 0.008, outer - 0.004]) {
    g.beginPath();
    g.arc(o, o, R * at, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

/** Text set round a circle about (cx, cy), upright: over the top (reading outward from `radius`), or under the bottom. */
function arcText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, radius: number, top: boolean, draw: (ch: string, x: number, y: number) => void) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  let at = -widths.reduce((a, b) => a + b, 0) / radius / 2;
  g.save();
  g.translate(cx, cy);
  g.textAlign = "center";
  g.textBaseline = top ? "alphabetic" : "top";
  chars.forEach((ch, i) => {
    const a = at + widths[i]! / 2 / radius;
    g.save();
    g.rotate(top ? a : -a);
    draw(ch, 0, top ? -radius : radius);
    g.restore();
    at += widths[i]! / radius;
  });
  g.restore();
}

export function paintKeyboard(c = canvas(512, 160)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#d9d2bd";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#ece6d4";
  const k = W / 20;
  for (let r = 0; r < 5; r++)
    for (let i = 0; i < 19; i++) {
      if (r === 4 && i > 4 && i < 13) continue;
      g.fillRect(i * k + k * 0.55, r * (H / 5.4) + 8, k * 0.8, H / 5.4 - 6);
    }
  g.fillRect(5 * k + k * 0.55, 4 * (H / 5.4) + 8, 8 * k - k * 0.2, H / 5.4 - 6);
  return c;
}

/**
 * The COA's printed layer: the label and this visitor's key, on a transparent canvas the shader lays over the paper art.
 * The rest of the certificate (title, guilloché, microprint) is printed on the art; `box` is its key panel (0..1, y down).
 */
export function paintCoaText(key: string, box: { x: number; y: number; w: number; h: number }, c = canvas(1400, 1000)): HTMLCanvasElement {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.clearRect(0, 0, W, H);
  const x = box.x * W + box.w * W * 0.04;
  const y = box.y * H;
  const h = box.h * H;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#12352a";
  g.font = `800 ${h * 0.2}px ${UI_FONT}`;
  g.fillText(COA.keyLabel, x, y + h * 0.36);
  fitFont(g, key, box.w * W * 0.92, 400, h * 0.36, RETRO_FONT);
  g.fillStyle = "#000";
  g.fillText(key, x, y + h * 0.8);
  return c;
}

// ---- The CRT --------------------------------------------------------------------------------------------------

/** The BIOS POST, `lines` lines in, with the memory counter at `mem`. 640x480, like it should be. */
export function paintBios(c: HTMLCanvasElement, lines: number, mem: number, key: string) {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const size = 18;
  g.font = `400 ${size}px ${RETRO_FONT}`;
  g.textAlign = "left";
  g.textBaseline = "top";
  // the energy-star-ish logo, top right: an invented one
  g.fillStyle = "#3aa0ff";
  g.fillRect(W - 140, 36, 96, 56);
  g.fillStyle = "#ffe14d";
  g.font = `400 ${size * 1.6}px ${RETRO_FONT}`;
  g.fillText("F95", W - 126, 48);
  g.font = `400 ${size}px ${RETRO_FONT}`;
  g.fillStyle = "#c0c0c0";
  // Generous margins: the tube's curve eats the corners.
  const X = 44;
  const Y = 40;
  BIOS.header.forEach((l, i) => g.fillText(l, X, Y + i * (size + 4)));
  const all = BIOS.lines.map((l) => l.replace("{mem}", String(mem)).replace("{key}", key));
  all.slice(0, lines).forEach((l, i) => {
    g.fillStyle = l.includes("GENUINE") || l.includes("640K") ? "#ffffff" : "#c0c0c0";
    g.fillText(l, X, Y + (BIOS.header.length + i) * (size + 4));
  });
  g.fillStyle = "#c0c0c0";
  g.fillText(BIOS.footer, X, H - size - Y);
}

/** The Frontier 95 splash: teal sky, the flag-less logo (an invented one: four panes and a comet), "Starting...". */
export function paintSplash(c: HTMLCanvasElement, t: number) {
  const g = ctx2d(c);
  const { width: W, height: H } = c;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#5ec8e8");
  grad.addColorStop(1, "#1d7fa6");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // clouds
  g.fillStyle = "rgba(255,255,255,0.7)";
  for (const [x, y, r] of [[90, 90, 30], [120, 80, 40], [160, 95, 28], [470, 380, 30], [510, 370, 44], [550, 385, 30]] as const) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // the logo: the sunrise
  paintSunrise(g, W / 2 - 110, H / 2 - 4, 62);
  g.fillStyle = "#fff";
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.font = `400 20px ${RETRO_FONT}`;
  g.fillText("Frontier", W / 2 - 40, H / 2 - 22);
  g.font = `400 64px ${RETRO_FONT}`;
  g.fillText(SPLASH.name.replace("Frontier ", ""), W / 2 - 42, H / 2 + 40);
  g.font = `400 18px ${RETRO_FONT}`;
  g.textAlign = "center";
  g.fillText(SPLASH.sub, W / 2, H - 70);
  // the progress stripe crawling along the bottom
  const band = g.createLinearGradient(0, 0, W, 0);
  const o = (t * 0.6) % 1;
  for (let i = 0; i <= 4; i++) band.addColorStop(i / 4, ["#000080", "#3aa0ff", "#fff", "#3aa0ff", "#000080"][(i + Math.floor(o * 5)) % 5]!);
  g.fillStyle = band;
  g.fillRect(0, H - 24, W, 24);
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.font = `400 12px ${RETRO_FONT}`;
  g.fillText(SPLASH.maker, W / 2, H - 40);
}

/**
 * Frontier 95's mark: a sun coming up over the water, in a ring. Original (the box's "Frontier 95 compatible" badge
 * shows the same sunrise), and drawn where a certain four-pane flag would have been.
 */
export function paintSunrise(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  const sky = g.createLinearGradient(0, y - r, 0, y + r * 0.12);
  sky.addColorStop(0, "#000080");
  sky.addColorStop(1, "#008080");
  g.fillStyle = sky;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  const horizon = y + r * 0.12;
  // rays
  g.fillStyle = "rgba(255,225,77,0.55)";
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    g.beginPath();
    g.moveTo(x, horizon);
    g.arc(x, horizon, r * 1.2, a - 0.07, a + 0.07);
    g.closePath();
    g.fill();
  }
  // the sun
  g.fillStyle = "#ffe14d";
  g.beginPath();
  g.arc(x, horizon, r * 0.42, Math.PI, 0);
  g.fill();
  // the water, and the sun's road across it
  g.fillStyle = "#000080";
  g.fillRect(x - r, horizon, r * 2, r);
  g.fillStyle = "#ffe14d";
  for (let i = 0; i < 4; i++) {
    const w = r * (0.7 - i * 0.15);
    g.fillRect(x - w / 2, horizon + r * (0.1 + i * 0.17), w, r * 0.06);
  }
  g.restore();
  g.strokeStyle = "#fff";
  g.lineWidth = Math.max(2, r * 0.06);
  g.beginPath();
  g.arc(x, y, r - g.lineWidth / 2, 0, Math.PI * 2);
  g.stroke();
}
