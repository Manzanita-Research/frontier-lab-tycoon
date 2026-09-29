import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { atoms, sim } from "../../app/game";
import { useApp } from "../../app/hooks";
import { worldX, worldZ } from "../coords";
import { glowTexture } from "../materials";
import { lampPoolMat, lanternMat } from "./glow";

const MAX_LAMPS = 96;
const NEIGHBOURS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Where the lamps go: every fourth path tile, on the verge side of it. Pure, so it is testable. */
export function lampSpots(grid: { w: number; h: number; paths: boolean[] }): { x: number; z: number }[] {
  const spots: { x: number; z: number }[] = [];
  const path = (x: number, z: number) => x >= 0 && z >= 0 && x < grid.w && z < grid.h && grid.paths[z * grid.w + x];
  for (let z = 0; z < grid.h; z++) {
    for (let x = 0; x < grid.w; x++) {
      if (!path(x, z) || (x + z) % 4 !== 0) continue;
      const free = NEIGHBOURS.find(([dx, dz]) => !path(x + dx, z + dz));
      if (!free) continue;
      spots.push({ x: x + 0.5 + free[0] * 0.36, z: z + 0.5 + free[1] * 0.36 });
      if (spots.length >= MAX_LAMPS) return spots;
    }
  }
  return spots;
}

/**
 * Path lamps: a post and a lantern every few tiles, and a pool of warm light on the ground under each. The lanterns
 * and pools use shared materials (see glow.ts), so the whole campus lights up together at dusk.
 */
export function Lamps() {
  const version = useApp(atoms.version);
  const post = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const pool = useRef<THREE.InstancedMesh>(null);
  const poolGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const poolMap = useMemo(() => glowTexture("#ffcf70"), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    lampPoolMat.map = poolMap;
    lampPoolMat.needsUpdate = true;
  }, [poolMap]);

  useEffect(() => {
    const spots = lampSpots(sim.world.grid);
    const put = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };
    spots.forEach((s, i) => {
      const x = worldX(s.x);
      const z = worldZ(s.z);
      put(post.current, i, x, 0.5, z, 0.045, 1, 0.045);
      put(head.current, i, x, 1.06, z, 0.12, 0.12, 0.12);
      put(pool.current, i, x, 0.115, z, 2.6, 1, 2.6);
    });
    for (const m of [post.current, head.current, pool.current]) {
      if (!m) continue;
      m.count = spots.length;
      m.instanceMatrix.needsUpdate = true;
    }
    // `version` is what invalidates the lamp layout: paths changed.
  }, [version, dummy]);

  return (
    <group>
      <instancedMesh ref={post} args={[undefined, undefined, MAX_LAMPS]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#5b4a3c" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, MAX_LAMPS]} material={lanternMat} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
      </instancedMesh>
      <instancedMesh ref={pool} args={[poolGeo, lampPoolMat, MAX_LAMPS]} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
