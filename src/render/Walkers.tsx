import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sim as game } from "../app/game";
import { HALF } from "./coords";
import { OVER, PEOPLE } from "./people";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CHEER_SECONDS, fx } from "./fx/state";
import { glowTexture } from "./materials";
import { signTexture } from "./signs";
import { lookKey, type Pose } from "./modLooks";
import { useSessionLooks } from "./useSessionLooks";
import { beatRun } from "./fx/beatState";
import { reducedMotion } from "../skins/kit/motion";
import { Follow } from "./follow";
import { crowdColor, HOODIES, PICKET, placards, SKIN, SUITS } from "./look";
import { Pick } from "./Pick";
import { eraDef } from "../content/eras";
import { eraOfState } from "../sim/race/race";
import { ESCAPE } from "../content/escape";
import type { Runner } from "../sim/escape/state";
import { lyingDown, waitsForLunch } from "../sim/slopbowl/crowd";
import { SLOPBOWL } from "../sim/slopbowl/pack";

const CAP = 512;
/** Every human gets a pair of glasses (one dark strip) so you can see which way they face and when they look around. */
const EYE_CAP = CAP * 3;
const SIGN_CAP = 64;
/** How big the crowd is drawn (FLT-91: life size, a third to a half of a tile on screen; see people.ts). */
const S = PEOPLE;
/** A placard shrinks less than the person holding it, so "H2O LIES" still reads from the default camera. */
const PLACARD = 0.8;
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
/** FLT-109: the Slop Bowl courier's role (they carry the bag), and how a hangry researcher lies on the floor (radians). */
const COURIER = SLOPBOWL.rules.courier.role;
const FLAT = 1.45;

const dummy = new THREE.Object3D();
// Yaw first, then lean in the walker's own frame.
dummy.rotation.order = "YXZ";
const signDummy = new THREE.Object3D();
signDummy.rotation.order = "YXZ";
/** One pose object, reused for every walker a mod look draws. */
const pose: Pose = { x: 0, z: 0, yaw: 0, t: 0, phase: 0, walking: false, hop: 0, land: 0, env: 0, signYaw: 0 };
const dir = new THREE.Vector3();
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
  const aOrb = useRef<THREE.InstancedMesh>(null);
  const aHat = useRef<THREE.InstancedMesh>(null);
  const aHalo = useRef<THREE.InstancedMesh>(null);
  const vBody = useRef<THREE.InstancedMesh>(null);
  const vHead = useRef<THREE.InstancedMesh>(null);
  const pBody = useRef<THREE.InstancedMesh>(null);
  const pHead = useRef<THREE.InstancedMesh>(null);
  const pStick = useRef<THREE.InstancedMesh>(null);
  const pCap = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const lit = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Group>(null);
  const boards = useRef<(THREE.InstancedMesh | null)[]>([]);
  const hide = useRef<THREE.InstancedMesh>(null);
  const tape = useRef<THREE.InstancedMesh>(null);
  // FLT-109: the late lunch. A paper bag on the courier, a bowl (and its greens) in every fed researcher's hands, and a
  // red anger mark over everyone waiting at the gate.
  const bags = useRef<THREE.InstancedMesh>(null);
  const bowls = useRef<THREE.InstancedMesh>(null);
  const greens = useRef<THREE.InstancedMesh>(null);
  const angers = useRef<THREE.InstancedMesh>(null);
  const glowMap = useMemo(() => glowTexture("#ffffff"), []);
  // FLT-56: the water crowd's placards and each faction's own, in its colours. A faction's marchers carry theirs.
  const signs = useMemo(() => {
    const all = placards();
    const byCrowd = new Map<string, number[]>();
    all.forEach((p, i) => byCrowd.set(p.crowd, [...(byCrowd.get(p.crowd) ?? []), i]));
    const bodies = new Map<string, THREE.Color>();
    for (const crowd of byCrowd.keys()) {
      const c = crowdColor(crowd);
      if (c) bodies.set(crowd, color(c));
    }
    return { all, byCrowd, bodies, maps: all.map((p) => signTexture(p.text, p.bg, p.ink)) };
  }, []);
  const glowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const haloGeo = useMemo(() => new THREE.RingGeometry(0.38 * S, 0.54 * S, 28).rotateX(-Math.PI / 2), []);
  const boardGeo = useMemo(() => new THREE.PlaneGeometry(1.3, 0.73), []);
  const visorGeo = useMemo(() => new THREE.BoxGeometry(0.25 * S, 0.09 * S, 0.07 * S), []);
  const agentGeo = useMemo(() => new RoundedBoxGeometry(0.34 * S, 0.34 * S, 0.3 * S, 3, 0.07 * S), []);
  const orbGeo = useMemo(() => new THREE.SphereGeometry(0.065 * S, 10, 8), []);
  const hatGeo = useMemo(() => new THREE.SphereGeometry(0.2 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const agentHaloGeo = useMemo(() => new THREE.TorusGeometry(0.2 * S, 0.02 * S, 6, 20).rotateX(Math.PI / 2), []);
  // A marcher's cap: a dome over the crown with a peak out front, in one mesh.
  const capGeo = useMemo(() => {
    const dome = new THREE.SphereGeometry(0.14 * S, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const peak = new THREE.CylinderGeometry(0.11 * S, 0.11 * S, 0.02 * S, 12, 1, false, -Math.PI / 2, Math.PI).translate(0, 0, 0.06 * S);
    return mergeGeometries([dome.toNonIndexed(), peak.toNonIndexed()])!;
  }, []);
  const stickGeo = useMemo(() => new THREE.BoxGeometry(0.045, 1, 0.045), []);
  const eyeGeo = useMemo(() => new THREE.BoxGeometry(0.17 * S, 0.042 * S, 0.05 * S), []);
  const boxGeo = useMemo(() => new RoundedBoxGeometry(0.24 * S, 0.18 * S, 0.21 * S, 2, 0.02 * S), []);
  const bagGeo = useMemo(() => new RoundedBoxGeometry(0.26 * S, 0.32 * S, 0.2 * S, 2, 0.02 * S), []);
  const bowlGeo = useMemo(() => new THREE.CylinderGeometry(0.13 * S, 0.08 * S, 0.08 * S, 14), []);
  const greenGeo = useMemo(() => new THREE.SphereGeometry(0.115 * S, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const angerGeo = useMemo(() => new THREE.BoxGeometry(0.32 * S, 0.08 * S, 0.08 * S), []);
  // Tidy up (FLT-19): an agent hiding in a cardboard box, packing tape across the top, eyes through the hand hole.
  const hideGeo = useMemo(() => new RoundedBoxGeometry(0.46 * S, 0.44 * S, 0.42 * S, 2, 0.02 * S), []);
  const tapeGeo = useMemo(() => new THREE.BoxGeometry(0.47 * S, 0.012 * S, 0.1 * S), []);
  // Mod looks (FLT-55): golden retrievers for protesters and the like. The base game has none, and skips all of it.
  // FLT-102: rebuilt when a mod with looks comes or goes mid-game.
  const looks = useSessionLooks("walkers");
  const modded = looks.drawers.size > 0 || looks.tints.size > 0;

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
    let nc = 0;
    let ne = 0;
    let nx = 0;
    let nl = 0;
    let picked: { x: number; z: number } | null = null;
    const nb = new Array<number>(signs.all.length).fill(0);
    // The agents look like the era: hard hats in Coding Automation, halos after that, bigger and brighter each time.
    const agentLook = LOOKS[eraOfState(sim) - 1]!;
    const boxed = sim.disguises?.agent === "box";
    // FLT-56: during a walk-out's beat, the ones leaving dance it: one-two-three-kick, all on the same count.
    const conga = beatRun.kind === "exit" && beatRun.follow.length > 0 && !reducedMotion() ? beatRun.follow : null;
    const sway = Math.sin(t * 7.2) * 0.07 * S;
    const kick = Math.max(0, Math.sin(t * 3.6)) ** 10 * 0.14 * S;
    let nk = 0;
    if (modded) looks.drawers.forEach((d) => d.begin());
    // The Sandbox Escape (FLT-59): who is running, in the hand, or flat on the lawn under a guard.
    const runners = sim.escape?.runners;
    const escapes = runners && runners.length > 0 ? new Map<number, Runner>(runners.map((r) => [r.walker, r])) : null;

    const set = (m: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number, rx = 0, rz = 0) => {
      if (!m) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    };

    /** Glasses on the front of a head. */
    const glasses = (x: number, y: number, z: number, yaw: number) => {
      if (ne >= EYE_CAP) return;
      set(eyes.current, ne++, x + Math.sin(yaw) * 0.112 * S, y + 0.02 * S, z + Math.cos(yaw) * 0.112 * S, yaw, 1, 1, 1);
    };

    // FLT-109: lunch is late (a crowd at the gate), or here (everyone eating).
    const lunch = sim.slopbowl?.enabled ? sim.slopbowl : null;
    const waiting = !!lunch && lunch.crowd > 0;
    const eating = lunch?.machine.value === "fed";
    const bagged = !!lunch && lunch.machine.value !== "fed" && lunch.machine.value !== "quiet";
    let nbag = 0;
    let nbowl = 0;
    let nang = 0;

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
      const tinted = modded ? lookKey(looks.tints, w) : undefined;
      if (modded) {
        const drawer = lookKey(looks.drawers, w);
        if (drawer) {
          Object.assign(pose, { x, z, yaw, t, phase, walking, hop, land, env, signYaw });
          if (drawer.draw(w, pose)) continue;
        }
      }

      if (w.kind === "agent" && boxed) {
        // A box that walks. It stops dead (and trembles a little) whenever it is not walking.
        const shuffle = walking ? Math.abs(Math.sin(t * 12 + phase)) * 0.03 * S : Math.sin(t * 30 + phase) * 0.004 * S;
        const lean = walking ? Math.sin(t * 12 + phase) * 0.06 : 0;
        const i = nk++;
        set(hide.current, i, x, 0.22 * S + shuffle + hop, z, ry, 1, 1, 1, lean);
        set(tape.current, i, x, 0.44 * S + shuffle + hop, z, ry, 1, 1, 1, lean);
        const eyes = aVisor.current;
        if (eyes) {
          set(eyes, na, x + Math.sin(ry) * 0.23 * S, 0.3 * S + shuffle + hop, z + Math.cos(ry) * 0.23 * S, ry, 0.55, 0.45, 0.4);
          eyes.setColorAt(na, agentLook.visor);
          set(aBody.current, na, 0, -50, 0, 0, 0, 0, 0);
          set(aOrb.current, na, 0, -50, 0, 0, 0, 0, 0);
          set(aGlow.current, na, 0, -50, 0, 0, 0, 0, 0);
          na++;
        }
        continue;
      }
      if (w.kind === "agent") {
        const k = agentLook.scale;
        // Running: a hard forward lean and a quick bob. In the hand: lifted up and dangling. Tackled: face down.
        const run = escapes?.get(w.id)?.machine.value;
        let bob = (0.26 + Math.sin(t * 3 + phase) * 0.04) * S * k + hop;
        let tilt = 0;
        if (run === "running") {
          bob = (0.24 + Math.abs(Math.sin(t * 16 + phase)) * 0.08) * S * k;
          tilt = 0.38;
        } else if (run === "carried") {
          const r = escapes!.get(w.id)!;
          const u = Math.min(1, Math.max(0, 1 - (r.timer - a) / ESCAPE.rules.catch.carryTicks));
          bob += ESCAPE.rules.catch.lift * Math.min(1, Math.sin(Math.PI * u) * 2.5);
          tilt = Math.sin(t * 9 + phase) * 0.28;
        } else if (run === "tackled") {
          bob = 0.1 * S * k;
          tilt = 1.35;
        }
        const i = na++;
        set(aBody.current, i, x, bob + 0.17 * S * k, z, ry, k, k, k, tilt);
        set(aVisor.current, i, x + Math.sin(ry) * 0.15 * S * k, bob + 0.22 * S * k, z + Math.cos(ry) * 0.15 * S * k, ry, k, k, k, tilt);
        set(aOrb.current, i, x, bob + 0.5 * S * k + Math.sin(t * 6 + phase) * 0.015, z, 0, k, k, k);
        const pulse = (1.2 + Math.sin(t * 3 + phase) * 0.12) * S * (1 + env * 0.4) * k;
        set(aGlow.current, i, x, 0.03, z, 0, pulse, 1, pulse);
        aBody.current?.setColorAt(i, tinted?.body ?? agentLook.body);
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
        // A mod's tint wins; then a faction's marchers wear its colour (FLT-56); the water crowd, whatever it had on.
        pBody.current?.setColorAt(i, tinted?.body ?? ((w.crowd && signs.bodies.get(w.crowd)) || picket[w.id % picket.length]!));
        pHead.current?.setColorAt(i, tinted?.head ?? skins[(w.id * 7) % skins.length]!);
        // And a solid cap in it, so the groups read from the default camera without the legend (FLT-56 review).
        const cap = w.crowd ? signs.bodies.get(w.crowd) : undefined;
        if (cap) {
          set(pCap.current, nc, x, 0.7 * S + bob - land * 0.1, z, ry, 1, 1, 1);
          pCap.current?.setColorAt(nc++, cap);
        }
        const wave = Math.sin(t * 5 + phase) * 0.14;
        // The pole runs from the fist up to the board.
        set(pStick.current, i, x, 0.87 * S + bob, z, 0, 1, S, 1);
        const own = signs.byCrowd.get(w.crowd ?? "") ?? signs.byCrowd.get("")!;
        const which = own[w.id % own.length]!;
        const board = boards.current[which];
        if (board) {
          const k = nb[which]!++;
          signDummy.position.set(x, 1.375 * S + bob + Math.abs(wave) * 0.15 * PLACARD, z);
          signDummy.rotation.set(0, signYaw, wave);
          signDummy.scale.setScalar(PLACARD);
          signDummy.updateMatrix();
          board.setMatrixAt(k, signDummy.matrix);
        }
        continue;
      }
      // Researchers and visitors: an unhappy walker slumps (leans in, head down, a slow shuffle, colours drained),
      // and a researcher on the way out carries a box. A cheer makes everyone hop; idle ones look around and breathe.
      const mood = w.mood.value;
      // FLT-109: waiting for lunch at the gate: angry, and on day three some of them lie down on the floor.
      const down = waiting && w.kind === "researcher" && lyingDown(sim, w);
      const angry = waiting && !eating && !down && w.kind === "researcher" && waitsForLunch(sim, w);
      const slump = mood === "miserable" ? 1 : mood === "slumped" ? 0.7 : 0;
      const pace = slump > 0 ? 6.5 : 10;
      const dancing = conga !== null && conga.includes(w.id);
      const bob = (walking ? Math.abs(Math.sin(t * pace + phase)) * (slump > 0 ? 0.025 : 0.045) : slump > 0 ? 0 : Math.sin(t * 1.3 + phase) * 0.008) * S + hop + (dancing ? kick : 0);
      const squash = (walking && slump === 0 ? 1 + Math.sin(t * 20 + phase) * 0.04 : 1 + breath) - land;
      const wide = 1 + land * 0.6;
      const lean = down ? FLAT : slump * 0.42;
      const cy = 0.26 * S;
      const hy = 0.66 * S;
      const sn = Math.sin(lean);
      const cs = Math.cos(lean);
      // Pivot at the feet: the lean moves the centre of the body forward and down a touch.
      const fwx = Math.sin(yaw);
      const fwz = Math.cos(yaw);
      const droop = slump * 0.07 * S;
      // The conga's hip sway: sideways, across the way they are walking.
      const sx = dancing ? fwz * sway : 0;
      const sz = dancing ? -fwx * sway : 0;
      const bodyX = x + fwx * cy * sn + sx * 0.6;
      const bodyZ = z + fwz * cy * sn + sz * 0.6;
      const headX = x + fwx * (hy * sn + droop) + sx;
      const headZ = z + fwz * (hy * sn + droop) + sz;
      const headY = hy * cs - droop * 0.8 + bob - land * 0.1;
      let body: THREE.InstancedMesh | null;
      let head: THREE.InstancedMesh | null;
      let bodyCol: THREE.Color;
      let i: number;
      if (w.kind === "researcher") {
        i = nr++;
        body = rBody.current;
        head = rHead.current;
        bodyCol = tinted?.body ?? hoodies[w.id % hoodies.length]!;
        const skin = tinted?.head ?? skins[(w.id * 3) % skins.length]!;
        set(head, i, headX, headY, headZ, yaw, 1, 1, 1);
        head?.setColorAt(i, slump > 0 ? tint.copy(skin).lerp(SLUMP_TINT, 0.25 * slump) : skin);
      } else {
        i = nv++;
        body = vBody.current;
        head = vHead.current;
        bodyCol = tinted?.body ?? suits.get(w.role) ?? FALLBACK_SUIT;
        const skin = tinted?.head ?? skins[(w.id * 5) % skins.length]!;
        set(head, i, headX, headY, headZ, yaw, 1, 1, 1);
        head?.setColorAt(i, slump > 0 ? tint.copy(skin).lerp(SLUMP_TINT, 0.25 * slump) : skin);
      }
      glasses(headX, headY, headZ, yaw);
      set(body, i, bodyX, cy * cs + bob, bodyZ, yaw, wide, squash, wide, lean);
      body?.setColorAt(i, slump > 0 ? tint.copy(bodyCol).lerp(SLUMP_TINT, 0.5 * slump) : bodyCol);
      if (w.machine.value === "quitting" && boxes.current) {
        // A cardboard box held at the chest, bobbing with the walk.
        set(boxes.current, nx++, x + fwx * 0.3 * S, 0.46 * S + bob, z + fwz * 0.3 * S, yaw, 1, 1, 1);
      }
      if (angry && nang < CAP * 2 - 1) {
        // A red anger mark over the head, pulsing: two crossed bars, a little to one side.
        const p = 1 + 0.3 * Math.abs(Math.sin(t * 7 + phase));
        const ax = headX + fwz * 0.14 * S;
        const az = headZ - fwx * 0.14 * S;
        const ay = headY + 0.4 * S;
        set(angers.current, nang++, ax, ay, az, yaw, p, p, p, 0, 0.785);
        set(angers.current, nang++, ax, ay, az, yaw, p, p, p, 0, -0.785);
      }
      if (bagged && w.kind === "visitor" && w.role === COURIER && bags.current) {
        // The courier's paper bag of bowls, held at the chest.
        set(bags.current, nbag++, x + fwx * 0.3 * S, 0.5 * S + bob, z + fwz * 0.3 * S, yaw, 1, 1, 1);
      }
      if (eating && w.kind === "researcher" && nbowl < CAP) {
        // Lunch: a bowl at the chest, lifted to the mouth now and then.
        const lift = Math.max(0, Math.sin(t * 1.7 + phase)) ** 6 * 0.16 * S;
        const bx = x + fwx * 0.26 * S;
        const bz = z + fwz * 0.26 * S;
        set(bowls.current, nbowl, bx, 0.44 * S + bob + lift, bz, yaw, 1, 1, 1);
        set(greens.current, nbowl++, bx, 0.48 * S + bob + lift, bz, yaw, 1, 0.55, 1);
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
        if (arrow) arrow.position.y = OVER.arrow + Math.abs(Math.sin(t * 4)) * 0.12;
      }
    }

    const done = (m: THREE.InstancedMesh | null, n: number) => {
      if (!m) return;
      m.count = n;
      // Forty-odd placard meshes, most of them empty most of the time: an empty one skips its draw.
      m.visible = n > 0;
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
    done(pCap.current, nc);
    done(eyes.current, ne);
    done(boxes.current, nx);
    done(bags.current, nbag);
    done(bowls.current, nbowl);
    done(greens.current, nbowl);
    done(angers.current, nang);
    done(hide.current, nk);
    done(tape.current, nk);
    done(lit.current, nl);
    boards.current.forEach((m, i) => done(m, nb[i] ?? 0));
    if (modded) looks.drawers.forEach((d) => d.end());
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

      <instancedMesh ref={pCap} args={[capGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={pStick} args={[stickGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#8a5a3a" roughness={0.9} />
      </instancedMesh>
      {signs.all.map((p, i) => (
        <instancedMesh key={`${p.crowd}:${p.text}`} ref={(m) => void (boards.current[i] = m)} args={[boardGeo, undefined, SIGN_CAP]} frustumCulled={false}>
          <meshBasicMaterial map={signs.maps[i]} toneMapped={false} side={THREE.DoubleSide} />
        </instancedMesh>
      ))}

      {/* Tidy up: agents hiding in boxes. Nobody is fooled. */}
      <instancedMesh ref={hide} args={[hideGeo, undefined, CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#c99a55" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={tape} args={[tapeGeo, undefined, CAP]} frustumCulled={false}>
        <meshStandardMaterial color="#e8d3a0" roughness={0.4} />
      </instancedMesh>

      {/* A researcher walking out for good carries a cardboard box. */}
      <instancedMesh ref={boxes} args={[boxGeo, undefined, SIGN_CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#c99a55" roughness={0.9} />
      </instancedMesh>

      {/* FLT-109: the courier's bag, lunch in hand, and the hangry crowd's anger marks. */}
      <instancedMesh ref={bags} args={[bagGeo, undefined, SIGN_CAP]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#c8a06a" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={bowls} args={[bowlGeo, undefined, CAP]} frustumCulled={false}>
        <meshStandardMaterial color="#f4efe4" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={greens} args={[greenGeo, undefined, CAP]} frustumCulled={false}>
        <meshStandardMaterial color="#5fb83a" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={angers} args={[angerGeo, undefined, CAP * 2]} frustumCulled={false}>
        <meshBasicMaterial color="#e5322b" toneMapped={false} />
      </instancedMesh>

      {/* Everyone thinking the Thoughts row you tapped gets a golden halo. */}
      <instancedMesh ref={lit} args={[haloGeo, undefined, CAP]} frustumCulled={false} renderOrder={3}>
        <meshBasicMaterial color={HIGHLIGHT} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </instancedMesh>

      {/* The selected walker: a ring at their feet and a bouncing arrow over their head. */}
      <group ref={ring} visible={false}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.05} renderOrder={4}>
          <ringGeometry args={[0.4 * S, 0.54 * S, 32]} />
          <meshBasicMaterial color={SELECT} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
        </mesh>
        <mesh rotation-x={Math.PI} position-y={OVER.arrow} renderOrder={4}>
          <coneGeometry args={[0.16, 0.28, 4]} />
          <meshBasicMaterial color="#ffd24a" toneMapped={false} />
        </mesh>
      </group>

      {modded && <primitive object={looks.group} />}

      <Pick />
      <Follow />
    </group>
  );
}
