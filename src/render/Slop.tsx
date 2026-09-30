import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../app/game";
import { SLOP_MAX } from "../sim/slop";
import type { GameState } from "../sim/types";
import { HALF } from "./coords";

/** Up to three puddles a tile. */
const CAP = 24 * 24 * SLOP_MAX;
/** Tile top: a path slab sits at 0.05 with a height of 0.1. */
const PATH_TOP = 0.1;
const TINTS = ["#9aa0ab", "#a9aeb9", "#8d94a1", "#b1afc0"].map((c) => new THREE.Color(c));

const hash = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Where the puddles of a slop level sit in a tile: [dx, dz, radius], in tile units from the centre. */
const LAYOUT: readonly (readonly [number, number, number])[][] = [
  [],
  [[0, 0, 0.3]],
  [[-0.12, -0.08, 0.28], [0.18, 0.15, 0.2]],
  [[-0.14, -0.14, 0.3], [0.2, 0.05, 0.24], [-0.02, 0.22, 0.2]],
];

/**
 * Slop on the paths (FLT-10): grey, glossy puddles, one to three to a tile depending on how deep it is, drawn as one
 * instanced mesh. It reads `world.slop` and rebuilds only when the sim's `slopRev` counter (or the World) changes.
 */
export function Slop() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const built = useRef<{ world: GameState | null; rev: number }>({ world: null, rev: -1 });
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const w = game.world;
    const rev = w.flags.slopRev ?? 0;
    if (built.current.world !== w || built.current.rev !== rev) {
      built.current = { world: w, rev };
      let n = 0;
      for (let i = 0; i < w.slop.length && n < CAP; i++) {
        const level = w.slop[i]!;
        if (level <= 0) continue;
        const tx = i % w.grid.w;
        const tz = Math.floor(i / w.grid.w);
        const layout = LAYOUT[Math.min(SLOP_MAX, level)]!;
        for (let k = 0; k < layout.length; k++) {
          const [dx, dz, r] = layout[k]!;
          // A puddle grows deeper as the level rises: wider and, at the top, heaped.
          const jitter = 0.85 + hash(i * 7 + k) * 0.3;
          dummy.position.set(tx + 0.5 - HALF + dx, PATH_TOP + 0.005 + level * 0.008, tz + 0.5 - HALF + dz);
          dummy.rotation.set(0, hash(i * 13 + k) * 6.28, 0);
          dummy.scale.set(r * jitter * (0.9 + level * 0.08), 0.02 + level * 0.022, r * jitter * (0.9 + level * 0.08) * (0.8 + hash(i + k) * 0.3));
          dummy.updateMatrix();
          mesh.setMatrixAt(n, dummy.matrix);
          mesh.setColorAt(n, TINTS[(i + k) % TINTS.length]!);
          n++;
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    // A slow shimmer over the whole lot.
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.12 + Math.sin(clock.elapsedTime * 2.2) * 0.06;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CAP]} frustumCulled={false} receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 18]} />
      <meshStandardMaterial color="#ffffff" roughness={0.18} metalness={0.45} emissive="#aeb4ff" emissiveIntensity={0.12} />
    </instancedMesh>
  );
}
