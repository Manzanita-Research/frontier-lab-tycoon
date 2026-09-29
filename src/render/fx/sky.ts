// The sky as a picture: gradient, stars and a moon on a 2D canvas. Photo mode uses it as the scene background, so
// the tilt-shift blur and the saved PNG have a real sky behind the diorama instead of transparency.
import { createRng } from "../../sim/rng";
import { ambience, css } from "./clock";

const STAR_COUNT = 90;
let stars: { x: number; y: number; r: number; tw: number }[] | null = null;

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, hour: number) {
  const a = ambience(hour);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(a.skyTop));
  g.addColorStop(0.45, css(a.skyMid));
  g.addColorStop(1, css(a.skyBottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (a.night < 0.15) return;
  if (!stars) {
    const rng = createRng(77);
    stars = Array.from({ length: STAR_COUNT }, () => ({ x: rng.next(), y: rng.next() * 0.62, r: 0.8 + rng.next() * 1.6, tw: rng.next() }));
  }
  const k = Math.min(1, a.night * 1.2 - 0.15);
  ctx.save();
  ctx.shadowColor = "rgba(200, 220, 255, 0.8)";
  ctx.shadowBlur = 6;
  for (const s of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.45 + 0.55 * s.tw) * k})`;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r * (h / 900 + 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // A crescent moon: a pale disc with a bite taken out of it.
  const mr = Math.max(20, h * 0.03);
  const mx = w * 0.88;
  const my = h * 0.13;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a.night * 1.4 - 0.3);
  ctx.shadowColor = "rgba(255, 248, 220, 0.5)";
  ctx.shadowBlur = mr;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(mx - mr * 2, my - mr * 2, mr * 4, mr * 4);
  ctx.arc(mx + mr * 0.42, my - mr * 0.28, mr * 0.9, 0, Math.PI * 2, true);
  ctx.fillStyle = "#fff8dc";
  ctx.fill();
  ctx.restore();
}
