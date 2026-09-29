import { MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { appNow, atoms, debugParams } from "../../app/game";
import { useApp } from "../../app/hooks";
import { HALF } from "../coords";
import { shakeOffset } from "./cinema";
import { cinema, fx } from "./state";

export const CAMERA_OFFSET = new THREE.Vector3(20, 20, 20);
const PAN_LIMIT = 13;
/** Keyboard pan speed in screen pixels per second, so it feels the same at every zoom. */
const PAN_PX_PER_S = 640;
const EDGE_PX = 12;
const EDGE_DWELL_S = 0.22;
const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1],
  arrowup: [0, 1],
  s: [0, -1],
  arrowdown: [0, -1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

/**
 * The camera: MapControls (drag and wheel pan/zoom, pinch on phones) plus the camera director. It adds WASD and
 * arrow keys, edge scrolling, double-click (or double-tap) to focus, Q/E quarter turns, the cinematic shots that
 * FxDirector asks for, and screen shake. Any input from the player cancels a shot in progress.
 */
export function CameraRig({ baseZoom }: { baseZoom: number }) {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const turn = useRef({ target: 0, current: 0 });
  const tool = useApp(atoms.tool);
  const painting = tool === "path" || tool === "bulldoze";
  const keys = useRef(new Set<string>());
  const vel = useRef({ x: 0, y: 0 });
  const pointer = useRef({ x: 0, y: 0, inside: false, down: false, overEdgeOk: false, edgeSince: -1, type: "mouse" });
  const shaken = useRef(new THREE.Vector3());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k in PAN_KEYS) keys.current.add(k);
      if (e.repeat) return;
      if (k === "q") turn.current.target += Math.PI / 2;
      if (k === "e") turn.current.target -= Math.PI / 2;
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const clearKeys = () => keys.current.clear();

    const onMove = (e: PointerEvent) => {
      const p = pointer.current;
      p.x = e.clientX;
      p.y = e.clientY;
      p.inside = true;
      p.type = e.pointerType;
      const t = e.target as Element | null;
      // Edge scrolling only when the pointer is over the world itself (or the ticker strip along the bottom edge),
      // never while it is on a HUD panel.
      p.overEdgeOk = !!t && (t.tagName === "CANVAS" || !!t.closest?.(".ticker"));
    };
    const onLeave = () => (pointer.current.inside = false);

    // Double-click or double-tap on the ground: focus there. A tool in hand means clicks belong to the tool.
    let last = { t: -1e9, x: 0, y: 0 };
    let downAt = { t: 0, x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      pointer.current.down = true;
      downAt = { t: performance.now(), x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      pointer.current.down = false;
      if ((e.target as Element | null)?.tagName !== "CANVAS" || e.button > 0) return;
      const now = performance.now();
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      if (moved > 8 || now - downAt.t > 320 || appNow()?.tool) return void (last.t = -1e9);
      if (now - last.t < 380 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 32) {
        focusAt(e.clientX, e.clientY);
        last.t = -1e9;
      } else last = { t: now, x: e.clientX, y: e.clientY };
    };
    const focusAt = (cx: number, cy: number) => {
      const c = controls.current;
      if (!c) return;
      const rect = gl.domElement.getBoundingClientRect();
      _ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), camera);
      if (!_ray.ray.intersectPlane(_ground, _hit)) return;
      const cam = camera as THREE.OrthographicCamera;
      const maxZoom = baseZoom * 3.4;
      cinema.focus({ x: c.target.x, z: c.target.z, zoom: cam.zoom }, { x: _hit.x, z: _hit.z, zoom: Math.max(1, Math.min(1.4, maxZoom / cam.zoom)), hold: 0, back: false, rate: 5 });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [camera, gl, baseZoom]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // Open on the campus rather than the middle of the lawn.
    const [fx0, fz0] = debugParams.focus ?? [10.8, 16.2];
    c.target.set(fx0 - HALF, 0, fz0 - HALF);
    c.object.position.copy(c.target).add(CAMERA_OFFSET);
    c.update();
    // Grabbing the camera (drag or wheel) ends a cinematic shot and keeps the camera where the player put it.
    const stop = () => cinema.cancel();
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, []);

  // Before the controls update, take last frame's shake back out so it can't accumulate in their state.
  useFrame(() => {
    if (shaken.current.lengthSq() > 0) {
      camera.position.sub(shaken.current);
      shaken.current.set(0, 0, 0);
    }
  }, -2);

  useFrame((state, dt) => {
    const c = controls.current;
    if (!c) return;
    const cam = camera as THREE.OrthographicCamera;
    const t = turn.current;
    const step = (t.target - t.current) * (1 - Math.exp(-9 * dt));
    if (Math.abs(t.target - t.current) > 1e-4) {
      t.current += step;
      c.object.position.sub(c.target).applyAxisAngle(THREE.Object3D.DEFAULT_UP, step).add(c.target);
    }

    // Keyboard and edge-scroll pan, in screen directions: forward is "up the screen", however it has been turned.
    let ix = 0;
    let iy = 0;
    for (const k of keys.current) {
      const d = PAN_KEYS[k];
      if (d) {
        ix += d[0];
        iy += d[1];
      }
    }
    const p = pointer.current;
    let edge = false;
    if (ix === 0 && iy === 0 && p.type === "mouse" && p.inside && !p.down && p.overEdgeOk) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const ex = p.x < EDGE_PX ? -1 : p.x > w - EDGE_PX ? 1 : 0;
      const ey = p.y < EDGE_PX ? 1 : p.y > h - EDGE_PX ? -1 : 0;
      if (ex !== 0 || ey !== 0) {
        if (p.edgeSince < 0) p.edgeSince = state.clock.elapsedTime;
        if (state.clock.elapsedTime - p.edgeSince > EDGE_DWELL_S) {
          ix = ex * 0.8;
          iy = ey * 0.8;
          edge = true;
        }
      } else p.edgeSince = -1;
    } else p.edgeSince = -1;
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    const v = vel.current;
    v.x = v.x + (ix - v.x) * (1 - Math.exp(-14 * dt));
    v.y = v.y + (iy - v.y) * (1 - Math.exp(-14 * dt));
    if (Math.abs(v.x) > 0.002 || Math.abs(v.y) > 0.002) {
      if (ix !== 0 || iy !== 0 || edge) cinema.cancel();
      _fwd.copy(c.target).sub(c.object.position);
      _fwd.y = 0;
      _fwd.normalize();
      _right.set(-_fwd.z, 0, _fwd.x);
      const dist = (PAN_PX_PER_S / cam.zoom) * dt;
      _q.set(0, 0, 0).addScaledVector(_right, v.x * dist).addScaledVector(_fwd, v.y * dist);
      c.target.add(_q);
      c.object.position.add(_q);
    }

    // The director eases the target (and the camera with it) toward the shot, and zooms.
    if (!fx.photo) {
      const next = cinema.update({ x: c.target.x, z: c.target.z, zoom: cam.zoom }, dt);
      if (next) {
        const dx = next.x - c.target.x;
        const dz = next.z - c.target.z;
        c.target.x += dx;
        c.target.z += dz;
        c.object.position.x += dx;
        c.object.position.z += dz;
        cam.zoom = THREE.MathUtils.clamp(next.zoom, baseZoom * 0.55, baseZoom * 3.4);
        cam.updateProjectionMatrix();
      }
    } else cinema.cancel();

    const cx = THREE.MathUtils.clamp(c.target.x, -PAN_LIMIT, PAN_LIMIT);
    const cz = THREE.MathUtils.clamp(c.target.z, -PAN_LIMIT, PAN_LIMIT);
    if (cx !== c.target.x || cz !== c.target.z) {
      c.object.position.x += cx - c.target.x;
      c.object.position.z += cz - c.target.z;
      c.target.x = cx;
      c.target.z = cz;
    }

    // Shake last, as a screen-space nudge that the next frame undoes.
    const [sx, sy] = fx.photo ? [0, 0] : shakeOffset(cinema.trauma, state.clock.elapsedTime);
    if (sx !== 0 || sy !== 0) {
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _q.set(0, 1, 0).applyQuaternion(camera.quaternion);
      shaken.current.set(0, 0, 0).addScaledVector(_right, sx).addScaledVector(_q, sy);
      camera.position.add(shaken.current);
    }
  });

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enableDamping
      dampingFactor={0.14}
      zoomSpeed={0.9}
      minZoom={baseZoom * 0.55}
      maxZoom={baseZoom * 3.4}
      // With the path or bulldoze tool a left drag paints; pan with the right button or two fingers.
      mouseButtons={{ LEFT: painting ? (-1 as THREE.MOUSE) : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      touches={{ ONE: painting ? (-1 as THREE.TOUCH) : THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}
