import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SIGNS, SIGN_COLORS } from "../content/protest";
import { sim as game } from "../app/game";
import { HALF } from "./coords";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CHEER_SECONDS, fx } from "./fx/state";
import { FONT_STACK, glowTexture } from "./materials";
import { Follow } from "./follow";
import { HOODIES, PICKET, SKIN, SUITS } from "./look";
import { Pick } from "./Pick";
import { eraDef } from "../content/eras";
import { eraOfState } from "../sim/race/race";

const CAP = 512;
/** Every human gets a pair of glasses (one dark strip) so you can see which way they face and when they look around. */
const EYE_CAP = CAP * 3;
const SIGN_CAP = 64;
/** Walkers are drawn 1.6x life size so a crowd reads at the default zoom. */
const S = 1.6;
const color = (c: string) => new THREE.Color(c);
const hoodies = HOODIES.map(color);
const picket = PICKET.map(color);
const skins = SKIN.map(color);
const suits = new Map(Object.entries(SUITS).map(([role, c]) => [role, color(c)]));
const FALLBACK_SUIT = color("#8a93a3");
/** A slumped walker is drained of colour: blue-grey. */
const SLUMP_TINT = color("#7d879f");
/** Agents glow in their era's colour while aligned (cyan at first), violet as they drift, and hot pink once they've drifted for good. */
const DRIFT_VIOLET = color("#a07cff");
const DRIFT_PINK = color("#ff4f8a");
const HIGHLIGHT = color("#ffbe1a");
const SELECT = color("#ffffff");
const tint = new THREE.Color();
const driftColor = new THREE.Color();
/** Agent looks by era (content/eras.ts): body, visor, orb and glow tints, size, hard hat, halo. */
const LOOKS = [1, 2, 3, 4].map((n) => {
  const a = eraDef(n).agents;
  return { body: new THREE.Color(a.body), visor: new THREE.Color(a.visor), glow: new THREE.Color(a.glow), scale: a.scale, hat: a.hat, halo: a.halo };
});
const HAT = new THREE.Color("#ffc21a");

const dummy = new THREE.Object3D();
// Yaw first, then lean in the walker's own frame.
dummy.rotation.order = "YXZ";
const signDummy = new THREE.Object3D();
signDummy.rotation.order = "YXZ";
const dir = new THREE.Vector3();
const heading = new Float32Array(4096);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A placard: colour board, ink border, bold text wrapped to at most three lines. */
function signTexture(text: string, bg: string): THREE.CanvasTexture {
  const w = 320;
  const h = 180;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#3a2a1c";
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.fillRect(9, 9, w - 18, h - 18);
  g.fillStyle = "#b3261e";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const words = text.split(" ");
  for (let size = 76; size >= 26; size -= 4) {
    g.font = `900 ${size}px ${FONT_STACK}`;
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > w - 40 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    if (lines.length * size * 1.08 <= h - 30 && widest <= w - 40) {
      lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.08));
      break;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

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
  const aOrb = useRef<THREE.InstancedMesh>(null);
  const aHat = useRef<THREE.InstancedMesh>(null);
  const aHalo = useRef<THREE.InstancedMesh>(null);
  const vBody = useRef<THREE.InstancedMesh>(null);
  const vHead = useRef<THREE.InstancedMesh>(null);
  const pBody = useRef<THREE.InstancedMesh>(null);
  const pHead = useRef<THREE.InstancedMesh>(null);
  const pStick = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const lit = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Group>(null);
  const boards = useRef<(THREE.InstancedMesh | null)[]>([]);
  const glowMap = useMemo(() => glowTexture("#ffffff"), []);
  const signMaps = useMemo(() => SIGNS.map((text, i) => signTexture(text, SIGN_COLORS[i % SIGN_COLORS.length]!)), []);
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const haloGeo = useMemo(() => new THREE.RingGeometry(0.5, 0.72, 28).rotateX(-Math.PI / 2), []);
  const boardGeo = useMemo(() => new THREE.PlaneGeometry(1.3, 0.73), []);
  const visorGeo = useMemo(() => new THREE.BoxGeometry(0.25 * S, 0.09 * S, 0.07 * S), []);
  const agentGeo = useMemo(() => new RoundedBoxGeometry(0.34 * S, 0.34 * S, 0.3 * S, 3, 0.07 * S), []);
  const orbGeo = useMemo(() => new THREE.SphereGeometry(0.065 * S, 10, 8), []);
  const hatGeo = useMemo(() => new THREE.SphereGeometry(0.2 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const agentHaloGeo = useMemo(() => new THREE.TorusGeometry(0.2 * S, 0.02 * S, 6, 20).rotateX(Math.PI / 2), []);
  const stickGeo = useMemo(() => new THREE.BoxGeometry(0.045, 1, 0.045), []);
  const eyeGeo = useMemo(() => new THREE.BoxGeometry(0.17 * S, 0.042 * S, 0.05 * S), []);
  const boxGeo = useMemo(() => new RoundedBoxGeometry(0.34, 0.26, 0.3, 2, 0.03), []);

  useFrame(({ clock, camera }) => {
    const sim = game.world;
    const a = game.alpha;
    const t = clock.elapsedTime;
    const { selected } = game.ui;
    const litIds = game.highlightIds;
    // Placards turn to face the camera, so they read after a Q/E quarter-turn too.
    camera.getWorldDirection(dir);
    const signYaw = Math.atan2(-dir.x, -dir.z);
    let nr = 0;
    let na = 0;
    let nh = 0;
    let no = 0;
    let nv = 0;
    let np = 0;
    let ne = 0;
    let nx = 0;
    let nl = 0;
    let picked: { x: number; z: number } | null = null;
    const nb = new Array<number>(SIGNS.length).fill(0);
    // The agents look like the era: hard hats in Coding Automation, halos after that, bigger and brighter each time.
    const agentLook = LOOKS[eraOfState(sim) - 1]!;

    const set = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number, rx = 0) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };

    /** Glasses on the front of a head. */
    const glasses = (x: number, y: number, z: number, yaw: number) => {
      if (ne >= EYE_CAP) return;
      set(eyes.current, ne++, x + Math.sin(yaw) * 0.112 * S, y + 0.02 * S, z + Math.cos(yaw) * 0.112 * S, yaw, 1, 1, 1);
    };

    for (const w of sim.walkers) {
      if (w.machine.value === "inside") continue;
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
      if (w.id === selected) picked = { x, z };
      if (litIds.has(w.id) && lit.current) set(lit.current, nl++, x, 0.04, z, 0, 1.25 + Math.sin(t * 6) * 0.08, 1, 1.25 + Math.sin(t * 6) * 0.08);

      // A model shipped: everyone hops, in a ripple out from the Training Hall, and turns to face the camera.
      let hop = 0;
      let land = 0;
      let env = 0;
      const c = t - fx.cheerAt - Math.hypot(x - fx.cheerX, z - fx.cheerZ) * 0.06;
      if (c > 0 && c < CHEER_SECONDS) {
        env = 1 - c / CHEER_SECONDS;
        const u = Math.abs(Math.sin(c * 8.5 + phase * 0.25));
        hop = u * 0.42 * env;
        land = (1 - u) ** 6 * 0.2 * env;
      }
      // Idle walkers look around; cheering ones look at you.
      const look = !walking && env === 0 ? Math.sin(t * 0.9 + phase * 1.3) * 0.95 * (0.5 + 0.5 * Math.sin(t * 0.31 + phase)) : 0;
      const yaw = env > 0 ? ry + wrap(signYaw - ry) * Math.min(1, env * 1.6) : ry + look;
      const breath = !walking && env === 0 ? Math.sin(t * 2.2 + phase) * 0.014 : 0;

      if (w.kind === "agent") {
        const k = agentLook.scale;
        const bob = (0.26 + Math.sin(t * 3 + phase) * 0.04) * S * k + hop;
        const i = na++;
        set(aBody.current, i, x, bob + 0.17 * S * k, z, ry, k, k, k);
        set(aVisor.current, i, x + Math.sin(ry) * 0.15 * S * k, bob + 0.22 * S * k, z + Math.cos(ry) * 0.15 * S * k, ry, k, k, k);
        set(aOrb.current, i, x, bob + 0.5 * S * k + Math.sin(t * 6 + phase) * 0.015, z, 0, k, k, k);
        const pulse = (1.9 + Math.sin(t * 3 + phase) * 0.2) * (1 + env * 0.4) * k;
        set(aGlow.current, i, x, 0.03, z, 0, pulse, 1, pulse);
        aBody.current?.setColorAt(i, agentLook.body);
        // Drift shows: the era's own colour while aligned, through violet, to hot pink.
        const d = w.drift * 2;
        const stage = Math.min(1, Math.floor(d));
        const from = stage === 0 ? agentLook.visor : DRIFT_VIOLET;
        driftColor.copy(from).lerp(stage === 0 ? DRIFT_VIOLET : DRIFT_PINK, d - stage);
        aVisor.current?.setColorAt(i, driftColor);
        aOrb.current?.setColorAt(i, driftColor);
        aGlow.current?.setColorAt(i, d < 0.01 ? agentLook.glow : driftColor);
        if (agentLook.hat) {
          set(aHat.current, nh, x, bob + 0.33 * S * k, z, ry, k, k, k);
          aHat.current?.setColorAt(nh++, HAT);
        }
        if (agentLook.halo) {
          const pulseH = 1 + Math.sin(t * 4 + phase) * 0.06;
          set(aHalo.current, no, x, bob + 0.66 * S * k + Math.sin(t * 2.5 + phase) * 0.03, z, t * 1.5 + phase, k * pulseH, k, k * pulseH);
          aHalo.current?.setColorAt(no++, agentLook.glow);
        }
        continue;
      }
      if (w.kind === "protester") {
        // Chanting: a steady hop while standing, a march bob while walking, and a placard that waves.
        const bob = (walking ? Math.abs(Math.sin(t * 10 + phase)) * 0.045 : Math.abs(Math.sin(t * 5 + phase)) * 0.05) * S + hop;
        const i = np++;
        set(pBody.current, i, x, 0.26 * S + bob, z, ry, 1 + land * 0.6, 1 - land, 1 + land * 0.6);
        set(pHead.current, i, x, 0.66 * S + bob - land * 0.1, z, ry, 1, 1, 1);
        glasses(x, 0.66 * S + bob - land * 0.1, z, ry);
        pBody.current?.setColorAt(i, picket[w.id % picket.length]!);
        pHead.current?.setColorAt(i, skins[(w.id * 7) % skins.length]!);
        const wave = Math.sin(t * 5 + phase) * 0.14;
        // The pole runs from the fist up to the board.
        set(pStick.current, i, x, 1.25 + bob, z, 0, 1, 1, 1);
        const which = w.id % SIGNS.length;
        const board = boards.current[which];
        if (board) {
          const k = nb[which]!++;
          signDummy.position.set(x, 2.1 + bob + Math.abs(wave) * 0.15, z);
          signDummy.rotation.set(0, signYaw, wave);
          signDummy.scale.set(1, 1, 1);
          signDummy.updateMatrix();
          board.setMatrixAt(k, signDummy.matrix);
        }
        continue;
      }
      // Researchers and visitors: an unhappy walker slumps (leans in, head down, a slow shuffle, colours drained),
      // and a researcher on the way out carries a box. A cheer makes everyone hop; idle ones look around and breathe.
      const mood = w.mood.value;
      const slump = mood === "miserable" ? 1 : mood === "slumped" ? 0.7 : 0;
      const pace = slump > 0 ? 6.5 : 10;
      const bob = (walking ? Math.abs(Math.sin(t * pace + phase)) * (slump > 0 ? 0.025 : 0.045) : slump > 0 ? 0 : Math.sin(t * 1.3 + phase) * 0.008) * S + hop;
      const squash = (walking && slump === 0 ? 1 + Math.sin(t * 20 + phase) * 0.04 : 1 + breath) - land;
      const wide = 1 + land * 0.6;
      const lean = slump * 0.42;
      const cy = 0.26 * S;
      const hy = 0.66 * S;
      const sn = Math.sin(lean);
      const cs = Math.cos(lean);
      // Pivot at the feet: the lean moves the centre of the body forward and down a touch.
      const fwx = Math.sin(yaw);
      const fwz = Math.cos(yaw);
      const droop = slump * 0.07 * S;
      const bodyX = x + fwx * cy * sn;
      const bodyZ = z + fwz * cy * sn;
      const headX = x + fwx * (hy * sn + droop);
      const headZ = z + fwz * (hy * sn + droop);
      const headY = hy * cs - droop * 0.8 + bob - land * 0.1;
      let body: THREE.InstancedMesh | null;
      let head: THREE.InstancedMesh | null;
      let bodyCol: THREE.Color;
      let i: number;
      if (w.kind === "researcher") {
        i = nr++;
        body = rBody.current;
        head = rHead.current;
        bodyCol = hoodies[w.id % hoodies.length]!;
        set(head, i, headX, headY, headZ, yaw, 1, 1, 1);
        head?.setColorAt(i, slump > 0 ? tint.copy(skins[(w.id * 3) % skins.length]!).lerp(SLUMP_TINT, 0.25 * slump) : skins[(w.id * 3) % skins.length]!);
      } else {
        i = nv++;
        body = vBody.current;
        head = vHead.current;
        bodyCol = suits.get(w.role) ?? FALLBACK_SUIT;
        set(head, i, headX, headY, headZ, yaw, 1, 1, 1);
        head?.setColorAt(i, slump > 0 ? tint.copy(skins[(w.id * 5) % skins.length]!).lerp(SLUMP_TINT, 0.25 * slump) : skins[(w.id * 5) % skins.length]!);
      }
      glasses(headX, headY, headZ, yaw);
      set(body, i, bodyX, cy * cs + bob, bodyZ, yaw, wide, squash, wide, lean);
      body?.setColorAt(i, slump > 0 ? tint.copy(bodyCol).lerp(SLUMP_TINT, 0.5 * slump) : bodyCol);
      if (w.machine.value === "quitting" && boxes.current) {
        // A cardboard box held at the chest, bobbing with the walk.
        set(boxes.current, nx++, x + fwx * 0.3 * S, 0.46 * S + bob, z + fwz * 0.3 * S, yaw, 1, 1, 1);
      }
    }

    // The selection marker: a ring on the ground under the tapped walker and a bouncing arrow over their head.
    const marker = ring.current;
    if (marker) {
      marker.visible = picked !== null;
      if (picked) {
        marker.position.set(picked.x, 0, picked.z);
        const pulse = 1 + Math.sin(t * 5) * 0.08;
        marker.scale.set(pulse, 1, pulse);
        const arrow = marker.children[1];
        if (arrow) arrow.position.y = 2.15 + Math.abs(Math.sin(t * 4)) * 0.18;
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
    done(aOrb.current, na);
    done(aHat.current, nh);
    done(aHalo.current, no);
    done(vBody.current, nv);
    done(vHead.current, nv);
    done(pBody.current, np);
    done(pHead.current, np);
    done(pStick.current, np);
    done(eyes.current, ne);
    done(boxes.current, nx);
    done(lit.current, nl);
    boards.current.forEach((m, i) => done(m, nb[i] ?? 0));
  });

  return (
    <group>
      <instancedMesh ref={rBody} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13 * S, 0.26 * S, 4, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={rHead} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125 * S, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>

      <instancedMesh ref={aBody} args={[agentGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} emissive="#1de9ff" emissiveIntensity={0.1} />
      </instancedMesh>
      <instancedMesh ref={aVisor} args={[visorGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={aOrb} args={[orbGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={aHat} args={[hatGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={aHalo} args={[agentHaloGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      {/* A faint additive disc under every agent, so the swarm reads from across the map. */}
      <instancedMesh ref={aGlow} args={[glowGeo, undefined, CAP]} frustumCulled={false} renderOrder={2}>
        <meshBasicMaterial map={glowMap} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={vBody} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13 * S, 0.3 * S, 4, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={vHead} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125 * S, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>

      <instancedMesh ref={pBody} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.13 * S, 0.26 * S, 4, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={pHead} args={[undefined, undefined, CAP]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.125 * S, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={eyes} args={[eyeGeo, undefined, EYE_CAP]} frustumCulled={false}>
        <meshStandardMaterial color="#2a1d14" roughness={0.5} />
      </instancedMesh>

      <instancedMesh ref={pStick} args={[stickGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#8a5a3a" roughness={0.9} />
      </instancedMesh>
      {SIGNS.map((text, i) => (
        <instancedMesh key={text} ref={(m) => void (boards.current[i] = m)} args={[boardGeo, undefined, SIGN_CAP]} frustumCulled={false}>
          <meshBasicMaterial map={signMaps[i]} toneMapped={false} side={THREE.DoubleSide} />
        </instancedMesh>
      ))}

      {/* A researcher walking out for good carries a cardboard box. */}
      <instancedMesh ref={boxes} args={[boxGeo, undefined, SIGN_CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#c99a55" roughness={0.9} />
      </instancedMesh>

      {/* Everyone thinking the Thoughts row you tapped gets a golden halo. */}
      <instancedMesh ref={lit} args={[haloGeo, undefined, CAP]} frustumCulled={false} renderOrder={3}>
        <meshBasicMaterial color={HIGHLIGHT} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </instancedMesh>

      {/* The selected walker: a ring at their feet and a bouncing arrow over their head. */}
      <group ref={ring} visible={false}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.05} renderOrder={4}>
          <ringGeometry args={[0.55, 0.72, 32]} />
          <meshBasicMaterial color={SELECT} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh rotation-x={Math.PI} position-y={2.15} renderOrder={4}>
          <coneGeometry args={[0.2, 0.36, 4]} />
          <meshBasicMaterial color="#ffd24a" toneMapped={false} />
        </mesh>
      </group>

      <Pick />
      <Follow />
    </group>
  );
}
