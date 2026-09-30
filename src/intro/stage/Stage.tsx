// The big box's 3D stage (FLT-70 M0, greybox): the store, the shelf, our box, what's in it, and the demo kiosk. Its own
// chunk, so the reduced-motion still box never loads three. Uses the game's stack: R3F, drei-free here, postprocessing.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Intro } from "../actor";
import type { IntroContext } from "../machine";
import { Contents } from "./Contents";
import { HeroBox } from "./HeroBox";
import { Kiosk } from "./Kiosk";
import { Store } from "./Store";
import { BOOT_BEATS, ClockContext, CRT, DURATIONS, fit, FOV, HERO_ON_SHELF, HOLD, k, PRESENT, TRAY, useClock, type Clock } from "./rig";
import { itemFrame } from "./items";

type Props = { intro: Intro; beat: string; context: IntroContext };

export default function Stage({ intro, beat, context }: Props) {
  const clock = useRef<Clock>({ beat, t: 0, snap: true, tilt: new THREE.Vector2(...(intro.params.tilt ?? [0, 0])), dragging: false });
  const fps = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Drag anywhere to tilt the certificate while it is held up (works the same with a finger).
  const coa = beat === "focus" && context.item === "coa";
  useEffect(() => {
    const el = wrap.current;
    if (!el || !coa) return;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      clock.current.dragging = true;
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      const t = clock.current.tilt;
      t.y = THREE.MathUtils.clamp(t.y + (e.clientX - last.x) * 0.006, -0.6, 0.6);
      t.x = THREE.MathUtils.clamp(t.x + (e.clientY - last.y) * 0.006, -0.6, 0.6);
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      last = null;
      clock.current.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [coa]);

  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0, cursor: coa ? "grab" : undefined }}>
      <Canvas dpr={[1, 2]} camera={{ fov: FOV, near: 0.05, far: 40, position: [0, 1.1, 2.3] }} gl={{ antialias: !intro.params.fx, powerPreference: "high-performance" }}>
        <ClockContext.Provider value={clock}>
          <Director intro={intro} beat={beat} clock={clock} fps={fps} />
          <CameraRig beat={beat} context={context} />
          <color attach="background" args={["#23262e"]} />
          <fog attach="fog" args={["#23262e", 7, 16]} />
          <hemisphereLight args={["#fff8ec", "#6b6250", 1.1]} />
          <directionalLight position={[1.5, 4, 3]} intensity={1.6} />
          <pointLight position={[2.4, 2.2, 1.4]} intensity={4} distance={4} decay={1.4} color="#fff2d8" />
          <Store beat={beat} context={context} send={intro.send} />
          <HeroBox beat={beat} context={context} send={intro.send} />
          <Contents beat={beat} context={context} send={intro.send} weightsKey={intro.params.key} />
          <Kiosk beat={beat} context={context} send={intro.send} weightsKey={intro.params.key} />
          {intro.params.fx && (
            <EffectComposer multisampling={4}>
              <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.5} luminanceSmoothing={0.1} />
              <Noise opacity={0.035} />
              <Vignette offset={0.3} darkness={0.55} />
              {/* The composer renders to a target, where three skips tone mapping: put it back, or paper clips to white. */}
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          )}
        </ClockContext.Provider>
      </Canvas>
      <div ref={fps} className="intro-fps" hidden={!intro.params.fps} />
    </div>
  );
}

/** Runs the beat clock, sends SETTLED when a scripted beat is over, and measures the frame rate. */
function Director({ intro, beat, clock, fps }: { intro: Intro; beat: string; clock: { current: Clock }; fps: { current: HTMLDivElement | null } }) {
  const gl = useThree((s) => s.gl);
  const meter = useRef({ frames: 0, since: performance.now(), fps: 0, calls: 0, tris: 0 });
  const beatRef = useRef(beat);
  beatRef.current = beat;
  const sent = useRef<string | null>(null);

  useEffect(() => {
    const w = window as unknown as { __intro?: unknown };
    w.__intro = { send: intro.send, state: () => intro.now()?.value, fps: () => meter.current.fps, info: () => ({ calls: meter.current.calls, triangles: meter.current.tris }) };
    return () => void delete w.__intro;
  }, [intro, gl]);

  // Runs first every frame (priority -2; a positive priority would take over rendering from R3F and the composer).
  const frames = useRef(0);
  useFrame((_, dt) => {
    const c = clock.current;
    // The first frame snaps everything into place; from the second on, things move.
    if (frames.current++ > 0) c.snap = false;
    // Count the whole frame (scene and postprocessing passes), not just the last pass.
    gl.info.autoReset = false;
    meter.current.calls = gl.info.render.calls;
    meter.current.tris = gl.info.render.triangles;
    gl.info.reset();
    if (c.beat !== beatRef.current) {
      c.beat = beatRef.current;
      c.t = 0;
      sent.current = null;
    } else if (!c.snap) c.t += Math.min(dt, 0.25);
    const dur = DURATIONS[c.beat];
    if (dur !== undefined && c.t >= dur && sent.current !== c.beat && !intro.params.hold) {
      sent.current = c.beat;
      intro.send({ type: "SETTLED" });
    }
    const m = meter.current;
    m.frames++;
    const now = performance.now();
    if (now - m.since >= 1000) {
      m.fps = (m.frames * 1000) / (now - m.since);
      m.frames = 0;
      m.since = now;
      if (fps.current && !fps.current.hidden) fps.current.textContent = `${m.fps.toFixed(1)} fps\n${m.calls} calls\n${(m.tris / 1000).toFixed(1)}k tris`;
    }
  }, -2);
  return null;
}

/** The camera damps toward a pose per beat, fitted to the window's aspect ratio (so a phone sees the same thing). */
function CameraRig({ beat, context }: { beat: string; context: IntroContext }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const look = useMemo(() => new THREE.Vector3(0, 0.95, 0), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const goalLook = useMemo(() => new THREE.Vector3(), []);
  const clockRef = useClock();

  useFrame((_, rawDt) => {
    const c = clockRef.current;
    const dt = c.snap ? Infinity : Math.min(rawDt, 0.1);
    const aspect = size.width / Math.max(1, size.height);
    const t = c.t;
    let lambda = 3.2;
    switch (beat) {
      case "shelf": {
        const peek = !!context.peek;
        goalLook.set(0, peek ? 0.85 : 0.92, 0);
        const w = aspect < 1 ? 1.0 : 2.3;
        pos.set(peek && aspect >= 1 ? 0.3 : 0, 1.1, fit(w, 1.95, aspect));
        break;
      }
      case "pulling":
        if (t < 0.45) {
          goalLook.copy(HERO_ON_SHELF);
          pos.copy(HERO_ON_SHELF).add(new THREE.Vector3(0, 0.12, fit(0.9, 0.8, aspect)));
        } else {
          goalLook.copy(PRESENT);
          pos.copy(PRESENT).add(new THREE.Vector3(0, 0.08, fit(0.7, 0.6, aspect)));
        }
        break;
      case "unwrapping":
      case "open": {
        // On a wide screen the whole view slides right, clear of the contents list.
        const dx = aspect < 1 ? 0 : -0.14;
        goalLook.set(TRAY.x + dx, 0.9, TRAY.z + 0.02);
        // A phone looks down from higher up, so the spread fills a tall screen instead of a band across it.
        const d = aspect < 1 ? fit(0.74, 0.9, aspect) : fit(1.35, 1.0, aspect);
        const tilt = aspect < 1 ? [0.97, 0.26] : [0.72, 0.7];
        pos.set(TRAY.x + dx * 2, 0.9 + d * tilt[0]!, TRAY.z + d * tilt[1]!);
        lambda = beat === "unwrapping" ? 2.4 : 3.2;
        break;
      }
      case "focus": {
        const [w, h] = itemFrame(context.item, context.page, context.sheets);
        goalLook.copy(HOLD);
        // Leave room for the contents list on the left on a wide screen.
        const d = fit(w * 1.18, h * 1.35, aspect);
        pos.set(HOLD.x - (aspect >= 1 ? d * 0.09 : 0), HOLD.y + 0.02, HOLD.z + d);
        goalLook.x -= aspect >= 1 ? d * 0.09 : 0;
        break;
      }
      case "disc":
        goalLook.set(3.05, 1.05, 0.55);
        pos.set(2.85, 1.42, 0.55 + fit(1.25, 0.8, aspect));
        break;
      case "warmup":
        goalLook.copy(CRT.center);
        pos.copy(CRT.center).add(new THREE.Vector3(0, 0.02, fit(CRT.w * 1.8, CRT.h * 1.8, aspect)));
        break;
      case "post":
      case "splash":
        goalLook.copy(CRT.center);
        pos.copy(CRT.center).add(new THREE.Vector3(0, 0, fit(CRT.w * 1.12, CRT.h * 1.12, aspect)));
        break;
      case "dive":
        goalLook.copy(CRT.center);
        pos.copy(CRT.center).add(new THREE.Vector3(0, 0, 0.02));
        lambda = 2.2;
        break;
      default:
        break;
    }
    if (BOOT_BEATS.has(beat) && beat !== "disc") lambda = Math.max(lambda, 2.6);
    const a = k(lambda, dt);
    camera.position.lerp(pos, a);
    look.lerp(goalLook, a);
    camera.lookAt(look);
    // A near plane at 5 cm keeps the manual's stacked sheets from z-fighting; only the dive into the CRT needs closer.
    const near = beat === "dive" ? 0.005 : 0.05;
    if (camera.fov !== FOV || camera.near !== near) {
      camera.fov = FOV;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }, -1);
  return null;
}
