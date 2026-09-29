import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { particles } from "./particles";

const VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aData;
  attribute vec4 aColor;
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vKind;
  void main() {
    float size = aData.x;
    float rot = aData.y;
    float kind = aData.z;
    float phase = aData.w;
    vec2 c = position.xy * 2.0;
    vec2 s = vec2(1.0);
    if (kind > 0.5 && kind < 1.5) s = vec2(0.25 + 0.75 * abs(cos(phase)), 0.62);   // confetti flutters end over end
    else if (kind > 1.5 && kind < 2.5) s = vec2(0.12 + 0.88 * abs(cos(phase)), 1.0); // coins spin on their edge
    vec2 p = c * s * size;
    float cr = cos(rot), sr = sin(rot);
    p = vec2(p.x * cr - p.y * sr, p.x * sr + p.y * cr);
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
    vUv = c;
    vColor = aColor;
    vKind = kind;
  }
`;

const FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vColor;
  varying float vKind;
  void main() {
    vec3 col = vColor.rgb;
    float a = vColor.a;
    float additive = 0.0;
    float r = length(vUv);
    if (vKind < 0.5) {                       // puff: a soft blob
      a *= 1.0 - smoothstep(0.15, 1.0, r);
    } else if (vKind < 1.5) {                // confetti: flat colour, a little darker at the edge
      col *= 0.92 + 0.08 * (1.0 - abs(vUv.x));
    } else if (vKind < 2.5) {                // coin: a disc with a rim and a shine
      if (r > 1.0) discard;
      col = mix(col, col * 0.7, smoothstep(0.62, 0.95, r));
      col += vec3(0.28) * (1.0 - smoothstep(0.0, 0.5, length(vUv - vec2(-0.3, 0.3))));
    } else if (vKind > 3.5) {                 // spark: a four-point star, added onto the scene
      float d = min(abs(vUv.x), abs(vUv.y));
      float star = max(1.0 - smoothstep(0.0, 0.32, d) - smoothstep(0.55, 1.0, r), 0.0);
      float core = 1.0 - smoothstep(0.0, 0.35, r);
      a *= clamp(star + core, 0.0, 1.0);
      additive = 1.0;
    } else {                                 // droplet: a bead with a highlight
      if (r > 1.0) discard;
      col += vec3(0.4) * (1.0 - smoothstep(0.0, 0.45, length(vUv - vec2(-0.3, 0.35))));
    }
    vec4 enc = linearToOutputTexel(vec4(col, 1.0));
    gl_FragColor = vec4(enc.rgb * a, a * (1.0 - additive));
  }
`;

/** Draws the particle pool as camera-facing quads: one InstancedBufferGeometry, one draw call, cap 2,000. */
export function ParticleLayer() {
  const { mesh, attrs } = useMemo(() => {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    const make = (array: Float32Array, size: number) => new THREE.InstancedBufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
    const attrs = { pos: make(particles.pos, 3), data: make(particles.data, 4), color: make(particles.color, 4) };
    geo.setAttribute("aPos", attrs.pos);
    geo.setAttribute("aData", attrs.data);
    geo.setAttribute("aColor", attrs.color);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, premultipliedAlpha: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    return { mesh, attrs };
  }, []);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  useFrame((_, dt) => {
    particles.update(Math.min(dt, 0.05));
    const n = particles.count;
    (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    mesh.visible = n > 0;
    if (n === 0) return;
    for (const a of [attrs.pos, attrs.data, attrs.color]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  });

  return <primitive object={mesh} />;
}
