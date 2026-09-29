// Photo mode's look: tilt-shift blur, a saturation bump and a gentle vignette, through @react-three/postprocessing.
// This module is lazy-loaded and only mounted while photo mode is on, so the rest of the game never pays for it.
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, BrightnessContrast, HueSaturation, TiltShift, ToneMapping, Vignette } from "@react-three/postprocessing";
import { KernelSize, ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { photoBridge } from "./photoState";
import { drawSky } from "./sky";
import { fx } from "./state";

export default function PhotoFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const composer = useRef<{ render: (dt?: number) => void } | null>(null);

  const sky = useMemo(() => {
    const canvas = document.createElement("canvas");
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex, hour: -1, w: 0, h: 0 };
  }, []);

  // The sky is the scene's background while photo mode is up.
  useEffect(() => {
    const prev = scene.background;
    scene.background = sky.tex;
    return () => {
      scene.background = prev;
      sky.tex.dispose();
    };
  }, [scene, sky]);

  useEffect(() => {
    photoBridge.render = () => {
      composer.current?.render(0);
      return gl.domElement;
    };
    return () => {
      photoBridge.render = null;
    };
  }, [gl]);

  // Redraw the sky when the hour or the window changes (the time-of-day buttons move the hour).
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

  return (
    <EffectComposer ref={composer as never} multisampling={4}>
      <TiltShift offset={0.03} rotation={0} focusArea={0.2} feather={0.55} kernelSize={KernelSize.VERY_LARGE} resolutionScale={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.2} />
      <BrightnessContrast contrast={0.08} brightness={0.01} />
      <Vignette offset={0.32} darkness={0.42} />
    </EffectComposer>
  );
}
