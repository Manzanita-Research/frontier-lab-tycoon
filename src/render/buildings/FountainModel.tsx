import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { CREAM, CREAM_DARK, glow, std } from "../materials";
import { B, Ball, Cyl } from "./Parts";

const DROPS = 8;
const water = new THREE.MeshStandardMaterial({ color: "#6fd6f5", roughness: 0.15, transparent: true, opacity: 0.85 });
const drop = glow("#c8f3ff");

/** A round basin, a tiered spout, and arcs of water. Transparent, in the sense that you can see through the water. */
export function FountainModel({ color }: { color: string }) {
  const drops = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = drops.current;
    if (!g) return;
    g.children.forEach((d, i) => {
      const u = (clock.elapsedTime * 0.9 + (i / DROPS) * 1) % 1;
      const a = (i / DROPS) * Math.PI * 2;
      const r = 0.06 + u * 0.3;
      d.position.set(Math.cos(a) * r, 0.62 + Math.sin(u * Math.PI) * 0.34 - u * 0.2, Math.sin(a) * r);
      d.scale.setScalar(0.035 * (1 - u * 0.4));
    });
  });

  return (
    <group>
      <Cyl r={0.46} h={0.16} c={CREAM_DARK} />
      <Cyl p={[0, 0.16, 0]} r={0.4} h={0.04} c={CREAM} />
      <Cyl p={[0, 0.06, 0]} r={0.36} h={0.12} mat={water} />
      <Cyl p={[0, 0.16, 0]} r={0.08} h={0.34} c={CREAM} />
      <Cyl p={[0, 0.44, 0]} r={0.2} h={0.06} c={CREAM_DARK} />
      <Cyl p={[0, 0.46, 0]} r={0.16} h={0.04} mat={water} />
      <B p={[0, 0.5, 0]} s={[0.05, 0.12, 0.05]} c={CREAM} />
      <Ball p={[0, 0.66, 0]} r={0.06} c={color} />
      <mesh position={[0, 0.17, 0]} rotation-x={-Math.PI / 2} material={std(color, 0.4)}>
        <torusGeometry args={[0.41, 0.025, 6, 28]} />
      </mesh>
      <group ref={drops}>
        {Array.from({ length: DROPS }, (_, i) => (
          <mesh key={i} material={drop}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
