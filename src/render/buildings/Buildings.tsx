import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { BUILDINGS, type BuildingKind } from "../../content/buildings";
import { atoms, sim as game } from "../../app/game";
import { useApp } from "../../app/hooks";
import { rectCenter } from "../coords";
import { ghostMaterials } from "../materials";
import { ClusterModel } from "./ClusterModel";
import { GateModel } from "./GateModel";
import { FountainModel } from "./FountainModel";
import { GatewayModel } from "./GatewayModel";
import { HallModel } from "./HallModel";
import { KombuchaModel } from "./KombuchaModel";

export function BuildingModel({ kind }: { kind: BuildingKind }) {
  const color = BUILDINGS[kind].color;
  switch (kind) {
    case "cluster":
      return <ClusterModel color={color} />;
    case "hall":
      return <HallModel color={color} />;
    case "gateway":
      return <GatewayModel color={color} />;
    case "kombucha":
      return <KombuchaModel color={color} />;
    case "fountain":
      return <FountainModel color={color} />;
  }
}

/** Squash-and-stretch pop when something lands. */
function Squash({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now() / 1000 + delay);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = performance.now() / 1000 - t0.current;
    if (t < 0) return void g.scale.set(0.001, 0.001, 0.001);
    if (t > 1.4) {
      if (g.scale.y !== 1) g.scale.set(1, 1, 1);
      return;
    }
    const k = Math.exp(-6 * t) * Math.cos(14 * t);
    g.scale.set(1 + 0.3 * k, 1 - k, 1 + 0.3 * k);
  });
  return <group ref={ref}>{children}</group>;
}

/** Turns a model into a translucent green/red ghost. */
export function Ghost({ ok, children }: { ok: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const mat = ok ? ghostMaterials.ok : ghostMaterials.bad;
  useEffect(() => {
    ref.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });
  }, [mat]);
  return <group ref={ref}>{children}</group>;
}

export function Buildings() {
  const buildings = useApp(atoms.buildings);
  const labName = useApp(atoms.labName);
  const sim = game.world;

  return (
    <>
      <group position={[rectCenter(sim.gate)[0], 0, rectCenter(sim.gate)[1]]}>
        <Squash>
          <GateModel labName={labName} />
        </Squash>
      </group>
      {buildings.map((b, i) => {
        const [cx, cz] = rectCenter(b);
        return (
          <group key={b.id} position={[cx, 0, cz]}>
            <Squash delay={b.placedTick === 0 ? 0.25 + i * 0.16 : 0}>
              <BuildingModel kind={b.kind} />
            </Squash>
          </group>
        );
      })}
    </>
  );
}
