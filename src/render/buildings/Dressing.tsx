import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import type { Dressing } from "../../sim/types";
import { windowMat } from "../fx/glow";
import { boxGeo, cylGeo, std } from "../materials";

/** Window glass with the lights off: dark at any hour. */
const darkWindowMat = new THREE.MeshStandardMaterial({ color: "#1d2230", roughness: 0.4 });

const live = (d: Dressing) => d.until > game.world.tick;
const dressingOf = (id: number) => game.world.dressing?.filter((d) => d.building === id && live(d)) ?? [];

/**
 * FLT-101: a building's lights out (`building.lights`). Reads `state.dressing` each frame and, only when it changes,
 * swaps the model's window glass for dark glass and back. Nothing is written to the World.
 */
export function LightsOut({ id, children }: { id: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const dark = useRef(false);
  useFrame(() => {
    const g = group.current;
    const now = dressingOf(id).some((d) => d.dark);
    if (!g || now === dark.current) return;
    dark.current = now;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (now && m.material === windowMat) m.material = darkWindowMat;
      else if (!now && m.material === darkWindowMat) m.material = windowMat;
    });
  });
  return <group ref={group}>{children}</group>;
}

const SOCK = std("#d9473a");
const SOCK_BAND = std("#f4efe2");
const HANDLE = std("#c9a24a", 0.4);
const HANGER = std("#b3261e");

/**
 * FLT-101: whatever `building.prop` hung on a building's door, on the front face (+z) about waist high: a sock on the
 * handle, or a do-not-disturb hanger. Shown and hidden from `state.dressing` each frame.
 */
export function DoorProps({ id, w, d }: { id: number; w: number; d: number }) {
  const door = useRef<THREE.Group>(null);
  const sock = useRef<THREE.Group>(null);
  const dnd = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const on = dressingOf(id);
    // Nothing hung, nothing drawn: not even the handle, so an undressed lab looks exactly as it did.
    if (door.current) door.current.visible = on.some((o) => o.prop);
    if (sock.current) {
      sock.current.visible = on.some((o) => o.prop === "sock");
      // It sways a little, as a sock on a handle does.
      sock.current.rotation.z = Math.sin(clock.elapsedTime * 1.7 + id) * 0.08;
    }
    if (dnd.current) dnd.current.visible = on.some((o) => o.prop === "dnd");
  });
  const at: [number, number, number] = [Math.min(0.32, w * 0.16), 0.62, d * 0.43 + 0.06];
  return (
    <group ref={door} position={at} visible={false}>
      <mesh geometry={cylGeo} material={HANDLE} rotation-x={Math.PI / 2} scale={[0.035, 0.08, 0.035]} />
      <group ref={sock} visible={false} position={[0, 0, 0.05]}>
        <mesh geometry={boxGeo} material={SOCK_BAND} position={[0, -0.05, 0]} scale={[0.09, 0.05, 0.04]} castShadow />
        <mesh geometry={boxGeo} material={SOCK} position={[0, -0.16, 0]} scale={[0.08, 0.18, 0.035]} castShadow />
        <mesh geometry={boxGeo} material={SOCK_BAND} position={[0, -0.21, 0.001]} scale={[0.082, 0.025, 0.037]} />
        <mesh geometry={boxGeo} material={SOCK} position={[0.04, -0.27, 0]} scale={[0.15, 0.07, 0.04]} castShadow />
      </group>
      <group ref={dnd} visible={false} position={[0, -0.12, 0.04]}>
        <mesh geometry={boxGeo} material={HANGER} scale={[0.12, 0.22, 0.012]} castShadow />
        <mesh geometry={boxGeo} material={SOCK_BAND} position={[0, 0.02, 0.007]} scale={[0.09, 0.03, 0.002]} />
      </group>
    </group>
  );
}
