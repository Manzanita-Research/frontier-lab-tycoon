// FLT-105: rainbow trails behind everyone who walks, while a trip is on. A ring of flat discs on the ground, dropped
// where each walker is every eighth of a second, shrinking away over a second and a half. Each disc keeps the hue it
// was dropped with, so a trail is a rainbow, and only its size fades (never its brightness).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../../app/game";
import { tripNow } from "../../ui/juice/tripState";
import { HALF } from "../coords";

const CAP = 2400;
const EVERY = 0.12;
const LIFE = 1.6;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function TripTrails() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.CircleGeometry(0.11, 12).rotateX(-Math.PI / 2), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  useEffect(() => () => (geo.dispose(), mat.dispose()), [geo, mat]);
  const ring = useMemo(() => ({ x: new Float32Array(CAP), z: new Float32Array(CAP), born: new Float32Array(CAP).fill(-99), next: 0, at: 0 }), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const im = mesh.current;
    if (!im) return;
    const t = clock.elapsedTime;
    const k = tripNow.trails;
    if (k > 0.01 && t - ring.at >= EVERY) {
      ring.at = t;
      const w = game.world;
      const a = game.alpha;
      for (const p of w.walkers) {
        if (p.machine.value === "inside" || p.route.length === 0) continue;
        const i = ring.next;
        ring.next = (i + 1) % CAP;
        ring.x[i] = lerp(p.px, p.x, a) - HALF + (((p.id * 37) % 100) / 100 - 0.5) * 0.3;
        ring.z[i] = lerp(p.pz, p.z, a) - HALF + (((p.id * 53) % 100) / 100 - 0.5) * 0.3;
        ring.born[i] = t;
        im.setColorAt(i, c.setHSL(((p.id * 47 + t * 40) % 360) / 360, 0.75, 0.6));
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    let shown = 0;
    for (let i = 0; i < CAP; i++) {
      const age = t - ring.born[i]!;
      const s = age < 0 || age > LIFE ? 0 : k * (1 - age / LIFE);
      if (s > 0) shown++;
      m.makeScale(s, 1, s).setPosition(ring.x[i]!, 0.03, ring.z[i]!);
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    im.visible = shown > 0;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, CAP]} frustumCulled={false} />;
}
