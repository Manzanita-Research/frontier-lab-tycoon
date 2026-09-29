import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import { showEnds, showWorked } from "../../sim/demo";
import { CREAM, CREAM_DARK, labelTexture, std } from "../materials";
import { B, Ball, Cyl } from "./Parts";

/**
 * A stage with a big screen, a podium and two spotlights, and a small audience of chairs. The screen tells you how the
 * latest show went: magenta while it waits, green when it works, red when it flops.
 */
export function DemoModel({ color, id }: { color: string; id?: number }) {
  const screen = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef("idle");
  const maps = useMemo(
    () => ({
      idle: labelTexture("LIVE DEMO", { w: 512, h: 256, bg: color, fg: "#fffaf0" }),
      ok: labelTexture("IT WORKS!", { w: 512, h: 256, bg: "#2c9a58", fg: "#fffaf0" }),
      flop: labelTexture("ERROR 500", { w: 512, h: 256, bg: "#d6452f", fg: "#fffaf0" }),
    }),
    [color],
  );

  useFrame(() => {
    const m = screen.current;
    if (!m || id === undefined) return;
    const world = game.world;
    const b = world.buildings.find((o) => o.id === id);
    const state = b && world.tick < showEnds(world, b) ? (showWorked(world, b) ? "ok" : "flop") : "idle";
    if (state === shown.current) return;
    shown.current = state;
    m.map = maps[state as keyof typeof maps];
    m.needsUpdate = true;
  });

  return (
    <group>
      <B s={[1.92, 0.1, 1.92]} c={CREAM_DARK} />
      <B p={[0, 0.1, -0.5]} s={[1.76, 0.2, 0.8]} c={color} />
      <B p={[0, 0.3, -0.5]} s={[1.76, 0.03, 0.8]} c={CREAM} />
      <B p={[0, 0.3, -0.86]} s={[1.6, 1.15, 0.08]} c={CREAM_DARK} />
      <mesh position={[0, 0.9, -0.815]}>
        <planeGeometry args={[1.42, 0.9]} />
        <meshBasicMaterial ref={screen} map={maps.idle} toneMapped={false} />
      </mesh>
      <B p={[0.55, 0.33, -0.35]} s={[0.26, 0.42, 0.22]} c={CREAM} />
      <B p={[0.55, 0.75, -0.35]} s={[0.3, 0.05, 0.26]} c={color} />
      <Cyl p={[0.55, 0.8, -0.3]} r={0.012} h={0.2} c="#3a2a1c" />
      <Ball p={[0.55, 1.02, -0.3]} r={0.035} c="#3a2a1c" />
      {[-0.7, 0.7].map((x) => (
        <group key={x}>
          <Cyl p={[x, 0.3, -0.72]} r={0.04} h={1.3} c={CREAM_DARK} />
          <mesh position={[x, 1.6, -0.62]} rotation-x={0.6} material={std("#3a2a1c")} castShadow>
            <cylinderGeometry args={[0.1, 0.06, 0.2, 10]} />
          </mesh>
          <mesh position={[x * 0.85, 1.05, -0.28]} rotation-x={0.42} scale={[1, 1, 1]}>
            <coneGeometry args={[0.4, 1.0, 14, 1, true]} />
            <meshBasicMaterial color="#fff2b0" transparent opacity={0.11} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[0.2, 0.62].map((z) =>
        [-0.62, -0.21, 0.21, 0.62].map((x) => (
          <group key={`${x}${z}`} position={[x, 0.1, z + 0.12]}>
            <B s={[0.26, 0.1, 0.24]} c={z < 0.5 ? color : "#fff8e6"} />
            <B p={[0, 0.1, -0.1]} s={[0.26, 0.24, 0.05]} c={z < 0.5 ? color : "#fff8e6"} />
          </group>
        )),
      )}
    </group>
  );
}
