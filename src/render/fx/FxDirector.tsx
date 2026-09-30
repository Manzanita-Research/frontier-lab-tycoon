import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrthographicCamera } from "three";
import { HALF, rectCenter } from "../coords";
import { chaseHour, hourAt, nightAmount } from "./clock";
import { ashPuff, blowout, coinFountain, confettiBurst, droplet, dustBurst, ember, firefly, flame, particles as pool, slopGlint, smokePuff, sparkle, star, suds, toteBurst } from "./particles";
import { cinema, fx, shake } from "./state";
import { GAS_STACK, GAS_STACK_TOP } from "../buildings/GasTurbineModel";
import { currentLoad } from "./utilisation";
import { ROOF } from "../buildings/BrokenFx";
import { SLOP_MAX } from "../../sim/slop";
import { createWatch, type FxEvent } from "./watch";
import { beatAtom, beatRun } from "./beatState";
import { endBeat, isBeat, skipBeat } from "./beat";
import { reducedMotion } from "../../skins/kit/motion";
import { debugParams, registry, sim as game } from "../../app/game";
import { worldX, worldZ } from "../coords";
import { people } from "../../sim/ecs/protesters";

// `?debug=1` exposes the juice state to probes and screenshot scripts (`get` is R3F's store getter: camera, controls).
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) {
  (window as unknown as { __fx: { fx: typeof fx; cinema: typeof cinema; pool: typeof pool; get?: () => unknown } }).__fx = { fx, cinema, pool };
}

/** Walkers are drawn 1.6x life size (see Walkers.tsx); sparkles ride at the height of an agent's body. */
const AGENT_Y = 0.55;
const fwd = new THREE.Vector3();

/**
 * The conductor of the juice: once per frame it advances the campus clock, asks `watch` what changed in the World,
 * and turns each change into particles, shakes, camera shots and crowd cheers. It only ever reads the sim.
 */
export function FxDirector() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const dbg = (window as unknown as { __fx?: { get?: () => unknown } }).__fx;
    if (dbg) dbg.get = get;
  }, [get]);
  const watch = useMemo(createWatch, []);
  const acc = useRef({ smoke: 0, spark: 0, drop: 0, fly: 0, star: 0, gas: 0, fire: 0, embers: 0, glint: 0, suds: 0 });
  /** Broken buildings we have already put on a show for, and how many jobs each staffer had done last frame. */
  const brokenSeen = useRef(new Set<number>());
  const doneSeen = useRef(new Map<number, number>());
  const first = useRef(true);
  const replay = useRef(debugParams.beat);

  /** The camera's current view, for a shot to start from. */
  const view = () => {
    const { controls, camera } = get();
    const target = (controls as unknown as { target: THREE.Vector3 } | null)?.target;
    return { x: target?.x ?? 0, z: target?.z ?? 0, zoom: (camera as OrthographicCamera).zoom };
  };

  /**
   * Where to aim the camera so the subject lands `up` of a screen height above the middle (an event card covers the
   * middle; the crowd at the gate should be in the clear above it). Moves the target toward the camera side.
   */
  const aim = (x: number, z: number, zoomMul: number, up: number) => {
    const { camera, size } = get();
    camera.getWorldDirection(fwd);
    const sinElevation = Math.max(0.2, -fwd.y);
    fwd.y = 0;
    fwd.normalize();
    const d = (up * size.height) / ((camera as OrthographicCamera).zoom * zoomMul * sinElevation);
    return { x: x - fwd.x * d, z: z - fwd.z * d };
  };

  const handle = (ev: FxEvent) => {
    switch (ev.type) {
      case "release": {
        // Three cannons (one either side of the dome and one on top) and the whole crowd hops (Walkers reads `fx.cheerAt`).
        confettiBurst(pool, ev.x - 0.9, 2.2, ev.z, 80);
        confettiBurst(pool, ev.x + 0.9, 2.2, ev.z, 80);
        confettiBurst(pool, ev.x, 2.5, ev.z, 70, 1.25);
        if (ev.count > 1) confettiBurst(pool, ev.x, 2.6, ev.z, 80, 1.3);
        fx.cheerAt = fx.time;
        fx.cheerX = ev.x;
        fx.cheerZ = ev.z;
        shake(0.3);
        if (!fx.photo) cinema.focus(view(), { x: ev.x, z: ev.z, zoom: 1.3, hold: 2.6 });
        return;
      }
      case "incident":
        if (ev.id.startsWith("era")) {
          // An era begins: the whole campus in one shot, cannons all round, and everybody jumps.
          shake(1);
          for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 5], [6, 5], [0, 0]] as const) confettiBurst(pool, dx, 2.4, dz, 90, 1.35);
          fx.cheerAt = fx.time;
          fx.cheerX = 0;
          fx.cheerZ = 0;
          if (!fx.photo) cinema.focus(view(), { x: 0, z: 1, zoom: 0.8, hold: null });
          return;
        }
        // A card needs the player: a beat's bars and caption make way for it.
        endBeat();
        shake(0.8);
        if (!fx.photo) cinema.focus(view(), { ...aim(ev.x, ev.z, 1.25, 0.3), zoom: 1.25, hold: null });
        return;
      case "rank": {
        // The Arena moved you. A fall is a shove; a climb is a small cheer; the top is a party.
        if (ev.to > ev.from) shake(Math.min(0.7, 0.25 + 0.12 * (ev.to - ev.from)));
        else if (ev.to === 1) {
          confettiBurst(pool, ev.x - 0.9, 2.2, ev.z, 70);
          confettiBurst(pool, ev.x + 0.9, 2.2, ev.z, 70);
          confettiBurst(pool, ev.x, 2.5, ev.z, 60, 1.25);
          fx.cheerAt = fx.time;
          fx.cheerX = ev.x;
          fx.cheerZ = ev.z;
          shake(0.2);
        } else confettiBurst(pool, ev.x, 2.3, ev.z, 26, 1.05);
        return;
      }
      case "incidentClosed":
        cinema.release();
        return;
      case "focus":
        // A disaster wants to be looked at: a timed shot at the trouble (never over photo mode or an open card's shot).
        if (!fx.photo) cinema.focus(view(), { x: ev.x, z: ev.z, zoom: ev.zoom, hold: ev.hold });
        return;
      case "shake":
        shake(ev.strength);
        return;
      case "cue":
        return; // the sound layer plays these
      case "beat": {
        // FLT-56: a camera beat. The bars and the caption always (the HUD draws them from `beatAtom`); the camera move
        // only when the player is not in photo mode and has not asked for less motion. Time keeps running throughout.
        // `?beat` (screenshots) holds it until skipped.
        const hold = debugParams.beat ? null : ev.hold;
        const camera = !fx.photo && !reducedMotion() && cinema.focus(view(), { ...aim(ev.x, ev.z, ev.zoom, 0.06), zoom: ev.zoom, hold, rate: ev.beat === "huddle" ? 0.8 : 2.4 });
        Object.assign(beatRun, { id: beatRun.id + 1, kind: ev.beat, x: ev.x, z: ev.z, follow: ev.follow, zoom: ev.zoom, until: hold === null ? Infinity : fx.time + hold + 2.2, camera, acc: 0 });
        registry.set(beatAtom, { id: beatRun.id, kind: ev.beat, caption: ev.caption, sub: ev.sub });
        if (ev.beat === "viral") shake(0.35);
        return;
      }
      case "placed":
        dustBurst(pool, ev.x, ev.z, Math.max(ev.w, ev.d) * 0.62, 8 + ev.w * ev.d * 3);
        shake(0.1);
        if (ev.kind === "datacenter") {
          // The auction prize lands: fly to it, and celebrate on the roof.
          confettiBurst(pool, ev.x, 2.6, ev.z, 80, 1.3);
          shake(0.45);
          if (!fx.photo) cinema.focus(view(), { x: ev.x, z: ev.z, zoom: 1.3, hold: 2.4 });
        }
        return;
      case "removed":
        dustBurst(pool, ev.x, ev.z, Math.max(ev.w, ev.d) * 0.62, 12 + ev.w * ev.d * 5);
        shake(0.28);
        return;
      case "path":
        dustBurst(pool, ev.x, ev.z, 0.32, ev.added ? 4 : 7);
        return;
      case "earned": {
        fx.earnAt = fx.time;
        // Ordinary days get a hop of coins; a big day gets a fountain.
        if (ev.amount >= 20_000) coinFountain(pool, ev.x, 1.3, ev.z, Math.min(90, Math.max(5, Math.round(ev.amount / 3000))), ev.amount >= 100_000 ? 1.25 : 0.8);
        if (ev.amount >= 150_000) shake(0.12);
        return;
      }
      case "reset":
        pool.clear();
        endBeat();
        cinema.cancel();
        fx.cheerAt = -1e9;
        fx.earnAt = -1e9;
        brokenSeen.current.clear();
        doneSeen.current.clear();
        return;
    }
  };

  /** A beat in progress: follow its people, throw its particles, and end it on time or when the player takes the camera. */
  const runBeat = (walkers: typeof game.world.walkers, dt: number) => {
    const b = beatRun;
    if (fx.time > b.until || (b.camera && !cinema.active)) return void skipBeat();
    if (b.follow.length && b.camera) {
      let x = 0;
      let z = 0;
      let n = 0;
      for (const w of walkers) {
        if (!b.follow.includes(w.id)) continue;
        x += w.x;
        z += w.z;
        n++;
      }
      if (n) {
        b.x = x / n - HALF;
        b.z = z / n - HALF;
        const at = aim(b.x, b.z, 1, 0.06);
        cinema.retarget(at.x, at.z);
      } else b.follow = [];
    }
    if (dt <= 0 || fx.photo) return;
    b.acc += dt * (b.kind === "viral" ? 9 : b.kind === "huddle" ? 14 : 0);
    for (let k = 0; b.acc >= 1 && k < 4; k++, b.acc--) {
      if (b.kind === "viral") {
        // Paparazzi: camera flashes all round the gate.
        const fx0 = b.x + pool.rand(-2.4, 2.4);
        const fz0 = b.z + pool.rand(-1.6, 1.6);
        for (let i = 0; i < 5; i++) sparkle(pool, fx0 + pool.rand(-0.08, 0.08), pool.rand(0.5, 1.1), fz0 + pool.rand(-0.08, 0.08), [1, 1, 0.96]);
      } else {
        // Clipboards scratching: little grey flecks over the huddle.
        sparkle(pool, b.x + pool.rand(-0.9, 0.9), pool.rand(1.1, 1.5), b.z + pool.rand(-0.9, 0.9), [0.85, 0.87, 0.92]);
      }
    }
  };

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    fx.time = clock.elapsedTime;
    const world = game.world;

    // The campus clock: the sim's hour, low-passed so 10x speed drifts through dusk instead of strobing.
    if (first.current) {
      first.current = false;
      if (fx.hourOverride !== null) fx.hour = fx.hourOverride;
      else fx.hour = hourAt(world.tick + game.alpha);
    }
    fx.hour = fx.hourOverride !== null ? chaseHour(fx.hour, fx.hourOverride, dt, 14) : chaseHour(fx.hour, hourAt(world.tick + game.alpha), dt, 3);
    fx.night = nightAmount(fx.hour);

    for (const ev of watch.poll(world)) handle(ev);
    if (replay.current) {
      // `?moment=...&beat`: the staged moment's beat happened before the first frame; play the latest one now.
      replay.current = false;
      const c = [...world.disasters.cues].reverse().find((c) => c.type === "beat");
      if (c?.type === "beat") handle({ type: "beat", beat: c.beat, caption: c.caption, sub: c.sub, x: worldX(c.x), z: worldZ(c.z), zoom: c.zoom, hold: c.hold, follow: c.follow });
    }
    if (isBeat()) runBeat(people(world), dt);

    // Ambient emitters. Each is a rate per second, spent as whole particles.
    const a = acc.current;
    const walkers = people(world);
    if (dt <= 0) return;

    // A faint cyan trail behind agents on the move.
    let agents = 0;
    let protesters = 0;
    for (const w of walkers) {
      if (w.kind === "agent") agents++;
      else if (w.kind === "protester") protesters++;
    }
    a.spark += dt * Math.min(70, agents * 0.6);
    for (let n = 0; a.spark >= 1 && n < 6; n++, a.spark--) {
      for (let tries = 0; tries < 4; tries++) {
        const w = walkers[Math.floor(pool.rand() * walkers.length)];
        if (w && w.kind === "agent" && w.route.length > 0 && w.machine.value !== "inside") {
          sparkle(pool, w.px - HALF, AGENT_Y + pool.rand(-0.05, 0.25), w.pz - HALF);
          break;
        }
      }
    }
    a.spark = Math.min(a.spark, 2);

    // Water over the protesters: droplets thrown up over the crowd and falling back.
    a.drop += dt * Math.min(22, protesters * 0.7);
    for (let n = 0; a.drop >= 1 && n < 6; n++, a.drop--) {
      for (let tries = 0; tries < 4; tries++) {
        const w = walkers[Math.floor(pool.rand() * walkers.length)];
        if (w && w.kind === "protester") {
          droplet(pool, w.x - HALF + pool.rand(-0.15, 0.15), 1.5 + pool.rand(0, 0.5), w.z - HALF + pool.rand(-0.15, 0.15));
          break;
        }
      }
    }
    a.drop = Math.min(a.drop, 2);

    // Smoke from every cluster that is over capacity.
    const load = currentLoad(world);
    if (load.over) {
      a.smoke += dt * 3.2 * load.clusters;
      for (let n = 0; a.smoke >= 1 && n < 8; n++, a.smoke--) {
        const clusters = world.buildings.filter((b) => b.kind === "cluster");
        const b = clusters[Math.floor(pool.rand() * clusters.length)];
        if (!b) break;
        const [cx, cz] = rectCenter(b);
        smokePuff(pool, cx - 0.45, 2.02, cz - 0.45);
      }
      a.smoke = Math.min(a.smoke, 3);
    } else a.smoke = 0;

    // Every Gas Turbine puffs smoke from its stack.
    a.gas += dt * 2.4;
    for (let n = 0; a.gas >= 1 && n < 4; n++, a.gas--) {
      const turbines = world.buildings.filter((b) => b.kind === "gas");
      if (turbines.length === 0) break;
      const b = turbines[Math.floor(pool.rand() * turbines.length)]!;
      const [cx, cz] = rectCenter(b);
      smokePuff(pool, cx + GAS_STACK[0] + pool.rand(-0.04, 0.04), GAS_STACK_TOP, cz + GAS_STACK[1] + pool.rand(-0.04, 0.04));
    }
    a.gas = Math.min(a.gas, 3);

    // Operations (FLT-10). Buildings that give out: a blowout the moment it happens, then flames, black smoke and embers
    // for as long as it burns. Fixed ones get a sparkle burst.
    const broken = world.buildings.filter((b) => b.broken);
    const seen = brokenSeen.current;
    for (const b of broken) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const [cx, cz] = rectCenter(b);
      blowout(pool, cx, ROOF[b.kind], cz);
      shake(0.5);
      if (!fx.photo) cinema.focus(view(), { x: cx, z: cz, zoom: 1.25, hold: 1.8 });
    }
    for (const id of [...seen]) {
      const b = world.buildings.find((o) => o.id === id);
      if (b && b.broken) continue;
      seen.delete(id);
      if (b) {
        const [cx, cz] = rectCenter(b);
        confettiBurst(pool, cx, ROOF[b.kind] + 0.2, cz, 36, 0.9);
        for (let i = 0; i < 10; i++) sparkle(pool, cx + pool.rand(-0.6, 0.6), pool.rand(0.4, ROOF[b.kind]), cz + pool.rand(-0.6, 0.6), [1, 0.95, 0.5]);
      }
    }
    if (broken.length > 0) {
      a.fire += dt * 24 * Math.min(3, broken.length);
      for (let n = 0; a.fire >= 1 && n < 10; n++, a.fire--) {
        const b = broken[Math.floor(pool.rand() * broken.length)]!;
        const [cx, cz] = rectCenter(b);
        const ox = pool.rand(-0.4, 0.4) * b.w;
        const oz = pool.rand(-0.4, 0.4) * b.d;
        if (pool.rand() < 0.6) flame(pool, cx + ox, ROOF[b.kind] + 0.1, cz + oz);
        else ashPuff(pool, cx + ox, ROOF[b.kind] + 0.3, cz + oz);
      }
      a.fire = Math.min(a.fire, 4);
      a.embers += dt * 6;
      for (let n = 0; a.embers >= 1 && n < 3; n++, a.embers--) {
        const b = broken[Math.floor(pool.rand() * broken.length)]!;
        const [cx, cz] = rectCenter(b);
        ember(pool, cx, ROOF[b.kind] + 0.2, cz);
      }
      a.embers = Math.min(a.embers, 2);
    } else a.fire = a.embers = 0;

    // Slop glitters: an off-white twinkle over a random slopped tile, more of them where it is deeper.
    a.glint += dt * 16;
    for (let n = 0; a.glint >= 1 && n < 6; n++, a.glint--) {
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(pool.rand() * world.slop.length);
        const level = world.slop[i]!;
        if (level > 0 && pool.rand() < level / SLOP_MAX) {
          slopGlint(pool, (i % world.grid.w) + pool.rand(0.25, 0.75) - HALF, 0.16 + level * 0.03, Math.floor(i / world.grid.w) + pool.rand(0.25, 0.75) - HALF);
          break;
        }
      }
    }
    a.glint = Math.min(a.glint, 2);

    // Staff at work: suds off the mop, sparks off a repair, and a shower of tote bags when a Comms Rep lands one.
    const done = doneSeen.current;
    for (const s of world.staff) {
      const x = s.x - HALF;
      const z = s.z - HALF;
      if (s.machine.value === "working") {
        if (s.job === "janitor") {
          a.suds += dt * 12;
          for (let n = 0; a.suds >= 1 && n < 3; n++, a.suds--) suds(pool, x + Math.sin(s.dir) * 0.35, z + Math.cos(s.dir) * 0.35);
          a.suds = Math.min(a.suds, 2);
        } else if (s.job === "sre" && pool.rand() < dt * 14) ember(pool, x + Math.sin(s.dir) * 0.4, 0.6, z + Math.cos(s.dir) * 0.4);
      } else if (s.job === "sre" && s.machine.value === "going" && pool.rand() < dt * 9) {
        // The SRE is running: a little dust off their heels.
        dustBurst(pool, x - Math.sin(s.dir) * 0.25, z - Math.cos(s.dir) * 0.25, 0.12, 2);
      }
      const was = done.get(s.id);
      done.set(s.id, s.done);
      if (was === undefined || s.done <= was) continue;
      if (s.job === "comms") toteBurst(pool, x + Math.sin(s.dir) * 0.5, 1, z + Math.cos(s.dir) * 0.5, 18);
      else if (s.job === "janitor") for (let i = 0; i < 8; i++) sparkle(pool, x + pool.rand(-0.5, 0.5), 0.2, z + pool.rand(-0.5, 0.5), [0.9, 0.95, 1]);
    }

    // Night: fireflies drift over the lawn and stars twinkle high up.
    if (fx.night > 0.3) {
      a.fly += dt * fx.night * 6;
      for (let n = 0; a.fly >= 1 && n < 4; n++, a.fly--) firefly(pool, pool.rand(-12, 12), pool.rand(0.4, 1.9), pool.rand(-12, 12));
      a.star += dt * fx.night * 9;
      for (let n = 0; a.star >= 1 && n < 4; n++, a.star--) star(pool, pool.rand(-14, 14), pool.rand(7, 13), pool.rand(-14, 14));
    } else a.fly = a.star = 0;
  }, -3);

  return null;
}
