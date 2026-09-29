import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SIGNS, SIGN_COLORS } from "../content/protest";
import { sim as game } from "../app/game";
import { HALF } from "./coords";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FONT_STACK, glowTexture } from "./materials";

const CAP = 512;
const SIGN_CAP = 64;
/** Walkers are drawn 1.6x life size so a crowd reads at the default zoom. */
const S = 1.6;
const HOODIES = ["#e8604c", "#f2b134", "#4f8ff0", "#8b6cf0", "#3fb58a"].map((c) => new THREE.Color(c));
const PICKET = ["#d9482f", "#f2b134", "#3b8f5f", "#7a5cd6", "#2f80c9"].map((c) => new THREE.Color(c));
const SKIN = ["#f6d2b0", "#e2a978", "#b57a4f", "#8a5a3a", "#f0c39a"].map((c) => new THREE.Color(c));
const SUITS = ["#8a93a3", "#2c3e66"].map((c) => new THREE.Color(c));

const dummy = new THREE.Object3D();
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
  const vBody = useRef<THREE.InstancedMesh>(null);
  const vHead = useRef<THREE.InstancedMesh>(null);
  const pBody = useRef<THREE.InstancedMesh>(null);
  const pHead = useRef<THREE.InstancedMesh>(null);
  const pStick = useRef<THREE.InstancedMesh>(null);
  const boards = useRef<(THREE.InstancedMesh | null)[]>([]);
  const glowMap = useMemo(() => glowTexture(), []);
  const signMaps = useMemo(() => SIGNS.map((text, i) => signTexture(text, SIGN_COLORS[i % SIGN_COLORS.length]!)), []);
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const boardGeo = useMemo(() => new THREE.PlaneGeometry(1.3, 0.73), []);
  const visorGeo = useMemo(() => new THREE.BoxGeometry(0.25 * S, 0.09 * S, 0.07 * S), []);
  const agentGeo = useMemo(() => new RoundedBoxGeometry(0.34 * S, 0.34 * S, 0.3 * S, 3, 0.07 * S), []);
  const orbGeo = useMemo(() => new THREE.SphereGeometry(0.065 * S, 10, 8), []);
  const stickGeo = useMemo(() => new THREE.BoxGeometry(0.045, 1, 0.045), []);

  useFrame(({ clock, camera }) => {
    const sim = game.world;
    const a = game.alpha;
    const t = clock.elapsedTime;
    // Placards turn to face the camera, so they read after a Q/E quarter-turn too.
    camera.getWorldDirection(dir);
    const signYaw = Math.atan2(-dir.x, -dir.z);
    let nr = 0;
    let na = 0;
    let nv = 0;
    let np = 0;
    const nb = new Array<number>(SIGNS.length).fill(0);

    const set = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, ry, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
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

      if (w.kind === "agent") {
        const bob = (0.26 + Math.sin(t * 3 + phase) * 0.04) * S;
        const i = na++;
        set(aBody.current, i, x, bob + 0.17 * S, z, ry, 1, 1, 1);
        set(aVisor.current, i, x + Math.sin(ry) * 0.15 * S, bob + 0.22 * S, z + Math.cos(ry) * 0.15 * S, ry, 1, 1, 1);
        set(aOrb.current, i, x, bob + 0.5 * S + Math.sin(t * 6 + phase) * 0.015, z, 0, 1, 1, 1);
        const pulse = 1.9 + Math.sin(t * 3 + phase) * 0.2;
        set(aGlow.current, i, x, 0.03, z, 0, pulse, 1, pulse);
        continue;
      }
      if (w.kind === "protester") {
        // Chanting: a steady hop while standing, a march bob while walking, and a placard that waves.
        const bob = (walking ? Math.abs(Math.sin(t * 10 + phase)) * 0.045 : Math.abs(Math.sin(t * 5 + phase)) * 0.05) * S;
        const i = np++;
        set(pBody.current, i, x, 0.26 * S + bob, z, ry, 1, 1, 1);
        set(pHead.current, i, x, 0.66 * S + bob, z, ry, 1, 1, 1);
        pBody.current?.setColorAt(i, PICKET[w.id % PICKET.length]!);
        pHead.current?.setColorAt(i, SKIN[(w.id * 7) % SKIN.length]!);
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
      const bob = (walking ? Math.abs(Math.sin(t * 10 + phase)) * 0.045 : 0) * S;
      const squash = walking ? 1 + Math.sin(t * 20 + phase) * 0.04 : 1;
      if (w.kind === "researcher") {
        const i = nr++;
        set(rBody.current, i, x, 0.26 * S + bob, z, ry, 1, squash, 1);
        set(rHead.current, i, x, 0.66 * S + bob, z, ry, 1, 1, 1);
        rBody.current?.setColorAt(i, HOODIES[w.id % HOODIES.length]!);
        rHead.current?.setColorAt(i, SKIN[(w.id * 3) % SKIN.length]!);
      } else {
        const i = nv++;
        set(vBody.current, i, x, 0.26 * S + bob, z, ry, 1, squash, 1);
        set(vHead.current, i, x, 0.66 * S + bob, z, ry, 1, 1, 1);
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
    done(aOrb.current, na);
    done(vBody.current, nv);
    done(vHead.current, nv);
    done(pBody.current, np);
    done(pHead.current, np);
    done(pStick.current, np);
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
        <meshStandardMaterial color="#f2f6fb" roughness={0.3} metalness={0.1} emissive="#1de9ff" emissiveIntensity={0.1} />
      </instancedMesh>
      <instancedMesh ref={aVisor} args={[visorGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial color="#3ff0ff" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={aOrb} args={[orbGeo, undefined, CAP]} frustumCulled={false}>
        <meshBasicMaterial color="#5ff5ff" toneMapped={false} />
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
      <instancedMesh ref={pStick} args={[stickGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#8a5a3a" roughness={0.9} />
      </instancedMesh>
      {SIGNS.map((text, i) => (
        <instancedMesh key={text} ref={(m) => void (boards.current[i] = m)} args={[boardGeo, undefined, SIGN_CAP]} frustumCulled={false}>
          <meshBasicMaterial map={signMaps[i]} toneMapped={false} side={THREE.DoubleSide} />
        </instancedMesh>
      ))}
    </group>
  );
}
