import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrthographicCamera } from "three";
import { sim as game } from "../../app/game";
import { HALF, rectCenter } from "../coords";
import { chaseHour, hourAt, nightAmount } from "./clock";
import { coinFountain, confettiBurst, droplet, dustBurst, firefly, particles as pool, smokePuff, sparkle, star } from "./particles";
import { cinema, fx, shake } from "./state";
import { currentLoad } from "./utilisation";
import { createWatch, type FxEvent } from "./watch";

/** Walkers are drawn 1.6x life size (see Walkers.tsx); sparkles ride at the height of an agent's body. */
const AGENT_Y = 0.55;

/**
 * The conductor of the juice: once per frame it advances the campus clock, asks `watch` what changed in the World,
 * and turns each change into particles, shakes, camera shots and crowd cheers. It only ever reads the sim.
 */
export function FxDirector() {
  const three = useThree();
  const watch = useMemo(createWatch, []);
  const acc = useRef({ smoke: 0, spark: 0, drop: 0, fly: 0, star: 0 });
  const first = useRef(true);

  /** The camera's current view, for a shot to start from. */
  const view = () => {
    const c = three.controls as unknown as { target: THREE.Vector3 } | null;
    return { x: c?.target.x ?? 0, z: c?.target.z ?? 0, zoom: (three.camera as OrthographicCamera).zoom };
  };

  const handle = (ev: FxEvent) => {
    switch (ev.type) {
      case "release": {
        // Two cannons, one either side of the dome, and the whole crowd hops (Walkers reads `fx.cheerAt`).
        confettiBurst(pool, ev.x - 0.9, 2.2, ev.z, 70);
        confettiBurst(pool, ev.x + 0.9, 2.2, ev.z, 70);
        if (ev.count > 1) confettiBurst(pool, ev.x, 2.6, ev.z, 60, 1.2);
        fx.cheerAt = fx.time;
        fx.cheerX = ev.x;
        fx.cheerZ = ev.z;
        shake(0.3);
        if (!fx.photo) cinema.focus(view(), { x: ev.x, z: ev.z, zoom: 1.3, hold: 2.6 });
        return;
      }
      case "incident":
        shake(0.8);
        if (!fx.photo) cinema.focus(view(), { x: ev.x, z: ev.z - 1.5, zoom: 1.25, hold: null });
        return;
      case "incidentClosed":
        cinema.release();
        return;
      case "placed":
        dustBurst(pool, ev.x, ev.z, Math.max(ev.w, ev.d) * 0.62, 8 + ev.w * ev.d * 3);
        shake(0.1);
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
        cinema.cancel();
        fx.cheerAt = -1e9;
        fx.earnAt = -1e9;
        return;
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

    // Ambient emitters. Each is a rate per second, spent as whole particles.
    const a = acc.current;
    const walkers = world.walkers;
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
