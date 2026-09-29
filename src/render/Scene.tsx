import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { debugParams } from "../app/game";
import { Buildings } from "./buildings/Buildings";
import { CAMERA_OFFSET, CameraRig } from "./fx/CameraRig";
import { FxDirector } from "./fx/FxDirector";
import { Lighting } from "./fx/Lighting";
import { Lamps } from "./fx/Night";
import { ParticleLayer } from "./fx/ParticleLayer";
import { Decor, Ground, Paths } from "./Ground";
import { OverlayProjector } from "./overlay";
import { Placement } from "./Placement";
import { Walkers } from "./Walkers";

function initialZoom() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Roughly a building per eighth of the screen width at 1440x900, with the whole gate-to-hall campus still in view.
  return debugParams.zoom ?? (w < 700 ? w / 16 : Math.min(w / 30, h / 17.5));
}

export function Scene() {
  const zoom = useRef(initialZoom()).current;
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: CAMERA_OFFSET.toArray(), zoom, near: -100, far: 200 }}
    >
      <FxDirector />
      <Lighting />
      <Ground />
      <Decor />
      <Paths />
      <Lamps />
      <Buildings />
      <Walkers />
      <ParticleLayer />
      <OverlayProjector />
      <Placement />
      <CameraRig baseZoom={zoom} />
    </Canvas>
  );
}
