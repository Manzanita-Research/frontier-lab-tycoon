import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CREAM, CREAM_DARK } from "../materials";
import { B, Ball, Cyl } from "./Parts";

/** A soft white "z" on a transparent card. */
function zTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.font = "900 54px ui-rounded, Nunito, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 8;
  g.strokeStyle = "#3a2a1c";
  g.strokeText("z", 32, 34);
  g.fillStyle = "#fff8e6";
  g.fillText("z", 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PODS = [-0.5, 0.5];

/** Two sleeping pods with glass lids, a moon on a post, and a steady drift of z's. */
export function NapModel({ color }: { color: string }) {
  const zs = useRef<THREE.Group>(null);
  const zMap = useMemo(() => zTexture(), []);
  const lid = useMemo(() => new THREE.MeshStandardMaterial({ color: "#bcd0ff", roughness: 0.15, transparent: true, opacity: 0.55 }), []);

  useFrame(({ clock }) => {
    const g = zs.current;
    if (!g) return;
    g.children.forEach((z, i) => {
      const u = (clock.elapsedTime * 0.35 + i * 0.34) % 1;
      z.position.set(-0.5 + (i % 2) * 1 + Math.sin(u * 6 + i) * 0.06, 0.75 + u * 0.75, 0.05);
      z.scale.setScalar(0.18 + u * 0.26);
      (z as THREE.Sprite).material.opacity = Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.95;
    });
  });

  return (
    <group>
      <B s={[1.9, 0.08, 0.92]} c={CREAM_DARK} />
      {PODS.map((x) => (
        <group key={x} position={[x, 0.08, 0]}>
          <B s={[0.84, 0.26, 0.7]} c={CREAM} />
          <B p={[0, 0.26, 0]} s={[0.7, 0.08, 0.56]} c={color} />
          <B p={[-0.26, 0.34, 0]} s={[0.22, 0.09, 0.4]} c="#fff8e6" />
          <mesh position={[0, 0.34, 0]} scale={[1, 0.72, 0.72]} material={lid} castShadow>
            <sphereGeometry args={[0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
      <Cyl p={[0, 0.08, -0.4]} r={0.03} h={0.95} c={CREAM_DARK} />
      <Ball p={[0, 1.12, -0.4]} r={0.11} c="#ffe27a" />
      <Ball p={[0.07, 1.14, -0.4]} r={0.095} c={color} />
      <group ref={zs}>
        {[0, 1, 2, 3].map((i) => (
          <sprite key={i}>
            <spriteMaterial map={zMap} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        ))}
      </group>
    </group>
  );
}
