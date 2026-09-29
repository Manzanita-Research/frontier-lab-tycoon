import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { std } from "../materials";
import { fx } from "./state";

const SEG = 8;

/** A pennant on a pole that waves: the cloth is a strip of vertices swaying in a travelling wave, pinned at the pole. */
export function Flag({
  position,
  color,
  width = 0.5,
  height = 0.28,
  pole = 0.75,
  phase = 0,
  rotationY = 0,
}: {
  position: [number, number, number];
  color: string;
  width?: number;
  height?: number;
  pole?: number;
  phase?: number;
  rotationY?: number;
}) {
  const { geo, base } = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, SEG, 2);
    g.translate(width / 2, 0, 0);
    return { geo: g, base: g.getAttribute("position").array.slice() as Float32Array };
  }, [width, height]);
  const cloth = useMemo(() => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7, flatShading: true }), [color]);

  useFrame(() => {
    const t = fx.time;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]!;
      const k = x / width;
      pos.setZ(i, Math.sin(t * 6 - x * 11 + phase) * 0.08 * k);
      pos.setY(i, base[i * 3 + 1]! + Math.sin(t * 3.3 - x * 6 + phase) * 0.025 * k - k * k * 0.03);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <group position={position} rotation-y={rotationY}>
      <mesh material={std("#6b5a48")} position={[0, pole / 2, 0]} scale={[0.02, pole, 0.02]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </mesh>
      <mesh position={[0, pole + 0.02, 0]} scale={0.035} material={std("#ffe08a")}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>
      <mesh geometry={geo} material={cloth} position={[0.01, pole - height / 2 - 0.03, 0]} castShadow />
    </group>
  );
}
