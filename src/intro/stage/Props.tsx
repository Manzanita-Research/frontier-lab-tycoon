// The store's set dressing (FLT-89): models generated on Fal (text-to-3D), cleaned in Blender and meshopt-packed by
// scripts/fal3d/props.mjs. Each is one mesh with vertex colours, so one draw call. The models carry no words; the
// words are painted signs beside them (art.ts), so the parody scan reads them like any other string.
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { paintBalloon, paintBinCard } from "../art";
import { canvasTexture, COUNTER_Y, frameDt, useClock } from "./rig";

/** `src/intro/assets/props/<id>.glb`, one per entry in props.jobs.json. */
const PROP_URLS = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../assets/props/*.glb", { eager: true, query: "?url", import: "default" })).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -4), url]),
);
export const PROP_IDS = ["standee", "bin", "mug", "floppies"] as const;
type PropId = (typeof PROP_IDS)[number];
const URLS = PROP_IDS.map((id) => PROP_URLS[id]!);
const meshopt = (loader: GLTFLoader) => void loader.setMeshoptDecoder(MeshoptDecoder);

/** Start the downloads with the art, so the stage suspends once. */
export const preloadProps = () => useLoader.preload(GLTFLoader, URLS, meshopt);

/** One generated model, its own copy of the cached scene, sat on the floor at its origin. */
function Model({ id }: { id: PropId }) {
  const gltfs = useLoader(GLTFLoader, URLS, meshopt);
  const scene = useMemo(() => gltfs[PROP_IDS.indexOf(id)]!.scene.clone(), [gltfs, id]);
  return <primitive object={scene} />;
}

/** The bargain bin, between our aisle and the next. */
export function FloorProps() {
  const card = useMemo(() => canvasTexture(paintBinCard(), 4), []);
  useEffect(() => () => card.dispose(), [card]);
  return (
    <group position={[-1.1, 0, 0.12]} rotation={[0, 0.12, 0]}>
      <Model id="bin" />
      {/* The sign, clipped to the top of the bin's back flap. */}
      <mesh position={[0, 0.52, -0.29]} rotation={[-0.08, 0, -0.04]}>
        <planeGeometry args={[0.36, 0.18]} />
        <meshStandardMaterial map={card} roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The demo counter's clutter: a cardboard scientist turning on a turntable at the shelf end, the store manager's coffee
 * and somebody's floppies.
 */
export function CounterProps() {
  const clock = useClock();
  const spin = useRef<THREE.Group>(null);
  const tex = useMemo(() => ({ balloon: canvasTexture(paintBalloon(), 4), back: canvasTexture(paintBalloon(true), 2) }), []);
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  useFrame((_, dt) => {
    const dts = frameDt(clock.current, dt);
    if (spin.current && Number.isFinite(dts)) spin.current.rotation.y += dts * 0.35;
  });
  return (
    <group>
      <group position={[1.24, COUNTER_Y, 0.3]}>
        <group ref={spin} rotation={[0, -0.5, 0]}>
          <Model id="standee" />
          <mesh position={[-0.04, 0.6, 0.02]} rotation={[0, 0, -0.04]}>
            <planeGeometry args={[0.26, 0.179]} />
            <meshStandardMaterial map={tex.balloon} alphaTest={0.5} roughness={0.8} />
          </mesh>
          {/* The balloon's back is plain card. */}
          <mesh position={[-0.04, 0.6, 0.02]} rotation={[0, 0, -0.04]}>
            <planeGeometry args={[0.26, 0.179]} />
            <meshStandardMaterial map={tex.back} side={THREE.BackSide} alphaTest={0.5} roughness={0.9} />
          </mesh>
        </group>
      </group>
      <group position={[1.6, COUNTER_Y, 0.2]} rotation={[0, 0.9, 0]}>
        <Model id="mug" />
      </group>
      <group position={[1.56, COUNTER_Y, 0.47]} rotation={[0, -0.3, 0]}>
        <Model id="floppies" />
      </group>
    </group>
  );
}
