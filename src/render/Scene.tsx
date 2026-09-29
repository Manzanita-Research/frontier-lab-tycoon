import { MapControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { debugParams, useStore } from "../store";
import { Buildings } from "./buildings/Buildings";
import { HALF } from "./coords";
import { Confetti } from "./Confetti";
import { Decor, Ground, Paths } from "./Ground";
import { OverlayProjector } from "./overlay";
import { Placement } from "./Placement";
import { Walkers } from "./Walkers";

const CAMERA_OFFSET = new THREE.Vector3(20, 20, 20);
const PAN_LIMIT = 13;

function initialZoom() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return debugParams.zoom ?? (w < 700 ? w / 22 : Math.min(w / 36, h / 21));
}

/** Pan, zoom (clamped), and Q/E quarter-turns with a short ease. */
function CameraRig({ baseZoom }: { baseZoom: number }) {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const turn = useRef({ target: 0, current: 0 });
  const tool = useStore((s) => s.tool);
  const painting = tool === "path" || tool === "bulldoze";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      if (e.key === "q" || e.key === "Q") turn.current.target += Math.PI / 2;
      if (e.key === "e" || e.key === "E") turn.current.target -= Math.PI / 2;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // Open on the campus rather than the middle of the lawn.
    const [fx, fz] = debugParams.focus ?? [11.5, 15];
    c.target.set(fx - HALF, 0, fz - HALF);
    c.object.position.copy(c.target).add(CAMERA_OFFSET);
    c.update();
  }, []);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const t = turn.current;
    const step = (t.target - t.current) * (1 - Math.exp(-9 * dt));
    if (Math.abs(t.target - t.current) > 1e-4) {
      t.current += step;
      c.object.position.sub(c.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, step).add(c.target);
    }
    const cx = THREE.MathUtils.clamp(c.target.x, -PAN_LIMIT, PAN_LIMIT);
    const cz = THREE.MathUtils.clamp(c.target.z, -PAN_LIMIT, PAN_LIMIT);
    if (cx !== c.target.x || cz !== c.target.z) {
      c.object.position.x += cx - c.target.x;
      c.object.position.z += cz - c.target.z;
      c.target.x = cx;
      c.target.z = cz;
    }
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enableDamping
      dampingFactor={0.14}
      zoomSpeed={0.9}
      minZoom={baseZoom * 0.55}
      maxZoom={baseZoom * 3.4}
      // With the path or bulldoze tool a left drag paints; pan with the right button or two fingers.
      mouseButtons={{ LEFT: painting ? (-1 as THREE.MOUSE) : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: painting ? (-1 as THREE.TOUCH) : THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#fff6e0", "#7fb266", 1.05]} />
      <directionalLight
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
      <Lighting />
      <Ground />
      <Decor />
      <Paths />
      <Buildings />
      <Walkers />
      <Confetti />
      <OverlayProjector />
      <Placement />
      <CameraRig baseZoom={zoom} />
    </Canvas>
  );
}
