import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { ambience } from "./clock";
import { updateGlow } from "./glow";
import { fx } from "./state";

/** The sun, the moon and the sky light: one directional light that swings round, tinted by the hour. */
export function Lighting() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    const a = ambience(fx.hour);
    if (hemi.current) {
      hemi.current.color.setRGB(...a.hemiSky, THREE.SRGBColorSpace);
      hemi.current.groundColor.setRGB(...a.hemiGround, THREE.SRGBColorSpace);
      hemi.current.intensity = a.hemiIntensity;
    }
    if (sun.current) {
      sun.current.color.setRGB(...a.sunColor, THREE.SRGBColorSpace);
      sun.current.intensity = a.sunIntensity;
      sun.current.position.set(...a.sunPos);
    }
    updateGlow(a);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#fff6e0", "#7fb266", 1.05]} />
      <directionalLight
        ref={sun}
        position={[10, 22, -7]}
        intensity={2.1}
        color="#fff0d2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}
