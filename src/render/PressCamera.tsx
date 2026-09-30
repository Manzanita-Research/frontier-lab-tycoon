import { useFrame } from "@react-three/fiber";
import { drawSky } from "./fx/sky";
import { fx } from "./fx/state";
import { pressCamera, publish } from "../newsroom/state";

/** Anyone else who wants a photo of the campus as it is on screen (the ending's front page and share card, FLT-11). */
export const campusShots: { pending: { width: number; height: number; take: (photo: string | null) => void }[] } = { pending: [] };

/** A wide 16:9 print crop from the exact view on screen, over the sky (the canvas itself is see-through). */
function crop(source: HTMLCanvasElement, w: number, h: number, type: string, quality: number): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const height = Math.min(source.height, source.width * 9 / 16);
  const width = height * 16 / 9;
  drawSky(ctx, w, h, fx.hour);
  // Whatever the page does to the canvas (an ending's beige tint) goes in the photo too.
  const filter = getComputedStyle(source).filter;
  if (filter && filter !== "none") ctx.filter = filter;
  ctx.drawImage(source, (source.width - width) / 2, (source.height - height) / 2, width, height, 0, 0, w, h);
  return canvas.toDataURL(type, quality);
}

/** Explicit render + immediate copy works with preserveDrawingBuffer off. Only runs when the press needs a shot. */
export function PressCamera() {
  useFrame(({ gl, scene, camera }) => {
    if (pressCamera.pending.length === 0 && campusShots.pending.length === 0) return;
    const pending = pressCamera.pending.splice(0);
    const shots = campusShots.pending.splice(0);
    let photo: string | undefined;
    try {
      gl.render(scene, camera);
      if (pending.length) photo = crop(gl.domElement, 640, 360, "image/webp", 0.7) ?? undefined;
      for (const s of shots) s.take(crop(gl.domElement, s.width, s.height, "image/jpeg", 0.88));
    } catch {
      // Context loss should not lose the week's news (or the last one).
      for (const s of shots) s.take(null);
    }
    for (const editions of pending) publish(editions.map((e) => e.type === "paper" ? { ...e, photo } : e));
  });
  return null;
}
