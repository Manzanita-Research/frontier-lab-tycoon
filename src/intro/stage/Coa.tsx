// The Certificate of Authenticity (FLT-70's hero prop), placeholder foil: guilloché line-work drawn in the shader with
// fwidth anti-aliasing, a holographic strip whose colour follows the angle you look at it from, an embossed seal from a
// procedural height field, and the printed text (and this visitor's key) from a canvas. Drag to tilt it in the light.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { paintCoaText } from "../art";
import { canvasTexture, frameDt, k, useClock } from "./rig";

const vertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vT;
varying vec3 vB;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  vT = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
  vB = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
uniform sampler2D uText;
uniform float uAspect;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vT;
varying vec3 vB;

vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

// A thin line wherever v crosses a whole number, anti-aliased by its screen-space rate of change.
float lineAA(float v, float width) {
  float d = abs(fract(v) - 0.5);
  float w = fwidth(v);
  return 1.0 - smoothstep(width - w, width + w, 0.5 - d);
}

// The foil's height: an embossed seal (a ring and a five-point star) and fine holographic grooves.
float height(vec2 uv) {
  vec2 p = (uv - vec2(0.105, 0.66)) * vec2(uAspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  float ring = smoothstep(0.078, 0.072, r) * smoothstep(0.058, 0.064, r);
  float edge = 0.034 + 0.013 * cos(a * 5.0 + 1.5708);
  float star = smoothstep(edge + 0.003, edge - 0.003, r);
  float dots = smoothstep(0.004, 0.002, length(fract(p * 90.0) - 0.5) / 90.0) * step(0.08, r);
  return ring + 0.8 * star + 0.15 * dots + 0.06 * sin(uv.y * 700.0 + uv.x * 90.0);
}

void main() {
  vec2 uv = vUv;
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec3 L = normalize(vec3(0.35, 0.75, 0.6));

  // Paper: pale green, two families of rosette lines and a wavy border, the way banknote printers did it.
  vec2 c1 = (uv - vec2(0.62, 0.45)) * vec2(uAspect, 1.0);
  float r1 = length(c1);
  float a1 = atan(c1.y, c1.x);
  float g1 = lineAA(r1 * 70.0 + 1.3 * sin(a1 * 18.0 + r1 * 34.0), 0.07);
  float g2 = lineAA(r1 * 70.0 - 1.3 * sin(a1 * 18.0 - r1 * 34.0), 0.07);
  vec2 c2 = (uv - vec2(1.05, 1.1)) * vec2(uAspect, 1.0);
  float g3 = lineAA(length(c2) * 55.0 + 0.8 * sin(atan(c2.y, c2.x) * 30.0), 0.08);
  float edgeD = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
  float border = step(edgeD, 0.055) * lineAA(edgeD * 160.0 + 1.6 * sin((uv.x * uAspect + uv.y) * 90.0), 0.09);
  vec3 paper = lin(vec3(0.93, 0.96, 0.9));
  paper = mix(paper, lin(vec3(0.42, 0.66, 0.55)), max(g1, g2) * 0.55);
  paper = mix(paper, lin(vec3(0.9, 0.62, 0.5)), g3 * 0.45);
  paper = mix(paper, lin(vec3(0.2, 0.45, 0.36)), border * 0.8);
  paper *= 0.72 + 0.4 * max(dot(N, L), 0.0);

  // The foil strip on the left.
  float strip = step(0.035, uv.x) * step(uv.x, 0.175) * step(0.06, uv.y) * step(uv.y, 0.94);
  float e = 0.0015;
  float h0 = height(uv);
  vec2 grad = vec2(height(uv + vec2(e, 0.0)) - h0, height(uv + vec2(0.0, e)) - h0) / e;
  vec3 Nf = normalize(N - 0.004 * (grad.x * vT + grad.y * vB));
  float ndv = clamp(dot(Nf, V), 0.0, 1.0);
  float phase = ndv * 2.4 + uv.y * 1.6 + h0 * 0.35 + dot(V, vT) * 1.5 + uTime * 0.02;
  vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Nf, H), 0.0), 48.0);
  vec3 foil = mix(vec3(0.62, 0.66, 0.72), rainbow, 0.8) * (0.45 + 0.7 * max(dot(Nf, L), 0.0)) + vec3(2.2) * spec;

  vec3 col = mix(paper, foil, strip);
  vec4 text = texture2D(uText, uv);
  col = mix(col, text.rgb * (0.8 + 0.3 * max(dot(N, L), 0.0)), text.a * (1.0 - strip));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Coa({ w, h, weightsKey, held }: { w: number; h: number; weightsKey: string; held: boolean }) {
  const clock = useClock();
  const tiltGroup = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: { uText: { value: canvasTexture(paintCoaText(weightsKey), 8) }, uAspect: { value: w / h }, uTime: { value: 0 } },
        side: THREE.DoubleSide,
      }),
    [weightsKey, w, h],
  );
  useEffect(
    () => () => {
      (material.uniforms.uText!.value as THREE.Texture).dispose();
      material.dispose();
    },
    [material],
  );

  useFrame((state, raw) => {
    const dt = frameDt(clock.current, raw);
    material.uniforms.uTime!.value = state.clock.elapsedTime;
    const g = tiltGroup.current;
    if (!g) return;
    const c = clock.current;
    // Held up: your tilt, plus a slow sway when you're not dragging so the foil always moves a little.
    const sway = held && !c.dragging ? 0.12 : 0;
    const tt = state.clock.elapsedTime;
    const tx = held ? c.tilt.x + sway * Math.sin(tt * 0.9) : 0;
    const ty = held ? c.tilt.y + sway * Math.sin(tt * 0.6 + 1) : 0;
    g.rotation.x += (tx - g.rotation.x) * k(8, dt);
    g.rotation.y += (ty - g.rotation.y) * k(8, dt);
  });

  return (
    <group ref={tiltGroup}>
      <mesh material={material}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}
