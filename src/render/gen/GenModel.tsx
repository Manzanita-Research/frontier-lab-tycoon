import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { windowMat } from "../fx/glow";

/** Load and parse timings per model URL, for the FLT-13 results table (`window.__genStats`). */
export interface GenStat {
  /** ms from the request to the parsed scene (fetch + parse). */
  loadMs: number;
  /** ms GLTFLoader.parse took (includes the first meshopt WASM init). */
  parseMs: number;
}
const stats: Record<string, GenStat> = {};
if (typeof window !== "undefined") (window as unknown as { __genStats: typeof stats }).__genStats = stats;

const patched = new WeakSet<object>();
function timeLoader(loader: GLTFLoader) {
  if (patched.has(loader)) return;
  patched.add(loader);
  const load = loader.load.bind(loader);
  const parse = loader.parse.bind(loader);
  let lastParse = 0;
  loader.parse = ((data, path, onLoad, onError) => {
    const t0 = performance.now();
    return parse(data, path, (gltf) => {
      lastParse = performance.now() - t0;
      onLoad(gltf);
    }, onError);
  }) as typeof loader.parse;
  loader.load = ((url, onLoad, onProgress, onError) => {
    const t0 = performance.now();
    return load(url, (gltf) => {
      stats[url] = { loadMs: performance.now() - t0, parseMs: lastParse };
      onLoad(gltf);
    }, onProgress, onError);
  }) as typeof loader.load;
}

/** Same toy plastic as the procedural models, but the colour comes from the vertex colours Blender baked. */
const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02, flatShading: true });

/**
 * A generated, cleaned model. The GLB is already at footprint scale with its pivot at the ground centre,
 * so it drops in where a procedural model would. Faces the cleaner snapped to the glass colour arrive as a
 * second material called "glass" and share the campus window material, so they light up at night.
 */
export function GenModel({ url, position = [0, 0, 0] }: { url: string; position?: [number, number, number] }) {
  const gltf = useGLTF(url, false, true, timeLoader as never);
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      m.material = mats.length === 1 ? swap(mats[0]!) : mats.map(swap);
      m.castShadow = true;
      m.receiveShadow = true;
    });
    return root;
  }, [gltf]);
  return <primitive object={scene} position={position} />;
}

const swap = (m: THREE.Material) => (m.name === "glass" ? windowMat : bodyMat);
