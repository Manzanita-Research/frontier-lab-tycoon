import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { appNow, sim as game } from "../app/game";
import { STAFF } from "../content/staff";
import type { StaffJob } from "../sim/types";
import { HALF } from "./coords";
import { SKIN } from "./look";

const CAP = 48;
/** The same 1.6x as the crowd, so staff read at the default zoom. */
const S = 1.75;
const color = (c: string) => new THREE.Color(c);
const BODY: Record<StaffJob, THREE.Color> = { janitor: color(STAFF.janitor.color), sre: color(STAFF.sre.color), comms: color(STAFF.comms.color), security: color(STAFF.security.color) };
const skins = SKIN.map(color);
const HARDHAT = color("#ffd21a");
const CAP_NAVY = color("#22348f");
const TOTE = color("#ffe08a");
const MOP = color("#f4f1e6");
const VISOR = color("#ffffff");
const dummy = new THREE.Object3D();
dummy.rotation.order = "YXZ";

/**
 * Staff (FLT-10): Janitor Bots (a boxy teal robot with a mop), SREs (hi-vis orange, a yellow hard hat, a jog), Comms
 * Reps (purple, carrying a tote bag) and Security (navy, a cap). One InstancedMesh per part, updated from `world.staff`
 * each frame, interpolated like the crowd. Read-only.
 */
export function StaffCrew() {
  const humanBody = useRef<THREE.InstancedMesh>(null);
  const botBody = useRef<THREE.InstancedMesh>(null);
  const botVisor = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const hat = useRef<THREE.InstancedMesh>(null);
  const mopPole = useRef<THREE.InstancedMesh>(null);
  const mopHead = useRef<THREE.InstancedMesh>(null);
  const tote = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.InstancedMesh>(null);
  // The red "!" over a staffer a disaster has pulled off their post (FLT-17): a stem and a dot.
  const bangStem = useRef<THREE.InstancedMesh>(null);
  const bangDot = useRef<THREE.InstancedMesh>(null);
  const botGeo = useMemo(() => new RoundedBoxGeometry(0.34 * S, 0.4 * S, 0.3 * S, 3, 0.07 * S), []);
  const visorGeo = useMemo(() => new THREE.BoxGeometry(0.24 * S, 0.08 * S, 0.06 * S), []);
  const hatGeo = useMemo(() => new THREE.SphereGeometry(0.16 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const poleGeo = useMemo(() => new THREE.BoxGeometry(0.035, 1, 0.035), []);
  const mopGeo = useMemo(() => new THREE.BoxGeometry(0.26, 0.09, 0.14), []);
  const toteGeo = useMemo(() => new RoundedBoxGeometry(0.2, 0.22, 0.08, 2, 0.02), []);

  useFrame(({ clock }) => {
    const w = game.world;
    const a = game.alpha;
    const t = clock.elapsedTime;
    let nh = 0;
    let nb = 0;
    let nhat = 0;
    let nm = 0;
    let nt = 0;
    let nr = 0;
    let nbang = 0;
    const set = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, ry: number, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };
    for (const s of w.staff) {
      const x = s.px + (s.x - s.px) * a - HALF;
      const z = s.pz + (s.z - s.pz) * a - HALF;
      const phase = s.id * 1.9;
      const phaseName = s.machine.value;
      const moving = s.route.length > 0;
      const working = phaseName === "working";
      const jog = s.job === "sre" && (phaseName === "going" || phaseName === "arriving");
      const pace = jog ? 15 : 10;
      const bob = (moving ? Math.abs(Math.sin(t * pace + phase)) * (jog ? 0.07 : 0.045) : working ? Math.abs(Math.sin(t * 9 + phase)) * 0.035 : Math.sin(t * 1.4 + phase) * 0.01) * S;
      const yaw = s.dir;
      const lean = jog ? 0.3 : 0;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      if (s.machine.value === "leaving" && !moving) continue;
      if (s.divert && phaseName !== "leaving") {
        // Panic pulse: the "!" hops while they jog to the incident.
        const top = (s.job === "janitor" ? 1.1 : 1.85) + Math.abs(Math.sin(t * 7 + phase)) * 0.09;
        set(bangStem.current, nbang, x, top + 0.2, z, 0, 0.075, 0.26, 0.075);
        set(bangDot.current, nbang, x, top - 0.03, z, 0, 0.095, 0.095, 0.095);
        nbang++;
      }
      if (s.job === "janitor") {
        const i = nb++;
        const wob = working ? Math.sin(t * 14 + phase) * 0.12 : 0;
        set(botBody.current, i, x, 0.22 * S + bob, z, yaw + wob, 1, 1, 1);
        botBody.current?.setColorAt(i, BODY.janitor);
        set(botVisor.current, i, x + fx * 0.15 * S, 0.3 * S + bob, z + fz * 0.15 * S, yaw + wob);
        botVisor.current?.setColorAt(i, VISOR);
        // The mop: a pole held out in front, its head sweeping side to side while it works.
        const sweep = working ? Math.sin(t * 9 + phase) * 0.4 : Math.sin(t * 1.2 + phase) * 0.05;
        const mx = x + fx * 0.32 + Math.cos(yaw) * sweep * 0.5;
        const mz = z + fz * 0.32 - Math.sin(yaw) * sweep * 0.5;
        set(mopPole.current, nm, mx - fx * 0.08, 0.32 + bob * 0.5, mz - fz * 0.08, yaw, 1, 0.7, 1, -0.55 + (working ? 0.15 : 0));
        set(mopHead.current, nm, mx + fx * 0.06, 0.05 + bob * 0.2, mz + fz * 0.06, yaw + sweep * 0.5);
        mopPole.current?.setColorAt(nm, MOP);
        mopHead.current?.setColorAt(nm, MOP);
        nm++;
        continue;
      }
      // The three human jobs: capsule body, round head, plus what makes them who they are.
      const i = nh++;
      const cy = 0.26 * S;
      const hy = 0.66 * S;
      const sn = Math.sin(lean);
      const cs = Math.cos(lean);
      const squash = working ? 1 + Math.sin(t * 16 + phase) * 0.05 : 1;
      set(humanBody.current, i, x + fx * cy * sn, cy * cs + bob, z + fz * cy * sn, yaw, 1, squash, 1, lean);
      humanBody.current?.setColorAt(i, BODY[s.job]);
      set(head.current, i, x + fx * hy * sn, hy * cs + bob, z + fz * hy * sn, yaw);
      head.current?.setColorAt(i, skins[(s.id * 3) % skins.length]!);
      if (s.job === "sre" || s.job === "security") {
        set(hat.current, nhat, x + fx * (hy + 0.07) * sn, hy * cs + 0.08 * S + bob, z + fz * (hy + 0.07) * sn, yaw, s.job === "sre" ? 1.1 : 1.02, s.job === "sre" ? 1 : 0.65, s.job === "sre" ? 1.1 : 1.15);
        hat.current?.setColorAt(nhat++, s.job === "sre" ? HARDHAT : CAP_NAVY);
      }
      if (s.job === "comms") {
        // A tote bag on the hip that swings; held out when handing one over.
        const give = working ? 0.28 : 0;
        set(tote.current, nt, x + fx * (0.16 + give) + Math.cos(yaw) * 0.16, 0.34 * S + bob + Math.sin(t * 6 + phase) * 0.015, z + fz * (0.16 + give) - Math.sin(yaw) * 0.16, yaw, 1, 1, 1, 0, Math.sin(t * 4 + phase) * 0.15);
        tote.current?.setColorAt(nt++, TOTE);
      }
    }
    // The zone being painted: a translucent tile under every square of it.
    const editing = appNow()?.zone ?? null;
    const zone = editing === null ? null : w.staff.find((o) => o.id === editing);
    if (zone && ring.current) {
      const c = BODY[zone.job];
      for (const idx of zone.zone) {
        if (nr >= 576) break;
        const tx = idx % w.grid.w;
        const tz = Math.floor(idx / w.grid.w);
        set(ring.current, nr, tx + 0.5 - HALF, 0.13, tz + 0.5 - HALF, 0, 0.93, 1, 0.93);
        ring.current.setColorAt(nr++, c);
      }
    }
    const done = (m: THREE.InstancedMesh | null, n: number) => {
      if (!m) return;
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    done(humanBody.current, nh);
    done(head.current, nh);
    done(hat.current, nhat);
    done(botBody.current, nb);
    done(botVisor.current, nb);
    done(mopPole.current, nm);
    done(mopHead.current, nm);
    done(tote.current, nt);
    done(ring.current, nr);
    done(bangStem.current, nbang);
    done(bangDot.current, nbang);
  });

  return (
    <group>
      <instancedMesh ref={humanBody} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13 * S, 0.26 * S, 4, 8]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125 * S, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={hat} args={[hatGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={botBody} args={[botGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.35} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={botVisor} args={[visorGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={mopPole} args={[poleGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={mopHead} args={[mopGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={tote} args={[toteGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bangStem} args={[undefined, undefined, CAP]} frustumCulled={false} renderOrder={3}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bangDot} args={[undefined, undefined, CAP]} frustumCulled={false} renderOrder={3}>
        <sphereGeometry args={[0.5, 10, 8]} />
        <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={ring} args={[undefined, undefined, 24 * 24]} frustumCulled={false} renderOrder={2}>
        <boxGeometry args={[1, 0.02, 1]} />
        <meshBasicMaterial transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
