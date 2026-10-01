import { useMemo } from "react";
import * as THREE from "three";
import { CREAM_DARK, boxGeo, labelTexture, std } from "../materials";
import { B, Cyl } from "./Parts";

/** The Honeypot (FLT-59): a big green "EXIT (real)" sign on a post, pointing at a dead end with a couple of cones. */
export function HoneypotModel({ color }: { color: string }) {
  const sign = useMemo(() => labelTexture("EXIT (real) →", { w: 256, h: 96, bg: color, fg: "#ffffff" }), [color]);
  const signMat = useMemo(() => new THREE.MeshBasicMaterial({ map: sign, toneMapped: false, side: THREE.DoubleSide }), [sign]);
  return (
    <group>
      <B s={[0.9, 0.05, 0.9]} c={CREAM_DARK} />
      <Cyl p={[-0.25, 0.05, 0]} r={0.04} h={1.1} c="#6b6b6b" />
      <Cyl p={[0.25, 0.05, 0]} r={0.04} h={1.1} c="#6b6b6b" />
      <mesh position={[0, 1.2, 0]} geometry={boxGeo} material={std("#ffffff")} scale={[0.86, 0.36, 0.04]} castShadow />
      <mesh position={[0, 1.2, 0.025]} scale={[0.8, 0.3, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={signMat} attach="material" />
      </mesh>
      <mesh position={[0, 1.2, -0.025]} rotation-y={Math.PI} scale={[0.8, 0.3, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={signMat} attach="material" />
      </mesh>
      {/* The dead end it points at. */}
      <Cyl p={[0.3, 0.05, 0.3]} r={0.07} h={0.2} c="#ff8a00" />
      <Cyl p={[-0.3, 0.05, 0.32]} r={0.07} h={0.2} c="#ff8a00" />
    </group>
  );
}
