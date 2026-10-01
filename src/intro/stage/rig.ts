// The stage's shared layout, beat clock and damping helpers. Everything in the scene damps toward a pose that depends on
// the beat and on how long the beat has been running; the director sends SETTLED when a scripted beat's time is up.
import { createContext, useContext } from "react";
import * as THREE from "three";
import type { IntroEvent } from "../actor";
import type { IntroContext } from "../machine";

/** How long each scripted beat runs, in seconds. The rest wait for the player. */
export const DURATIONS: Record<string, number> = { pulling: 1.8, unwrapping: 2.1, disc: 2.2, warmup: 1.4, post: 4.4, splash: 2.8, dive: 1.2 };

export const BOOT_BEATS = new Set(["disc", "warmup", "post", "splash", "dive"]);

// ---- Layout, in metres. The shelf is at x = 0, the demo counter to its right. ----
export const SHELF_W = 1.5;
export const SHELF_TOPS = [0.32, 0.7, 1.08] as const;
export const HERO_SIZE = [0.26, 0.32, 0.08] as const;
export const COUNTER_Y = 0.9;
export const HERO_ON_SHELF = new THREE.Vector3(0, SHELF_TOPS[1] + HERO_SIZE[1] / 2 + 0.002, 0.03);
/** Where the box is held up for a look on the way to the counter. */
export const PRESENT = new THREE.Vector3(0.95, 1.22, 1.05);
/** The opened box lies here on the counter. */
export const TRAY = new THREE.Vector3(2.15, COUNTER_Y + HERO_SIZE[2] / 2, 0.6);
export const LID_REST = new THREE.Vector3(2.62, COUNTER_Y + 0.008, 0.26);
/** Items held up close float here, facing +z. */
export const HOLD = new THREE.Vector3(2.15, 1.3, 1.0);
/** The kiosk's CRT screen (centre, size) and the CD-ROM drawer. */
export const CRT = { center: new THREE.Vector3(3.02, 1.16, 0.575), w: 0.34, h: 0.255 };
export const TOWER = new THREE.Vector3(3.52, COUNTER_Y, 0.36);
export const DRAWER_Y = COUNTER_Y + 0.36;
export const DRAWER_IN_Z = TOWER.z + 0.21 - 0.07;
export const DRAWER_OUT_Z = TOWER.z + 0.21 + 0.075;

export const FOV = 40;

/** The camera distance that fits a `w` x `h` rectangle at this aspect ratio. */
export function fit(w: number, h: number, aspect: number, fov = FOV): number {
  const t = 2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  return Math.max(h / t, w / (t * aspect));
}

// ---- Damping ----
export const k = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

export type Pose = { p: THREE.Vector3; q: THREE.Quaternion };
const euler = new THREE.Euler();
export function pose(p: THREE.Vector3 | [number, number, number], rx = 0, ry = 0, rz = 0, order: THREE.EulerOrder = "XYZ"): Pose {
  return { p: Array.isArray(p) ? new THREE.Vector3(...p) : p.clone(), q: new THREE.Quaternion().setFromEuler(euler.set(rx, ry, rz, order)) };
}
/** Move an object toward a pose. `lambda` is how quickly (about 1/seconds). */
export function dampTo(o: THREE.Object3D, target: Pose, lambda: number, dt: number) {
  const a = k(lambda, dt);
  o.position.lerp(target.p, a);
  o.quaternion.slerp(target.q, a);
}

/** Flat on the counter, face up, turned `yaw` about the vertical. */
export const flat = (x: number, y: number, z: number, yaw = 0) => pose([x, y, z], -Math.PI / 2, 0, yaw);

// ---- The beat clock ----
export type Clock = {
  beat: string;
  /** Seconds into the current beat. */
  t: number;
  /** True for the first frame: everything snaps to its pose (a review link opens mid-flow). */
  snap: boolean;
  /** The COA's tilt, from dragging (x, y radians). */
  tilt: THREE.Vector2;
  dragging: boolean;
};

export type StageProps = { beat: string; context: IntroContext; send: (e: IntroEvent) => void };

export const ClockContext = createContext<{ current: Clock } | null>(null);
export function useClock() {
  const c = useContext(ClockContext);
  if (!c) throw new Error("useClock outside the stage");
  return c;
}

/** dt for this frame: Infinity on the snap frame (so damping lands at once), else clamped for slow machines. */
export const frameDt = (clock: Clock, dt: number) => (clock.snap ? Infinity : Math.min(dt, 0.1));

export function canvasTexture(c: HTMLCanvasElement, anisotropy = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}
