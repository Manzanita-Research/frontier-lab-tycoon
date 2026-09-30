import { useFrame } from "@react-three/fiber";
import { drawSky } from "./fx/sky";
import { fx } from "./fx/state";
import { pressCamera, publish } from "../newsroom/state";
/** Explicit render + immediate copy works with preserveDrawingBuffer off. Only runs when the press needs a shot. */
export function PressCamera() {
  useFrame(({ gl, scene, camera }) => {
    if (pressCamera.pending.length === 0) return;
    const pending = pressCamera.pending.splice(0);
    let photo: string | undefined;
    try {
      gl.render(scene, camera);
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext("2d");
      const source = gl.domElement;
      // A wide print crop from the exact view currently on screen.
      const height = Math.min(source.height, source.width * 9 / 16);
      const width = height * 16 / 9;
      if (ctx) drawSky(ctx, 640, 360, fx.hour);
      ctx?.drawImage(source, (source.width - width) / 2, (source.height - height) / 2, width, height, 0, 0, 640, 360);
      if (ctx) photo = canvas.toDataURL("image/webp", 0.7);
    } catch { /* Context loss should not lose the week's news. */ }
    for (const editions of pending) publish(editions.map((e) => e.type === "paper" ? { ...e, photo } : e));
  });
  return null;
}
