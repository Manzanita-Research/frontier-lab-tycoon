// Photo mode's look: tilt-shift blur, a saturation bump and a gentle vignette, through @react-three/postprocessing.
// This module is lazy-loaded and only mounted while photo mode is on, so the rest of the game never pays for it.
import { useThree } from "@react-three/fiber";
import { EffectComposer, BrightnessContrast, HueSaturation, TiltShift, ToneMapping, Vignette } from "@react-three/postprocessing";
import { KernelSize, ToneMappingMode } from "postprocessing";
import { useEffect, useRef } from "react";
import { photoBridge } from "./photoState";
import { useSkyBackdrop } from "./useSkyBackdrop";

export default function PhotoFX() {
  const gl = useThree((s) => s.gl);
  const composer = useRef<{ render: (dt?: number) => void } | null>(null);

  // The sky is the scene's background while photo mode is up.
  useSkyBackdrop();

  useEffect(() => {
    photoBridge.render = () => {
      composer.current?.render(0);
      return gl.domElement;
    };
    return () => {
      photoBridge.render = null;
    };
  }, [gl]);

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
