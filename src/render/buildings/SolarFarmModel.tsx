import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { boxGeo, CREAM_DARK, std } from "../materials";
import { B, Cyl } from "./Parts";

const SPOTS = [-0.95, 0, 0.95];
const PANEL = std("#2f66c8", 0.22);
const FRAME = std("#e7edf5", 0.5);

/** A solar farm: nine tilted panels that lazily follow the sun. */
export function SolarFarmModel({ color }: { color: string }) {
  const panels = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const sway = Math.sin(clock.elapsedTime * 0.25) * 0.28;
    for (const g of panels.current) if (g) g.rotation.y = sway;
  });
  return (
    <group>
      <B s={[2.86, 0.1, 2.86]} c={CREAM_DARK} />
      <B p={[0, 0.1, 1.32]} s={[2.9, 0.08, 0.14]} c={color} />
      {SPOTS.flatMap((x, i) =>
        SPOTS.map((z, j) => (
          <group key={`${i}-${j}`} position={[x, 0.1, z]}>
            <Cyl r={0.05} h={0.42} c="#8a94a3" />
            <group ref={(g) => void (panels.current[i * 3 + j] = g)} position={[0, 0.5, 0]}>
              <group rotation-x={-0.5}>
                <mesh geometry={boxGeo} material={FRAME} scale={[0.84, 0.05, 0.68]} castShadow />
                <mesh geometry={boxGeo} material={PANEL} position={[0, 0.03, 0]} scale={[0.76, 0.03, 0.6]} castShadow />
              </group>
            </group>
          </group>
        )),
      )}
    </group>
  );
}
