import { useAtomValue } from "@effect/atom-react";
import { Canvas } from "@react-three/fiber";
import { Suspense, lazy, useRef } from "react";
import { debugParams } from "../app/game";
import { SoundLayer } from "../audio/SoundLayer";
import { PressCamera } from "./PressCamera";
import { Buildings } from "./buildings/Buildings";
import { CAMERA_OFFSET, CameraRig } from "./fx/CameraRig";
import { FxDirector } from "./fx/FxDirector";
import { Lighting } from "./fx/Lighting";
import { Lamps } from "./fx/Night";
import { ParticleLayer } from "./fx/ParticleLayer";
import { photoAtom } from "./fx/photoState";
import { Decor, Ground, Paths } from "./Ground";
import { Fence } from "./Fence";
import { Slop } from "./Slop";
import { StaffCrew } from "./StaffCrew";
import { VisitorGroups } from "./VisitorGroups";
import { OverlayProjector } from "./overlay";
import { CoachSuggestion } from "./CoachSuggestion";
import { Placement } from "./Placement";
import { Walkers } from "./Walkers";

// Postprocessing is a chunk of its own, fetched the first time photo mode opens and mounted only while it is on.
const PhotoFX = lazy(() => import("./fx/PhotoFX"));

function PhotoLayer() {
  const on = useAtomValue(photoAtom);
  return on ? (
    <Suspense fallback={null}>
      <PhotoFX />
    </Suspense>
  ) : null;
}

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
      <SoundLayer />
      <Lighting />
      <Ground />
      <Decor />
      <Paths />
      <Slop />
      <Fence />
      <Lamps />
      <Buildings />
      <Walkers />
      <StaffCrew />
      <VisitorGroups />
      <ParticleLayer />
      <OverlayProjector />
      <Placement />
      <CoachSuggestion />
      <CameraRig baseZoom={zoom} />
      <PhotoLayer />
      <PressCamera />
    </Canvas>
  );
}
