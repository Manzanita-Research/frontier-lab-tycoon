import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getAlpha, useStore } from "../store";
import { HALF } from "./coords";
import { glowTexture } from "./materials";

const CAP = 512;
const HOODIES = ["#e8604c", "#f2b134", "#4f8ff0", "#8b6cf0", "#3fb58a"].map((c) => new THREE.Color(c));
const SKIN = ["#f6d2b0", "#e2a978", "#b57a4f", "#8a5a3a", "#f0c39a"].map((c) => new THREE.Color(c));
const SUITS = ["#8a93a3", "#2c3e66"].map((c) => new THREE.Color(c));

const dummy = new THREE.Object3D();
const heading = new Float32Array(4096);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Every walker in the game is an instance in one of a handful of InstancedMeshes,
 * updated straight from sim state each frame (interpolated between ticks).
 */
export function Walkers() {
  const rBody = useRef<THREE.InstancedMesh>(null);
  const rHead = useRef<THREE.InstancedMesh>(null);
  const aBody = useRef<THREE.InstancedMesh>(null);
  const aVisor = useRef<THREE.InstancedMesh>(null);
  const aGlow = useRef<THREE.InstancedMesh>(null);
  const vBody = useRef<THREE.InstancedMesh>(null);
  const vHead = useRef<THREE.InstancedMesh>(null);
  const glowMap = useMemo(() => glowTexture(), []);
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const visorGeo = useMemo(() => new THREE.BoxGeometry(0.25, 0.09, 0.07), []);
  const agentGeo = useMemo(() => new THREE.BoxGeometry(0.32, 0.34, 0.28), []);

  useFrame(({ clock }) => {
    const { sim } = useStore.getState();
    const a = getAlpha();
    const t = clock.elapsedTime;
    let nr = 0;
    let na = 0;
    let nv = 0;

    const set = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };

    for (const w of sim.walkers) {
      if (w.mode === "inside") continue;
      const slot = w.id % heading.length;
      heading[slot] = heading[slot]! + wrap(w.dir - heading[slot]!) * 0.25;
      const ry = heading[slot]!;
      const walking = w.route.length > 0;
      // A fixed lane offset per walker keeps a crowded path from becoming a single-file conga line.
      const ox = (((w.id * 37) % 100) / 100 - 0.5) * 0.3;
      const oz = (((w.id * 53) % 100) / 100 - 0.5) * 0.3;
      const x = lerp(w.px, w.x, a) - HALF + ox;
      const z = lerp(w.pz, w.z, a) - HALF + oz;
      const phase = w.id * 1.7;

      if (w.kind === "agent") {
        const bob = 0.26 + Math.sin(t * 3 + phase) * 0.04;
        const i = na++;
        set(aBody.current, i, x, bob + 0.17, z, ry, 1, 1, 1);
        set(aVisor.current, i, x + Math.sin(ry) * 0.15, bob + 0.22, z + Math.cos(ry) * 0.15, ry, 1, 1, 1);
        set(aGlow.current, i, x, 0.03, z, 0, 1.1 + Math.sin(t * 3 + phase) * 0.1, 1, 1.1 + Math.sin(t * 3 + phase) * 0.1);
        continue;
      }
      const bob = walking ? Math.abs(Math.sin(t * 10 + phase)) * 0.045 : 0;
      const squash = walking ? 1 + Math.sin(t * 20 + phase) * 0.04 : 1;
      if (w.kind === "researcher") {
        const i = nr++;
        set(rBody.current, i, x, 0.26 + bob, z, ry, 1, squash, 1);
        set(rHead.current, i, x, 0.66 + bob, z, ry, 1, 1, 1);
        rBody.current?.setColorAt(i, HOODIES[w.id % HOODIES.length]!);
        rHead.current?.setColorAt(i, SKIN[(w.id * 3) % SKIN.length]!);
      } else {
        const i = nv++;
        set(vBody.current, i, x, 0.26 + bob, z, ry, 1, squash, 1);
        set(vHead.current, i, x, 0.66 + bob, z, ry, 1, 1, 1);
        vBody.current?.setColorAt(i, SUITS[w.id % SUITS.length]!);
        vHead.current?.setColorAt(i, SKIN[(w.id * 5) % SKIN.length]!);
      }
    }

    const done = (m: THREE.InstancedMesh | null, n: number) => {
      if (!m) return;
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    done(rBody.current, nr);
    done(rHead.current, nr);
    done(aBody.current, na);
    done(aVisor.current, na);
    done(aGlow.current, na);
    done(vBody.current, nv);
    done(vHead.current, nv);
  });

  return (
    <group>
      <instancedMesh ref={rBody} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13, 0.26, 4, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={rHead} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>

      <instancedMesh ref={aBody} args={[agentGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#e9eef5" roughness={0.35} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={aVisor} args={[visorGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial color="#3ff0ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={aGlow} args={[glowGeo, undefined, CAP]} frustumCulled={false} renderOrder={2}>
        <meshBasicMaterial map={glowMap} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={vBody} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13, 0.3, 4, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={vHead} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
