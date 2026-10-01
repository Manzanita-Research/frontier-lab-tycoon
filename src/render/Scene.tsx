import { useAtomValue } from "@effect/atom-react";
import { Canvas } from "@react-three/fiber";
import { Suspense, lazy, useRef } from "react";
import { debugParams } from "../app/game";
import { SoundLayer } from "../audio/SoundLayer";
import { PressCamera } from "./PressCamera";
import { ProbeView } from "./ProbeView";
import { Buildings } from "./buildings/Buildings";
import { CrtLayer } from "./crt/CrtLayer";
import { crtEvents } from "./crt/events";
import { CAMERA_OFFSET, CameraRig } from "./fx/CameraRig";
import { FxDirector } from "./fx/FxDirector";
import { Lighting } from "./fx/Lighting";
import { Lamps } from "./fx/Night";
import { ParticleLayer } from "./fx/ParticleLayer";
import { photoAtom } from "./fx/photoState";
import { Decor, Ground, Paths } from "./Ground";
import { Fence } from "./Fence";
import { NeoCampuses } from "./NeoCampuses";
import { GradePlaque } from "./GradePlaque";
import { Slop } from "./Slop";
import { StaffCrew } from "./StaffCrew";
import { VisitorGroups } from "./VisitorGroups";
import { OverlayProjector } from "./overlay";
import { CoachSuggestion } from "./CoachSuggestion";
import { PathGaps } from "./PathGaps";
import { Placement } from "./Placement";
import { Walkers } from "./Walkers";
import { cameraStart } from "./cameraStart";

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

export function Scene() {
  const start = useRef(cameraStart(window.innerWidth, window.innerHeight, debugParams)).current;
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      events={crtEvents}
      camera={{ position: CAMERA_OFFSET.toArray(), zoom: start.zoom, near: -100, far: 200 }}
    >
      <FxDirector />
      <SoundLayer />
      <Lighting />
      <Ground />
      <Decor />
      <Paths />
      <PathGaps />
      <Slop />
      <Fence />
      <NeoCampuses />
      <GradePlaque />
      <Lamps />
      <Buildings />
      <Walkers />
      <StaffCrew />
      <VisitorGroups />
      <ParticleLayer />
      <OverlayProjector />
      <Placement />
      <CoachSuggestion />
      <CameraRig baseZoom={start.base} focus={start.focus} />
      <PhotoLayer />
      <CrtLayer />
      <PressCamera />
      <ProbeView />
    </Canvas>
  );
}
