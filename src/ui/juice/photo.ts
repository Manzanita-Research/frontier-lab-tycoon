// Photo mode's state and the picture-taking. The flag lives in an Effect atom (the app's one state system) and is
// mirrored into `fx.photo` for the render side; the frame itself comes from PhotoFX (postprocessing), which is
// loaded on demand.
import { Atom } from "effect/unstable/reactivity";
import { debugParams, registry, send, sim } from "../../app/game";
import { photoAtom, photoBridge } from "../../render/fx/photoState";
import { cinema, fx } from "../../render/fx/state";
import { photoFileName, stampText } from "./stamp";

/** The last photo taken, for the polaroid that drops into the corner. */
export interface Shot {
  url: string;
  name: string;
  id: number;
}
export const shotAtom = Atom.make<Shot | null>(null);

export const isPhoto = () => registry.get(photoAtom);

export function setPhoto(on: boolean) {
  if (on === isPhoto()) return;
  registry.set(photoAtom, on);
  fx.photo = on;
  document.body.classList.toggle("photo", on);
  if (on) {
    cinema.cancel();
    cinema.trauma = 0;
    send({ type: "SET_TOOL", tool: null });
  } else {
    fx.hourOverride = debugParams.hour;
  }
}

export const togglePhoto = () => setPhoto(!isPhoto());

/** Draw the DOM thought bubbles that are on screen onto the picture, so it matches what the player sees. */
function drawBubbles(ctx: CanvasRenderingContext2D, scale: number) {
  for (const el of document.querySelectorAll<HTMLElement>(".world .bubble")) {
    const anchor = el.closest<HTMLElement>(".anchor");
    if (!anchor || anchor.style.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const cs = getComputedStyle(el);
    // A bubble caught mid pop-in is scaled by its animation; draw it at the size it is on screen.
    const k = el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
    const x = r.left * scale;
    const y = r.top * scale;
    const w = r.width * scale;
    const h = r.height * scale;
    const radius = parseFloat(cs.borderTopLeftRadius) * scale * k;
    const bw = parseFloat(cs.borderTopWidth) * scale * k;
    const fontPx = parseFloat(cs.fontSize) * scale * k;
    ctx.save();
    ctx.fillStyle = "rgba(58, 42, 28, 0.8)";
    roundRect(ctx, x, y + 3 * scale * k, w, h, radius);
    ctx.fill();
    ctx.fillStyle = cs.backgroundColor;
    ctx.strokeStyle = cs.borderTopColor;
    ctx.lineWidth = bw;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
    // The tail.
    const tx = x + w / 2;
    const ty = y + h;
    ctx.beginPath();
    ctx.moveTo(tx - 7 * scale * k, ty - bw / 2);
    ctx.lineTo(tx, ty + 9 * scale * k);
    ctx.lineTo(tx + 7 * scale * k, ty - bw / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - 7 * scale * k, ty);
    ctx.lineTo(tx, ty + 9 * scale * k);
    ctx.lineTo(tx + 7 * scale * k, ty);
    ctx.stroke();
    // Text, word by word at the exact place the browser laid it out.
    ctx.fillStyle = cs.color;
    ctx.font = `${cs.fontWeight} ${fontPx}px ${cs.fontFamily}`;
    ctx.textBaseline = "alphabetic";
    const node = el.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const range = document.createRange();
      const re = /\S+/g;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const wr = range.getBoundingClientRect();
        ctx.fillText(m[0], wr.left * scale, wr.bottom * scale - (wr.height * scale - fontPx) / 2 - fontPx * 0.2);
      }
    }
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The tiny stamp: "Frontier Lab Tycoon · {lab} · Y1 Mar 4", bottom right. */
function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  const px = Math.max(11, Math.round(h * 0.016));
  ctx.save();
  ctx.font = `800 ${px}px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width;
  const padX = px * 0.7;
  const bh = px * 1.75;
  const x = w - tw - padX * 2 - px;
  const y = h - bh - px;
  ctx.fillStyle = "rgba(58, 42, 28, 0.62)";
  roundRect(ctx, x, y, tw + padX * 2, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = "#fff3d6";
  ctx.fillText(text, x + padX, y + bh / 2 + px * 0.04);
  ctx.restore();
}

let seq = 0;

/** Take the picture: render one frame through the photo pipeline, add the bubbles and the stamp, save the PNG. */
export async function takePhoto(): Promise<Shot | null> {
  const source = photoBridge.render?.();
  if (!source) return null;
  const w = source.width;
  const h = source.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  drawBubbles(ctx, w / window.innerWidth);
  const world = sim.world;
  drawStamp(ctx, w, h, stampText(world.labName, world.day));
  const blob = await new Promise<Blob | null>((done) => out.toBlob(done, "image/png"));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const name = photoFileName(world.labName, world.day);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  const shot = { url, name, id: ++seq };
  const prev = registry.get(shotAtom);
  registry.set(shotAtom, shot);
  // The polaroid has moved on to the new photo; let the old one's memory go.
  if (prev) setTimeout(() => URL.revokeObjectURL(prev.url), 1000);
  return shot;
}
