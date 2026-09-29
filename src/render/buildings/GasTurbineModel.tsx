import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { CREAM, CREAM_DARK, glow } from "../materials";
import { B, Cyl } from "./Parts";

/** Chimney offset from the middle of the footprint: the smoke in FxDirector rises from here. */
export const GAS_STACK: [number, number] = [0.55, 0.4];
export const GAS_STACK_TOP = 1.75;

const flame = glow("#ff9a3c");
const flameGeo = new THREE.SphereGeometry(1, 10, 8);

/** A gas turbine: a drum on its side, a tall stack, and a little flame that flickers. */
export function GasTurbineModel({ color }: { color: string }) {
  const light = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = 0.75 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08;
    light.current?.scale.set(0.16 * k, 0.22 * k, 0.16 * k);
  });
  return (
    <group>
      <B s={[1.86, 0.12, 1.86]} c={CREAM_DARK} />
      <Cyl p={[-0.1, 0.5, -0.1]} r={0.42} h={1.4} c={CREAM} rotation-z={Math.PI / 2} />
      <Cyl p={[-0.78, 0.5, -0.1]} r={0.44} h={0.12} c={color} rotation-z={Math.PI / 2} />
      <Cyl p={[0.55, 0.5, -0.1]} r={0.44} h={0.12} c={color} rotation-z={Math.PI / 2} />
      <B p={[-0.5, 0.12, 0.5]} s={[0.5, 0.35, 0.4]} c={CREAM_DARK} />
      <Cyl p={[GAS_STACK[0], 0.12, GAS_STACK[1]]} r={0.17} h={GAS_STACK_TOP - 0.12} c="#c9d3e0" />
      <Cyl p={[GAS_STACK[0], GAS_STACK_TOP - 0.22, GAS_STACK[1]]} r={0.19} h={0.1} c={color} />
      <Cyl p={[GAS_STACK[0], GAS_STACK_TOP - 0.02, GAS_STACK[1]]} r={0.14} h={0.05} c="#3a2a1c" />
      <mesh ref={light} geometry={flameGeo} material={flame} position={[GAS_STACK[0], 1.0, GAS_STACK[1] + 0.2]} />
    </group>
  );
}
