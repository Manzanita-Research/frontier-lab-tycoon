import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import { CREAM, CREAM_DARK, boxGeo, std } from "../materials";
import { Cyl } from "./Parts";

const SEGMENTS = 48;
const RADIUS = 1.32;

/**
 * A dome on a drum. The glowing ring around it fills with the current training
 * run's progress, the leading segment pulses, and a release makes the whole thing flash.
 */
export function HallModel({ color }: { color: string }) {
  const ring = useRef<THREE.InstancedMesh>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const seen = useRef({ lit: -1, models: game.world.models.length, flash: 0 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const palette = useMemo(() => {
    const lit = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.45);
    return { lit, off: new THREE.Color("#5b5270"), hot: new THREE.Color("#ffffff") };
  }, [color]);
  const tmp = useMemo(() => new THREE.Color(), []);
  const domeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f6f0ff", emissive: "#cdbcff", emissiveIntensity: 0.22, roughness: 0.3, flatShading: true }),
    [],
  );

  useEffect(() => {
    const mesh = ring.current;
    if (!mesh) return;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * RADIUS, 0.22, Math.sin(a) * RADIUS);
      dummy.rotation.set(0, -a - Math.PI / 2, 0);
      dummy.scale.set(0.15, 0.08, 0.1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, palette.off);
    }
    mesh.instanceMatrix.needsUpdate = true;
    seen.current.lit = -1;
  }, [dummy, palette]);

  useFrame(({ clock }, dt) => {
    const mesh = ring.current;
    if (!mesh) return;
    const sim = game.world;
    const st = seen.current;
    if (sim.models.length !== st.models) {
      st.models = sim.models.length;
      st.flash = 1.6;
    }
    st.flash = Math.max(0, st.flash - dt);
    const t = clock.elapsedTime;
    const lit = Math.floor((sim.training.context.progress / sim.training.context.cost) * SEGMENTS);
    const pulsing = st.flash > 0;
    for (let i = 0; i < SEGMENTS; i++) {
      if (pulsing) {
        const wave = 0.5 + 0.5 * Math.sin(t * 14 - i * 0.5);
        mesh.setColorAt(i, tmp.copy(palette.lit).lerp(palette.hot, wave));
      } else if (i < lit) {
        const head = i === lit - 1 ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
        mesh.setColorAt(i, tmp.copy(palette.lit).lerp(palette.hot, head * 0.8));
      } else if (i === lit) {
        // The segment currently "charging" breathes.
        mesh.setColorAt(i, tmp.copy(palette.off).lerp(palette.lit, 0.25 + 0.2 * Math.sin(t * 4)));
      } else if (st.lit !== lit || pulsing) {
        mesh.setColorAt(i, palette.off);
      }
    }
    st.lit = lit;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (beacon.current) beacon.current.color.set(pulsing ? "#ffffff" : color).multiplyScalar(0.8 + 0.2 * Math.sin(t * 3));
  });

  return (
    <group>
      <mesh geometry={boxGeo} material={std(CREAM_DARK)} position={[0, 0.08, 0]} scale={[2.86, 0.16, 2.86]} receiveShadow castShadow />
      <Cyl p={[0, 0.16, 0]} r={1.05} h={0.62} c={CREAM} />
      <mesh position={[0, 0.5, 0]} rotation-x={Math.PI / 2} material={std(color)} castShadow>
        <torusGeometry args={[1.05, 0.06, 6, 32]} />
      </mesh>
      <mesh position={[0, 0.78, 0]} material={domeMat} castShadow receiveShadow>
        <sphereGeometry args={[1.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Cyl p={[0, 1.78, 0]} r={0.03} h={0.42} c="#8a8fa0" />
      <mesh position={[0, 2.26, 0]} scale={0.1}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial ref={beacon} color={color} toneMapped={false} />
      </mesh>
      <instancedMesh ref={ring} args={[boxGeo, undefined, SEGMENTS]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
