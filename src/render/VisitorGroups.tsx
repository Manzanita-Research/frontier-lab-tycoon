import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { sim as game } from "../app/game";
import { groupKind } from "../sim/groups";
import { HALF } from "./coords";
import { CREW } from "./people";
import { SKIN } from "./look";
import { useSessionLooks } from "./useSessionLooks";

const CAP = 32;
/** The same scale as the crowd and the staff. */
const S = CREW;
const skins = SKIN.map((c) => new THREE.Color(c));
const dummy = new THREE.Object3D();
dummy.rotation.order = "YXZ";
const colors = new Map<string, THREE.Color>();
const colorOf = (look: Readonly<Record<string, unknown>> | undefined, key: string, fallback: string) => {
  const hex = typeof look?.[key] === "string" ? (look[key] as string) : fallback;
  let c = colors.get(hex);
  if (!c) colors.set(hex, (c = new THREE.Color(hex)));
  return c;
};

/**
 * Visitor groups (FLT-19): Evals Without Borders in hi-vis green vests with a reflective stripe, a clipboard held up in
 * front and a lanyard badge. Walking single file they bob; at a stop they stand and scribble (the clipboard dips, the
 * head nods at it). Colours come from the group kind's `look`, so another pack's group dresses itself. Read-only.
 */
export function VisitorGroups() {
  const body = useRef<THREE.InstancedMesh>(null);
  const vest = useRef<THREE.InstancedMesh>(null);
  const stripe = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const board = useRef<THREE.InstancedMesh>(null);
  const paper = useRef<THREE.InstancedMesh>(null);
  const badge = useRef<THREE.InstancedMesh>(null);
  const vestGeo = useMemo(() => new RoundedBoxGeometry(0.3 * S, 0.3 * S, 0.27 * S, 2, 0.06 * S), []);
  const stripeGeo = useMemo(() => new THREE.BoxGeometry(0.31 * S, 0.035 * S, 0.28 * S), []);
  const boardGeo = useMemo(() => new THREE.BoxGeometry(0.2 * S, 0.26 * S, 0.02 * S), []);
  const paperGeo = useMemo(() => new THREE.BoxGeometry(0.16 * S, 0.2 * S, 0.01 * S), []);
  const badgeGeo = useMemo(() => new THREE.BoxGeometry(0.07 * S, 0.09 * S, 0.02 * S), []);
  // FLT-102: a mod may dress a group kind (`group:auditors`); the rest draw as below.
  const looks = useSessionLooks("groups");
  const modded = looks.drawers.size > 0;

  useFrame(({ clock }) => {
    const w = game.world;
    const a = game.alpha;
    const t = clock.elapsedTime;
    let n = 0;
    const set = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, ry: number, rx = 0, rz = 0) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };
    if (modded) looks.drawers.forEach((d) => d.begin());
    for (const g of w.groups ?? []) {
      const drawer = modded ? looks.drawers.get(`group:${g.kind}`) : undefined;
      const look = groupKind(g.kind)?.look;
      const phase = g.machine.value;
      const huddling = phase === "huddling";
      const standing = phase === "inspecting" || phase === "evaluating" || huddling;
      for (const m of g.members) {
        if (n >= CAP) break;
        const x = m.px + (m.x - m.px) * a - HALF;
        const z = m.pz + (m.z - m.pz) * a - HALF;
        const moving = Math.abs(m.x - m.px) + Math.abs(m.z - m.pz) > 1e-4;
        const p = m.id * 1.7;
        const bob = (moving ? Math.abs(Math.sin(t * 10 + p)) * 0.045 : Math.sin(t * 1.3 + p) * 0.01) * S;
        // At a stop: scribble. The clipboard dips and shakes, the head nods at it.
        // In a huddle (FLT-56) they lean in and write twice as fast.
        const write = standing ? Math.max(0, Math.sin(t * (huddling ? 4.4 : 2.2) + p)) : 0;
        const nod = standing ? 0.18 + write * 0.2 + (huddling ? 0.2 : 0) : 0;
        const lean = huddling ? 0.22 : 0;
        const yaw = m.dir;
        if (drawer?.draw({ id: m.id, kind: "group" }, { x, z, yaw, t, phase: p, walking: moving, hop: 0, land: 0, env: write, signYaw: 0 })) continue;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        const i = n++;
        set(body.current, i, x, 0.26 * S + bob, z, yaw, lean);
        body.current?.setColorAt(i, colorOf(look, "shirt", "#f3efe4"));
        set(vest.current, i, x + fx * lean * 0.08, 0.33 * S + bob, z + fz * lean * 0.08, yaw, lean);
        vest.current?.setColorAt(i, colorOf(look, "vest", "#39b54a"));
        set(stripe.current, i, x + fx * lean * 0.07, 0.3 * S + bob, z + fz * lean * 0.07, yaw, lean);
        stripe.current?.setColorAt(i, colorOf(look, "stripe", "#e9f36a"));
        set(head.current, i, x + fx * (nod * 0.12 + lean * 0.3), (0.66 - lean * 0.08) * S + bob, z + fz * (nod * 0.12 + lean * 0.3), yaw, nod);
        head.current?.setColorAt(i, skins[(m.id * 5) % skins.length]!);
        // The clipboard: out in front at chest height, tilted up to read; lower and shaking while they write.
        const reach = 0.21 * S;
        const by = (standing ? 0.42 - write * 0.03 : 0.38) * S + bob;
        const shake = standing ? Math.sin(t * (huddling ? 30 : 22) + p) * 0.04 * write : 0;
        const bx = x + fx * reach + Math.cos(yaw) * 0.05 * S;
        const bz = z + fz * reach - Math.sin(yaw) * 0.05 * S;
        const tilt = standing ? -0.75 : -0.35;
        set(board.current, i, bx, by, bz, yaw + shake, tilt);
        board.current?.setColorAt(i, colorOf(look, "clipboard", "#b98a4e"));
        set(paper.current, i, bx + fx * 0.012 * S, by + 0.006 * S, bz + fz * 0.012 * S, yaw + shake, tilt);
        paper.current?.setColorAt(i, colorOf(look, "paper", "#ffffff"));
        // The lanyard badge on the vest, off to one side of the clipboard.
        set(badge.current, i, x + fx * 0.14 * S - Math.cos(yaw) * 0.07 * S, 0.44 * S + bob, z + fz * 0.14 * S + Math.sin(yaw) * 0.07 * S, yaw);
        badge.current?.setColorAt(i, colorOf(look, "lanyard", "#2f6fdf"));
      }
    }
    if (modded) looks.drawers.forEach((d) => d.end());
    for (const m of [body, vest, stripe, head, board, paper, badge]) {
      const mesh = m.current;
      if (!mesh) continue;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {modded && <primitive object={looks.group} />}
      <instancedMesh ref={body} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13 * S, 0.26 * S, 4, 8]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={vest} args={[vestGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={stripe} args={[stripeGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125 * S, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={board} args={[boardGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={paper} args={[paperGeo, undefined, CAP]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={badge} args={[badgeGeo, undefined, CAP]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  );
}
