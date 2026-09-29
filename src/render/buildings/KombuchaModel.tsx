import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CREAM, CREAM_DARK, std } from "../materials";
import { B, Ball, Cyl } from "./Parts";

const SLICES = 8;

/** A kiosk under a striped parasol, with a very large bottle. */
export function KombuchaModel({ color }: { color: string }) {
  const bubbles = useRef<THREE.Group>(null);
  const stripes = useMemo(
    () =>
      Array.from({ length: SLICES }, (_, i) => (
        <mesh key={i} position={[0, 1.02, 0]} material={std(i % 2 ? "#fff8e6" : color)} castShadow>
          <coneGeometry args={[0.62, 0.3, SLICES, 1, false, (i * Math.PI * 2) / SLICES, (Math.PI * 2) / SLICES]} />
        </mesh>
      )),
    [color],
  );

  useFrame(({ clock }) => {
    const g = bubbles.current;
    if (!g) return;
    g.children.forEach((b, i) => {
      const u = (clock.elapsedTime * 0.5 + i * 0.37) % 1;
      b.position.y = 1.05 + u * 0.5;
      b.position.x = 0.02 + Math.sin(u * 9 + i) * 0.05;
      b.scale.setScalar(0.03 * (1 - u * 0.5));
    });
  });

  return (
    <group>
      <B s={[0.92, 0.08, 0.92]} c={CREAM_DARK} />
      <B p={[0, 0.08, 0]} s={[0.72, 0.5, 0.62]} c={CREAM} />
      <B p={[0, 0.58, 0]} s={[0.8, 0.06, 0.7]} c={color} />
      <Cyl p={[-0.3, 0.64, -0.26]} r={0.03} h={0.4} c={CREAM_DARK} />
      <Cyl p={[0.3, 0.64, 0.26]} r={0.03} h={0.4} c={CREAM_DARK} />
      {stripes}
      <Cyl p={[0.05, 0.64, 0]} r={0.15} h={0.62} mat={new THREE.MeshStandardMaterial({ color: "#d9902b", roughness: 0.25, transparent: true, opacity: 0.92 })} />
      <Cyl p={[0.05, 1.26, 0]} r={0.07} h={0.24} c="#c98322" />
      <Ball p={[0.05, 1.52, 0]} r={0.075} c={color} />
      <group ref={bubbles}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0.05, 1.1, 0]} material={std("#fff3c4", 0.2)}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
