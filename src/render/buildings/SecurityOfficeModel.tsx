import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import { CREAM, CREAM_DARK, boxGeo, labelTexture, std } from "../materials";
import { B, Ball, Cyl, Glass } from "./Parts";

/** A guardhouse with a wall of monitors, a dish, and a light bar that only flashes while a disaster is on (FLT-17). */
export function SecurityOfficeModel({ color }: { color: string }) {
  const red = useRef<THREE.MeshBasicMaterial>(null);
  const blue = useRef<THREE.MeshBasicMaterial>(null);
  const sign = useMemo(() => labelTexture("SECURITY", { w: 256, h: 64, bg: color, fg: "#fffaf0" }), [color]);
  const signMat = useMemo(() => new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }), [sign]);

  useFrame(({ clock }) => {
    const on = game.world.disasters.runs.length > 0;
    const t = clock.elapsedTime * 9;
    // Alternating red and blue, on while anything is going wrong; a dim standby glow the rest of the time.
    if (red.current) red.current.color.setScalar(on ? (Math.sin(t) > 0 ? 1 : 0.15) : 0.25);
    if (blue.current) blue.current.color.setScalar(on ? (Math.sin(t) > 0 ? 0.15 : 1) : 0.25);
  });

  return (
    <group>
      <B s={[1.86, 0.1, 1.86]} c={CREAM_DARK} />
      <B p={[0, 0.1, 0]} s={[1.5, 0.9, 1.2]} c={CREAM} />
      <B p={[0, 1.0, 0]} s={[1.62, 0.1, 1.32]} c={color} />
      {/* Windows down the front and a door at the left. */}
      <Glass p={[0.28, 0.62, 0.606]} s={[0.7, 0.32, 0.02]} />
      <Glass p={[0.78, 0.62, 0]} s={[0.02, 0.32, 0.7]} />
      <B p={[-0.5, 0.1, 0.6]} s={[0.36, 0.62, 0.04]} c={CREAM_DARK} />
      {/* The sign, both faces of one material. */}
      <mesh position={[0.28, 0.98, 0.72]} geometry={boxGeo} material={std(CREAM_DARK)} scale={[0.86, 0.22, 0.06]} castShadow />
      <mesh position={[0.28, 0.98, 0.755]} scale={[0.8, 0.18, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={signMat} attach="material" />
      </mesh>
      {/* Light bar and dish. */}
      <B p={[0.3, 1.1, -0.1]} s={[0.56, 0.08, 0.16]} c={CREAM_DARK} />
      <mesh position={[0.1, 1.24, -0.1]} geometry={boxGeo} scale={[0.24, 0.16, 0.14]}>
        <meshBasicMaterial ref={red} color="#ff3b30" toneMapped={false} />
      </mesh>
      <mesh position={[0.5, 1.24, -0.1]} geometry={boxGeo} scale={[0.24, 0.16, 0.14]}>
        <meshBasicMaterial ref={blue} color="#3b82ff" toneMapped={false} />
      </mesh>
      <Cyl p={[-0.5, 1.1, -0.3]} r={0.03} h={0.4} c={CREAM_DARK} />
      <Ball p={[-0.5, 1.55, -0.3]} r={0.08} c={color} />
    </group>
  );
}
