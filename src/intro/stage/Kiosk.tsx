// The demo counter and its kiosk: a beige tower with a CD-ROM drawer, a CRT and a keyboard. The CRT shows a 640x480
// canvas (an attract loop until you insert the disc, then the BIOS POST, which checks this visitor's Model Weights Key,
// and the Frontier 95 splash) through the game's own tube (FLT-73's CRTPipeline, `src/render/crt`): scanlines, mask,
// bloom, bow and corners. The screen's shader on top only adds the power: off, and the warm-up line.
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { canvas, paintBios, paintKeyboard, paintSplash, paintSunrise, RETRO_FONT, UI_FONT } from "../art";
import { CRTPipeline } from "../../render/crt/pipeline";
import { CRT_LOOKS, monitorOptions } from "../../render/crt/looks";
import { BIOS } from "../content";
import { canvasTexture, COUNTER_Y, CRT, DRAWER_IN_Z, DRAWER_OUT_Z, DRAWER_Y, frameDt, k, TOWER, useClock, type StageProps } from "./rig";
import { CounterProps } from "./Props";

const BEIGE = "#e4dcc4";
/** The tube's picture: 4:3 like the canvas, sharp enough when the camera dives into the glass. */
const GLASS = [1024, 768] as const;

const screenVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const screenFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uOn;
uniform float uWarm;
varying vec2 vUv;
void main() {
  vec3 col = texture2D(uMap, vUv).rgb * 1.15;
  // Warming up: a bright line in the middle that opens into the picture.
  float open = smoothstep(0.0, 1.0, uWarm);
  col *= step(abs(vUv.y - 0.5), max(open * 0.5, 0.003));
  col += vec3(0.7, 0.85, 1.0) * exp(-abs(vUv.y - 0.5) * 260.0) * (1.0 - open) * step(0.01, uWarm) * 3.0 * smoothstep(0.48, 0.36, abs(vUv.x - 0.5));
  vec2 p = vUv * 2.0 - 1.0;
  vec3 glass = vec3(0.025, 0.032, 0.03) * (1.0 - 0.4 * length(p));
  gl_FragColor = vec4(glass + col * uOn, 1.0);
  #include <colorspace_fragment>
}`;

export function Kiosk({ beat, context, send, weightsKey }: StageProps & { weightsKey: string }) {
  const clock = useClock();
  const drawer = useRef<THREE.Mesh>(null);
  const led = useRef<THREE.MeshStandardMaterial>(null);
  const screen = useMemo(() => {
    const c = canvas(640, 480);
    // The tube takes a render target, so each new picture is uploaded straight into one (sRGB bytes, as painted). The
    // canvas's own texture is never drawn, only copied from; the target flips it on the way in, like a texture would.
    const map = new THREE.Texture(c);
    const input = new THREE.WebGLRenderTarget(c.width, c.height);
    input.texture.flipY = true;
    const glass = new THREE.WebGLRenderTarget(GLASS[0], GLASS[1], { type: THREE.HalfFloatType });
    // The canvas is already display-ready, so no tone mapping in the tube.
    const crt = new CRTPipeline({ ...monitorOptions(CRT_LOOKS.subtle, GLASS[0], GLASS[1], 30), toneMap: false });
    const material = new THREE.ShaderMaterial({
      vertexShader: screenVertex,
      fragmentShader: screenFragment,
      uniforms: { uMap: { value: glass.texture }, uOn: { value: 1 }, uWarm: { value: 1 } },
      toneMapped: false,
    });
    return { c, map, input, glass, crt, material, painted: "", ready: false };
  }, []);
  const kb = useMemo(() => canvasTexture(paintKeyboard(), 4), []);
  const sign = useMemo(() => canvasTexture(paintTryMe(), 4), []);
  useEffect(
    () => () => {
      screen.map.dispose();
      screen.input.dispose();
      screen.glass.dispose();
      screen.crt.dispose();
      screen.material.dispose();
      kb.dispose();
      sign.dispose();
    },
    [screen, kb, sign],
  );

  useFrame((state, raw) => {
    const c = clock.current;
    const dt = frameDt(c, raw);
    const t = c.t;
    const u = screen.material.uniforms;
    // The drawer: out while the disc goes in, then shut.
    const out = beat === "disc" && t > 0.3 && t < 1.6;
    if (drawer.current) drawer.current.position.z += ((out ? DRAWER_OUT_Z : DRAWER_IN_Z) - drawer.current.position.z) * k(9, dt);
    if (led.current) led.current.emissiveIntensity = beat === "disc" || beat === "warmup" || beat === "post" ? (Math.sin(state.clock.elapsedTime * 30) > 0 ? 3 : 0.3) : 0.3;

    // What the screen shows, repainted at ~15 Hz (the canvas is only 640x480, but the POST should feel typed).
    let mode = "attract";
    let warm = 1;
    let on = 1;
    if (beat === "disc") on = 0;
    else if (beat === "warmup") {
      mode = "black";
      warm = Math.min(1, t / 1.2);
    } else if (beat === "post") mode = "post";
    else if (beat === "splash" || beat === "dive") mode = "splash";
    u.uOn!.value = on;
    u.uWarm!.value = warm;
    const now = state.clock.elapsedTime;
    const key = `${mode}:${mode === "attract" ? Math.floor(now * 2) : mode === "black" ? Math.floor(now * 3) : Math.floor(t * 15)}`;
    if (key === screen.painted) return;
    screen.painted = key;
    const g = screen.c.getContext("2d")!;
    if (mode === "attract") paintAttract(screen.c, now);
    else if (mode === "black") {
      g.fillStyle = "#000";
      g.fillRect(0, 0, 640, 480);
      if (Math.floor(now * 3) % 2 === 0) {
        g.fillStyle = "#c0c0c0";
        g.fillRect(16, 16, 12, 20);
      }
    } else if (mode === "post") {
      const lines = Math.max(0, Math.floor((t - 0.9) / 0.3) + 1);
      const mem = Math.min(BIOS.mem, Math.round((t / 0.8) * BIOS.mem / 16) * 16);
      paintBios(screen.c, t < 0.9 ? 2 : lines + 2, mem, weightsKey);
    } else paintSplash(screen.c, t);
    // Through the tube only when the picture changes (15 times a second at most): it doesn't move by itself.
    if (!screen.ready) {
      state.gl.initRenderTarget(screen.input);
      screen.ready = true;
    }
    state.gl.copyTextureToTexture(screen.map, screen.input.texture);
    screen.crt.render(state.gl, screen.input, screen.glass, { linearOutput: true });
  });

  const clickable = beat === "open" || beat === "focus";
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!clickable) return;
    e.stopPropagation();
    send({ type: "INSERT" });
  };
  void context;

  const cy = CRT.center.y;
  const cz = CRT.center.z;
  return (
    <group>
      {/* The counter */}
      <mesh position={[2.4, (COUNTER_Y - 0.02) / 2, 0.6]}>
        <boxGeometry args={[2.5, COUNTER_Y - 0.02, 0.85]} />
        <meshStandardMaterial color="#ece8dd" roughness={0.8} />
      </mesh>
      {/* The laminate top: purple, so paper reads against it */}
      <mesh position={[2.4, COUNTER_Y - 0.01, 0.6]}>
        <boxGeometry args={[2.56, 0.02, 0.9]} />
        <meshStandardMaterial color="#6d5a8a" roughness={0.55} />
      </mesh>
      <mesh position={[2.4, COUNTER_Y * 0.55, 1.026]}>
        <planeGeometry args={[2.3, 0.22]} />
        <meshStandardMaterial color="#ffe14d" roughness={0.6} />
      </mesh>

      <group onClick={onClick}>
        {/* The CRT: a deep beige body, a darker bezel, the glass. */}
        <mesh position={[CRT.center.x, cy - 0.01, cz - 0.2]}>
          <boxGeometry args={[0.44, 0.38, 0.38]} />
          <meshStandardMaterial color={BEIGE} roughness={0.7} />
        </mesh>
        <mesh position={[CRT.center.x, cy, cz - 0.42]}>
          <boxGeometry args={[0.3, 0.28, 0.12]} />
          <meshStandardMaterial color={BEIGE} roughness={0.7} />
        </mesh>
        <mesh position={[CRT.center.x, cy - 0.01, cz - 0.009]}>
          <boxGeometry args={[0.4, 0.32, 0.02]} />
          <meshStandardMaterial color="#cfc6ab" roughness={0.75} />
        </mesh>
        <mesh position={[CRT.center.x, cy, cz + 0.002]} material={screen.material}>
          <planeGeometry args={[CRT.w, CRT.h]} />
        </mesh>
        <mesh position={[CRT.center.x, COUNTER_Y + 0.006, cz - 0.2]}>
          <boxGeometry args={[0.3, 0.012, 0.26]} />
          <meshStandardMaterial color={BEIGE} roughness={0.7} />
        </mesh>
        {/* "TRY ME!" on top */}
        <mesh position={[CRT.center.x - 0.08, cy + 0.26, cz - 0.16]} rotation={[0, 0, 0.08]}>
          <planeGeometry args={[0.22, 0.11]} />
          <meshStandardMaterial map={sign} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* The tower, its drive bays and the drawer */}
        <mesh position={[TOWER.x, COUNTER_Y + 0.21, TOWER.z]}>
          <boxGeometry args={[0.2, 0.42, 0.42]} />
          <meshStandardMaterial color={BEIGE} roughness={0.7} />
        </mesh>
        <mesh position={[TOWER.x, DRAWER_Y, TOWER.z + 0.211]}>
          <planeGeometry args={[0.16, 0.04]} />
          <meshStandardMaterial color="#b9b09a" roughness={0.8} />
        </mesh>
        <mesh ref={drawer} position={[TOWER.x, DRAWER_Y - 0.004, DRAWER_IN_Z]}>
          <boxGeometry args={[0.15, 0.012, 0.14]} />
          <meshStandardMaterial color="#2b2b2b" roughness={0.5} />
        </mesh>
        <mesh position={[TOWER.x, COUNTER_Y + 0.26, TOWER.z + 0.211]}>
          <planeGeometry args={[0.16, 0.03]} />
          <meshStandardMaterial color="#cfc6ab" roughness={0.8} />
        </mesh>
        <mesh position={[TOWER.x + 0.05, COUNTER_Y + 0.08, TOWER.z + 0.212]}>
          <circleGeometry args={[0.008, 12]} />
          <meshStandardMaterial ref={led} color="#1a3" emissive="#3f6" emissiveIntensity={0.3} toneMapped={false} />
        </mesh>
        <mesh position={[TOWER.x - 0.03, COUNTER_Y + 0.14, TOWER.z + 0.212]}>
          <planeGeometry args={[0.06, 0.018]} />
          <meshStandardMaterial color="#c8102e" roughness={0.6} />
        </mesh>
      </group>

      {/* The keyboard */}
      <mesh position={[CRT.center.x, COUNTER_Y + 0.012, cz + 0.26]} rotation={[-Math.PI / 2 + 0.08, 0, 0]}>
        <planeGeometry args={[0.44, 0.14]} />
        <meshStandardMaterial map={kb} roughness={0.8} />
      </mesh>
      <mesh position={[CRT.center.x, COUNTER_Y + 0.006, cz + 0.26]}>
        <boxGeometry args={[0.46, 0.012, 0.16]} />
        <meshStandardMaterial color="#cfc6ab" roughness={0.8} />
      </mesh>
      <CounterProps />
    </group>
  );
}

/** The kiosk's attract loop: a blinking invitation and Frontier 95's sunrise drifting about. */
function paintAttract(c: HTMLCanvasElement, time: number) {
  const g = c.getContext("2d")!;
  g.fillStyle = "#000080";
  g.fillRect(0, 0, 640, 480);
  const x = 320 + Math.sin(time * 0.9) * 200;
  const y = 250 + Math.sin(time * 1.3) * 80;
  paintSunrise(g, x, y, 44);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.font = `400 34px ${RETRO_FONT}`;
  g.fillText("FRONTIER 95 DEMO STATION", 320, 70);
  if (Math.floor(time * 2) % 2 === 0) {
    g.fillStyle = "#ffe14d";
    g.font = `400 26px ${RETRO_FONT}`;
    g.fillText("INSERT DISC TO BEGIN", 320, 420);
  }
}

function paintTryMe(): HTMLCanvasElement {
  const c = canvas(256, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffe14d";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#c8102e";
  g.lineWidth = 8;
  g.strokeRect(4, 4, 248, 120);
  g.fillStyle = "#c8102e";
  g.textAlign = "center";
  g.font = `900 52px ${UI_FONT}`;
  g.fillText("TRY ME!", 128, 70);
  g.font = `800 20px ${UI_FONT}`;
  g.fillStyle = "#0b1440";
  g.fillText("Please do not install", 128, 104);
  return c;
}
