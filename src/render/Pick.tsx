import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { atoms, send, sim } from "../app/game";
import { useApp } from "../app/hooks";
import { HALF } from "./coords";

const v = new THREE.Vector3();
/** How far, in pixels per unit of zoom, a tap can land from a walker's middle and still count (a fingertip needs 24 at least). */
const REACH = 0.62;
const MIN_REACH_PX = 24;
const MAX_TAP_MS = 500;
const MAX_TAP_MOVE = 7;

/** The walker nearest a screen point, or null if nobody is close enough. */
export function walkerAt(camera: THREE.Camera & { zoom?: number }, size: { width: number; height: number }, px: number, py: number): number | null {
  const reach = Math.max(MIN_REACH_PX, (camera.zoom ?? 40) * REACH);
  const a = sim.alpha;
  let best: number | null = null;
  let bestD = reach;
  for (const w of sim.world.walkers) {
    if (w.machine.value === "inside") continue;
    // The middle of the body, not the feet.
    v.set(w.px + (w.x - w.px) * a - HALF, 0.55, w.pz + (w.z - w.pz) * a - HALF).project(camera);
    const d = Math.hypot((v.x * 0.5 + 0.5) * size.width - px, (-v.y * 0.5 + 0.5) * size.height - py);
    if (d < bestD) {
      bestD = d;
      best = w.id;
    }
  }
  return best;
}

/** Where a walker is on screen (client pixels), for the `?debug=1` hook and the screenshot scripts. */
function screenOf(camera: THREE.Camera, el: HTMLElement, id: number): [number, number] | null {
  const w = sim.world.walkers.find((o) => o.id === id);
  if (!w || w.machine.value === "inside") return null;
  const a = sim.alpha;
  const rect = el.getBoundingClientRect();
  v.set(w.px + (w.x - w.px) * a - HALF, 0.55, w.pz + (w.z - w.pz) * a - HALF).project(camera);
  return [rect.left + (v.x * 0.5 + 0.5) * rect.width, rect.top + (-v.y * 0.5 + 0.5) * rect.height];
}

/**
 * Tap a walker to open their card; tap empty ground to close it. Only when no build tool is active, and only for a
 * quick tap: a drag is the camera panning.
 */
export function Pick() {
  const tool = useApp(atoms.tool);
  const zone = useApp(atoms.zone);
  const { gl, camera, size } = useThree();
  useEffect(() => {
    const hook = (window as unknown as { __flt?: Record<string, unknown> }).__flt;
    if (hook) hook.screenOf = (id: number) => screenOf(camera, gl.domElement, id);
  }, [gl, camera]);
  useEffect(() => {
    if (tool || zone !== null) return;
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = e.isPrimary && e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || performance.now() - d.t > MAX_TAP_MS || Math.hypot(e.clientX - d.x, e.clientY - d.y) > MAX_TAP_MOVE) return;
      const rect = el.getBoundingClientRect();
      const id = walkerAt(camera, size, e.clientX - rect.left, e.clientY - rect.top);
      if (id !== null) send({ type: "SELECT", id });
      else if (sim.ui.selected !== null) send({ type: "SELECT", id: null });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [tool, zone, gl, camera, size]);
  return null;
}
