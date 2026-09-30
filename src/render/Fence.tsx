import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GRID_SIZE } from "../sim/state";
import { HALF } from "./coords";
import { boxGeo, std } from "./materials";

/** A low white fence round the campus, with a gap at the gate: it is what Security patrols. */
export function Fence() {
  const posts = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      const at = i - HALF;
      out.push({ x: at, z: -HALF }, { x: -HALF, z: at }, { x: HALF, z: at });
      // The bottom edge has the gate in it (tiles 11 and 12): no fence across the road.
      if (i < 10.5 || i > 13.5) out.push({ x: at, z: HALF });
    }
    return out;
  }, []);
  useEffect(() => {
    const m = posts.current;
    if (!m) return;
    const d = new THREE.Object3D();
    spots.forEach((p, i) => {
      d.position.set(p.x, 0.26, p.z);
      d.scale.set(0.09, 0.5, 0.09);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);
  const rail = (key: string, cx: number, cz: number, sx: number, sz: number, y: number) => <mesh key={key} geometry={boxGeo} material={std("#f2ead6")} position={[cx, y, cz]} scale={[sx, 0.05, sz]} castShadow />;
  const len = GRID_SIZE;
  const gateL = 10.5;
  const gateR = 13.5;
  return (
    <group>
      <instancedMesh ref={posts} args={[boxGeo, undefined, spots.length]} castShadow>
        <meshStandardMaterial color="#f2ead6" roughness={0.85} flatShading />
      </instancedMesh>
      {[0.2, 0.42].flatMap((y) => [
        rail(`n${y}`, 0, -HALF, len, 0.05, y),
        rail(`w${y}`, -HALF, 0, 0.05, len, y),
        rail(`e${y}`, HALF, 0, 0.05, len, y),
        rail(`sl${y}`, (0 + gateL) / 2 - HALF, HALF, gateL, 0.05, y),
        rail(`sr${y}`, (gateR + len) / 2 - HALF, HALF, len - gateR, 0.05, y),
      ])}
    </group>
  );
}
