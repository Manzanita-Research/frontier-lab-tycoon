import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { rectCenter } from "./coords";

const COUNT = 90;
const LIFE = 2.4;
const COLORS = ["#ff6b5e", "#ffd24a", "#4fd0ff", "#8b6cf0", "#5fe08a", "#ff8ac7"].map((c) => new THREE.Color(c));

interface Bit {
  p: THREE.Vector3;
  v: THREE.Vector3;
  spin: number;
}

/** A release throws confetti out of the Training Hall. Render-only: nothing here touches the sim. */
export function Confetti() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const bits = useMemo<Bit[]>(() => Array.from({ length: COUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0 })), []);
  const state = useRef({ models: useStore.getState().sim.models.length, age: LIFE + 1 });
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const sim = useStore.getState().sim;
    const st = state.current;
    if (sim.models.length !== st.models) {
      st.models = sim.models.length;
      st.age = 0;
      const hall = sim.buildings.find((b) => b.kind === "hall");
      const [cx, cz] = hall ? rectCenter(hall) : [0, 0];
      bits.forEach((b, i) => {
        b.p.set(cx, 2.3, cz);
        const a = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        b.v.set(Math.cos(a) * speed, 4 + Math.random() * 4, Math.sin(a) * speed);
        b.spin = (Math.random() - 0.5) * 20;
        m.setColorAt(i, COLORS[i % COLORS.length]!);
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    if (st.age > LIFE) {
      m.visible = false;
      return;
    }
    m.visible = true;
    st.age += dt;
    bits.forEach((b, i) => {
      b.v.y -= 9 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.05) {
        b.p.y = 0.05;
        b.v.multiplyScalar(0);
      }
      const fade = Math.min(1, (LIFE - st.age) * 2);
      dummy.position.copy(b.p);
      dummy.rotation.set(st.age * b.spin, st.age * b.spin * 0.7, 0);
      dummy.scale.setScalar(0.12 * Math.max(0.001, fade));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false} visible={false}>
      <boxGeometry args={[1, 0.3, 0.6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
