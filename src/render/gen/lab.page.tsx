// FLT-13 lab: one building (or N copies) on a plain ground, for reference renders and frame-time benchmarks.
//   ?page=lab&kind=hall&bare=1            the procedural Hall body on white (the image-to-3D reference)
//   ?page=lab&kind=cluster&models=cluster  the generated cluster
//   ?page=lab&kind=hall&copies=12&bench=1  12 copies, then window.__lab holds frame times and renderer.info
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS } from "../../content/buildings";
import { ClusterModel } from "../buildings/ClusterModel";
import { FloatModel } from "../buildings/FloatModel";
import { HallModel } from "../buildings/HallModel";
import { CAMERA_OFFSET } from "../fx/CameraRig";
import { Lighting } from "../fx/Lighting";
import { fx } from "../fx/state";
import type { GenKind } from "./variants";
import { genPath } from "./variants";

const q = new URLSearchParams(window.location.search);
const kind = (q.get("kind") ?? "hall") as GenKind;
const copies = Math.max(1, Number(q.get("copies") ?? 1));
const bare = q.has("bare");
const bench = q.has("bench");
const zoom = Number(q.get("zoom") ?? (copies > 1 ? 60 : 150));
const FOOT: Record<GenKind, [number, number]> = { hall: [3, 3], cluster: [2, 2], float: [3, 2] };
fx.hour = Number(q.get("hour") ?? 13);
fx.hourOverride = fx.hour;

function Model() {
  if (kind === "hall") return <HallModel color={BUILDINGS.hall.color} bare={bare} />;
  if (kind === "cluster") return <ClusterModel color={BUILDINGS.cluster.color} />;
  return <FloatModel />;
}

interface LabResult {
  done: boolean;
  kind: string;
  copies: number;
  frames: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  calls: number;
  triangles: number;
  geometries: number;
}

function Bench() {
  const gl = useThree((s) => s.gl);
  const frames = useRef<number[]>([]);
  const seen = useRef(0);
  useFrame((_, dt) => {
    const url = genPath(kind);
    const stats = (window as unknown as { __genStats?: Record<string, unknown> }).__genStats ?? {};
    // Wait for the model to have loaded (if there is one), then let the scene settle before timing.
    if (url && !stats[url]) return;
    if (++seen.current < 60) return;
    if (frames.current.length >= 120) return;
    frames.current.push(dt * 1000);
    if (frames.current.length < 120) return;
    const sorted = [...frames.current].sort((a, b) => a - b);
    const mean = frames.current.reduce((a, b) => a + b, 0) / frames.current.length;
    (window as unknown as { __lab: LabResult }).__lab = {
      done: true,
      kind,
      copies,
      frames: frames.current.length,
      meanMs: mean,
      medianMs: sorted[sorted.length >> 1]!,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)]!,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
    };
  });
  return null;
}

export default function Lab() {
  const [w, d] = FOOT[kind];
  const cols = Math.ceil(Math.sqrt(copies));
  const rows = Math.ceil(copies / cols);
  const gx = w + 0.6;
  const gz = d + 0.6;
  const target: [number, number, number] = [0, kind === "float" ? 0.9 : 0.8, 0];
  return (
    <Canvas
      orthographic
      shadows
      dpr={1}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: new THREE.Vector3(...target).add(CAMERA_OFFSET).toArray(), zoom, near: -100, far: 200 }}
      onCreated={({ camera }) => camera.lookAt(...target)}
    >
      <color attach="background" args={["#ffffff"]} />
      <Lighting />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial opacity={0.22} />
      </mesh>
      <Suspense fallback={null}>
        {Array.from({ length: copies }, (_, i) => (
          <group key={i} position={[(i % cols) * gx - ((cols - 1) * gx) / 2, 0, Math.floor(i / cols) * gz - ((rows - 1) * gz) / 2]}>
            <Model />
          </group>
        ))}
      </Suspense>
      {bench && <Bench />}
    </Canvas>
  );
}
