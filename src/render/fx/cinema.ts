// The camera director, minus three.js: it decides where the camera's target and zoom should be, one frame at a time.
// CameraRig.tsx feeds it the current view and applies what it returns. Pure and unit-tested.
//
//   idle --focus--> in --arrived--> hold --(timer | release)--> out --arrived--> idle
//                    any player input (drag, wheel, WASD, edge-scroll) cancels straight back to idle
//
// A shot remembers where the camera was ("home") and eases back to it afterwards, unless the player took over.

export interface View {
  x: number;
  z: number;
  zoom: number;
}

export interface Shot {
  x: number;
  z: number;
  /** Multiplies the zoom at the moment the shot starts. */
  zoom?: number;
  /** Seconds to stay on the subject once there; null holds until `release()` (an open event card). */
  hold: number | null;
  /** Ease back to where the camera was. False leaves it where the shot ended (double-click to focus). */
  back?: boolean;
  /** How briskly to move; per second. */
  rate?: number;
}

export type Phase = "idle" | "in" | "hold" | "out";

/** How far from the middle of the board the camera target may go (scene units). Shots are clamped to it. */
export const PAN_LIMIT = 13;
const clampPan = (v: number) => Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, v));

const EPS_POS = 0.04;
const EPS_ZOOM = 0.01;

/** Frame-rate independent exponential approach: `rate` is 1/seconds. */
export const approach = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

export class Cinema {
  phase: Phase = "idle";
  private home: View = { x: 0, z: 0, zoom: 1 };
  private goal: View = { x: 0, z: 0, zoom: 1 };
  private shot: Shot = { x: 0, z: 0, hold: 0 };
  private timer = 0;
  private released = false;
  /** Shake "trauma" 0..1: the offset is trauma squared, so small bumps stay small and big ones really rattle. */
  trauma = 0;

  get active() {
    return this.phase !== "idle";
  }

  /** Is the camera parked on an open-ended shot (an event card)? */
  get holdingOpen() {
    return this.phase !== "idle" && this.shot.hold === null && !this.released;
  }

  /**
   * Start a shot from `view`. A shot in progress keeps its original home; an open-ended one isn't interrupted by a timed
   * one. True if the camera took the shot.
   */
  focus(view: View, shot: Shot): boolean {
    if (this.phase !== "idle") {
      if (this.holdingOpen && shot.hold !== null) return false;
    } else this.home = { ...view };
    this.shot = { back: true, ...shot };
    // Zoom is relative to where the player had it, so back-to-back shots don't compound.
    // (A goal the rig would clamp away could never be reached, and the shot would never end.)
    this.goal = { x: clampPan(shot.x), z: clampPan(shot.z), zoom: this.home.zoom * (shot.zoom ?? 1) };
    this.phase = "in";
    this.timer = 0;
    this.released = false;
    return true;
  }

  /** Move the subject of the shot in progress (a beat following people as they walk). Zoom and timing are kept. */
  retarget(x: number, z: number) {
    if (this.phase !== "in" && this.phase !== "hold") return;
    this.goal = { ...this.goal, x: clampPan(x), z: clampPan(z) };
  }

  /** The open-ended hold is over (the card was answered): ease back. */
  release() {
    if (this.phase === "idle") return;
    this.released = true;
    if (this.phase === "hold") this.leave();
  }

  /** The player grabbed the camera: stop, and leave it wherever they put it. */
  cancel() {
    this.phase = "idle";
    this.released = false;
  }

  shake(strength: number) {
    this.trauma = Math.min(1, this.trauma + strength);
  }

  private leave() {
    if (this.shot.back === false) this.phase = "idle";
    else this.phase = "out";
  }

  /** Where the camera should be this frame, or null when the director has nothing to say. */
  update(view: View, dt: number): View | null {
    this.trauma = Math.max(0, this.trauma - 1.7 * dt);
    if (this.phase === "idle") return null;
    const rate = this.shot.rate ?? 3.2;
    const to = this.phase === "out" ? this.home : this.goal;
    const next = { x: approach(view.x, to.x, rate, dt), z: approach(view.z, to.z, rate, dt), zoom: approach(view.zoom, to.zoom, rate * 0.9, dt) };
    const arrived = Math.hypot(to.x - next.x, to.z - next.z) < EPS_POS && Math.abs(to.zoom - next.zoom) < EPS_ZOOM * to.zoom;
    if (this.phase === "in" && arrived) {
      this.phase = "hold";
      this.timer = 0;
      if (this.shot.hold !== null && this.shot.hold <= 0) this.leave();
      else if (this.released) this.leave();
    } else if (this.phase === "hold") {
      this.timer += dt;
      if (this.released || (this.shot.hold !== null && this.timer >= this.shot.hold)) this.leave();
    } else if (this.phase === "out" && arrived) {
      this.phase = "idle";
      return { ...to };
    }
    return next;
  }
}

/** Smooth 2D shake offset in screen units (right, up), from time and trauma. Deterministic: no rng. */
export function shakeOffset(trauma: number, t: number, max = 0.5): [number, number] {
  const k = trauma * trauma * max;
  if (k < 1e-4) return [0, 0];
  const nx = Math.sin(t * 47.1) * 0.6 + Math.sin(t * 29.3 + 1.7) * 0.4;
  const ny = Math.sin(t * 41.7 + 3.1) * 0.6 + Math.sin(t * 23.9 + 0.4) * 0.4;
  return [nx * k, ny * k];
}
