import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { BuildingKind } from "../../content/buildings";
import { sim as game } from "../../app/game";

/** Roughly how tall each model is, so the flames sit on the roof. */
export const ROOF: Record<BuildingKind, number> = { cluster: 1.9, hall: 2.3, gateway: 1.5, kombucha: 0.9, nap: 0.7, snack: 0.9, demo: 1.5, fountain: 0.6, datacenter: 2.4, gas: 1.6, solar: 0.5 };

/**
 * A building that is out of order (FLT-10) pulses a red ring on the ground and burns a little on the roof (the smoke and
 * sparks are particles, in the FxDirector). Reads `broken` off the World each frame: nothing is written.
 */
export function BrokenFx({ id, kind, w, d }: { id: number; kind: BuildingKind; w: number; d: number }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const inner = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const b = game.world.buildings.find((o) => o.id === id);
    const on = !!b?.broken;
    g.visible = on;
    if (!on) return;
    const t = clock.elapsedTime;
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.32 + Math.abs(Math.sin(t * 5)) * 0.4;
    }
    flames.current.forEach((f, i) => {
      if (!f) return;
      const k = 0.75 + Math.abs(Math.sin(t * (7 + i * 2.3) + i * 1.7)) * 0.7;
      f.scale.set(1.05 * k, 1.7 * k, 1.05 * k);
      f.position.y = ROOF[kind] + 0.2 * k;
      f.rotation.z = Math.sin(t * 6 + i * 2) * 0.12;
      (f.material as THREE.MeshBasicMaterial).color.set(i % 2 ? "#ff8a1f" : "#ff5a1f");
      const g = inner.current[i];
      if (g) {
        g.scale.set(0.85 * k, 1.2 * k, 0.85 * k);
        g.position.y = ROOF[kind] + 0.14 * k;
        g.rotation.z = f.rotation.z;
      }
    });
  });
  const spots: [number, number][] = [[-0.28 * w, -0.2 * d], [0.22 * w, 0.12 * d], [0, 0.3 * d], [-0.05 * w, -0.32 * d]];
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.14} renderOrder={2}>
        <ringGeometry args={[Math.max(w, d) * 0.62, Math.max(w, d) * 0.78, 32]} />
        <meshBasicMaterial color="#ff3b1f" transparent opacity={0.5} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh ref={(m) => void (flames.current[i] = m)} position={[0, ROOF[kind], 0]}>
            <coneGeometry args={[0.17, 0.6, 7]} />
            <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
          </mesh>
          <mesh ref={(m) => void (inner.current[i] = m)} position={[0, ROOF[kind], 0.02]}>
            <coneGeometry args={[0.1, 0.42, 7]} />
            <meshBasicMaterial color="#ffe066" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
