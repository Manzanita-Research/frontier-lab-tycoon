import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { BuildingKind } from "../../content/buildings";
import { atoms, sim as game } from "../../app/game";
import { useApp } from "../../app/hooks";
import { rectCenter } from "../coords";
import { CHEER_SECONDS, fx } from "../fx/state";
import { ghostMaterials } from "../materials";
import { ClusterModel } from "./ClusterModel";
import { DatacenterModel } from "./DatacenterModel";
import { GasTurbineModel } from "./GasTurbineModel";
import { SolarFarmModel } from "./SolarFarmModel";
import { GateModel } from "./GateModel";
import { FountainModel } from "./FountainModel";
import { GatewayModel } from "./GatewayModel";
import { HallModel } from "./HallModel";
import { KombuchaModel } from "./KombuchaModel";
import { NapModel } from "./NapModel";
import { SnackModel } from "./SnackModel";
import { SecurityOfficeModel } from "./SecurityOfficeModel";
import { SandboxModel } from "./SandboxModel";
import { HoneypotModel } from "./HoneypotModel";
import { DemoModel } from "./DemoModel";
import { ModModel } from "./ModModel";
import { BrokenFx } from "./BrokenFx";
import { defs } from "../../sim/defs";

/** `id` lets a model that reacts to the world (the Demo Stage screen) find its building; the placement ghost has none. */
export function BuildingModel({ kind, id }: { kind: BuildingKind; id?: number }) {
  const def = defs().buildings[kind];
  const color = def.color;
  switch (kind) {
    case "cluster":
      return <ClusterModel color={color} />;
    case "hall":
      return <HallModel color={color} />;
    case "gateway":
      return <GatewayModel color={color} />;
    case "kombucha":
      return <KombuchaModel color={color} />;
    case "nap":
      return <NapModel color={color} />;
    case "snack":
      return <SnackModel color={color} />;
    case "demo":
      return <DemoModel color={color} id={id} />;
    case "fountain":
      return <FountainModel color={color} />;
    case "datacenter":
      return <DatacenterModel color={color} />;
    case "gas":
      return <GasTurbineModel color={color} />;
    case "solar":
      return <SolarFarmModel color={color} />;
    case "security":
      return <SecurityOfficeModel color={color} />;
    case "sandbox":
      return <SandboxModel color={color} />;
    case "honeypot":
      return <HoneypotModel color={color} />;
    default:
      // A kind a mod added: no model of its own yet.
      return <ModModel color={color} size={def.size} />;
  }
}

/**
 * Squash-and-stretch pop when something lands, then an idle breath. On a release the buildings bounce in a ripple out
 * from the Training Hall (`at` is this building's scene position).
 */
function Squash({ children, delay = 0, phase = 0, at }: { children: ReactNode; delay?: number; phase?: number; at?: [number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now() / 1000 + delay);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = performance.now() / 1000 - t0.current;
    if (t < 0) return void g.scale.set(0.001, 0.001, 0.001);
    if (t > 1.4) {
      // Idle: a slow breath, a percent or so, that never moves the base off the ground.
      let k = Math.sin(fx.time * 1.6 + phase) * 0.011;
      if (at) {
        const c = fx.time - fx.cheerAt - Math.hypot(at[0] - fx.cheerX, at[1] - fx.cheerZ) * 0.07;
        if (c > 0 && c < CHEER_SECONDS) k += Math.exp(-3.2 * c) * Math.abs(Math.sin(c * 9)) * 0.12;
      }
      g.scale.set(1 - k * 0.45, 1 + k, 1 - k * 0.45);
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
        <Squash phase={0.4} at={rectCenter(sim.gate)}>
          <GateModel labName={labName} />
        </Squash>
      </group>
      {buildings.map((b, i) => {
        const [cx, cz] = rectCenter(b);
        return (
          <group key={b.id} position={[cx, 0, cz]}>
            <Squash delay={b.placedTick === 0 ? 0.25 + i * 0.16 : 0} phase={b.id * 1.9} at={[cx, cz]}>
              <BuildingModel kind={b.kind} id={b.id} />
            </Squash>
            <BrokenFx id={b.id} kind={b.kind} w={b.w} d={b.d} />
          </group>
        );
      })}
    </>
  );
}
