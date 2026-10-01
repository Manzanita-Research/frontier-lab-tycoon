// The sky as a texture, for the looks that draw the canvas through postprocessing (photo mode, the CRT): the DOM sky
// behind a transparent canvas would miss the effect, so the scene paints its own. Redrawn when the hour
// or the window changes (the time-of-day buttons move the hour).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { drawSky } from "./sky";
import { fx } from "./state";

/**
 * Paints the sky into a texture and returns it. `asBackground` (photo mode): make it the scene's background. The CRT
 * passes false and lays the texture under the scene itself, after tone mapping, so the sky keeps its colours.
 */
export function useSkyBackdrop(asBackground = true): THREE.Texture {
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const sky = useMemo(() => {
    const canvas = document.createElement("canvas");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex, hour: -1, w: 0, h: 0 };
  }, []);

  useEffect(() => {
    const prev = scene.background;
    if (asBackground) scene.background = sky.tex;
    return () => {
      if (asBackground) scene.background = prev;
      sky.tex.dispose();
    };
  }, [scene, sky, asBackground]);

  useFrame(() => {
    const w = Math.max(2, Math.round(size.width / 2));
    const h = Math.max(2, Math.round(size.height / 2));
    if (Math.abs(sky.hour - fx.hour) < 0.02 && sky.w === w && sky.h === h) return;
    sky.canvas.width = sky.w = w;
    sky.canvas.height = sky.h = h;
    sky.hour = fx.hour;
    drawSky(sky.canvas.getContext("2d")!, w, h, fx.hour);
    sky.tex.needsUpdate = true;
  });
  return sky.tex;
}
