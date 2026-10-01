// The CD-ROM (FLT-95): a 1997 pressing you can hold up to the light. One shader does the whole disc: the spindle hole,
// the clear polycarbonate hub with its stacking ring, the silver mirror band, and the data, whose tracks run round the
// disc 1.6 µm apart. Those tracks are a diffraction grating (the COA foil's maths, ./holo), and since they run in
// circles the grating points out from the centre: the light comes back as rainbow spokes that swing round as you tilt
// the disc. The label (`paintDisc`) is printed over the data, and where it leaves the silver bare the rainbow shows.
// The back is the data side: the same silver and rainbow, no label.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { paintDisc } from "../art";
import { DISC_ZONES } from "./disc";
import { HOLO, SURFACE_VERTEX } from "./holo";
import { canvasTexture } from "./rig";

const fragment = /* glsl */ `
uniform sampler2D uLabel;
// The zones, as fractions of the radius: hole, hub, ring (where the data starts), data (where it ends).
uniform vec4 uZones;
uniform float uTime;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;

// The COA's two lamps, in view space, so turning the disc is what moves the light across it.
const vec3 LAMP1 = vec3(0.14, 0.24, 0.04);
const vec3 LAMP2 = vec3(-0.3, -0.06, 0.12);

${HOLO}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float rho = length(p);
  if (rho > 1.0 || rho < uZones.x) discard;
  float aa = fwidth(rho) * 1.5;
  vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 T = normalize(vT);
  vec3 B = normalize(vB);
  vec3 V = normalize(-vPos);
  // The near lamp drifts a little, as light does when you shift in your chair, so the sheen is never quite still.
  vec3 L1 = normalize(LAMP1 + vec3(0.05 * sin(uTime * 0.7), 0.04 * cos(uTime * 0.53), 0.0) - vPos);
  vec3 L2 = normalize(LAMP2 - vPos);
  vec3 H = normalize(L1 + V);
  vec3 radial = inPlane(p, T, B);

  // Where we are: metal (the mirror band and the data) or clear plastic (the hub, the lip at the edge).
  float metal = smoothstep(uZones.y - aa, uZones.y + aa, rho) * (1.0 - smoothstep(uZones.w - aa, uZones.w + aa, rho));
  float data = smoothstep(uZones.z - aa, uZones.z + aa, rho) * (1.0 - smoothstep(uZones.w - aa, uZones.w + aa, rho));

  // Aluminium: a soft studio in its reflection (as on the COA's foil) and the lamp's glint.
  vec3 R = reflect(-V, N);
  float room = 0.3 + 0.55 * smoothstep(-0.3, 0.9, R.y) + 0.5 * exp(-pow((R.x - 0.35) * 3.0, 2.0) - pow((R.y - 0.5) * 2.0, 2.0));
  float glint = pow(max(dot(N, H), 0.0), 140.0);
  vec3 silver = vec3(0.56, 0.59, 0.65) * room + vec3(glint * 1.5);
  // The mirror band is turned on a lathe: fine rings, no data.
  silver *= mix(1.0, 0.93 + 0.07 * sin(rho * 1400.0), metal * (1.0 - data));
  // The data: sharp spokes from both lamps, and a broad faint one so some colour is there at every angle.
  vec3 rainbow = grating(L1, V, N, radial, 1600.0, 0.05) + 0.7 * grating(L2, V, N, radial, 1600.0, 0.05);
  rainbow += 0.45 * grating(L1, V, N, radial, 1600.0, 0.6) + 0.3 * grating(L2, V, N, radial, 1600.0, 0.6);
  vec3 col = silver + rainbow * data * 1.5;

  // Clear polycarbonate: mostly see-through, brighter at a glancing angle, and the stacking ring catches the light.
  float fresnel = pow(1.0 - abs(dot(N, V)), 3.0);
  float stack = exp(-pow((rho - 0.255) / 0.01, 2.0)) + 0.6 * exp(-pow((rho - uZones.x - 0.012) / 0.008, 2.0));
  float lip = smoothstep(1.0 - aa * 3.0, 1.0, rho);
  vec3 clear = vec3(0.8, 0.86, 0.92) * (0.4 + 0.4 * room) + vec3(glint * 2.0);
  float clearA = clamp(0.1 + 0.55 * fresnel + 0.4 * stack + 0.5 * lip + glint, 0.0, 1.0);
  // The cut edge of the spindle hole: a dark line where the plastic bends the light away.
  float cut = exp(-pow((rho - uZones.x - 0.004) / 0.005, 2.0));
  clear = mix(clear, vec3(0.25, 0.27, 0.3), cut);
  clearA = max(clearA, 0.85 * cut);
  col = mix(clear, col, metal);
  float alpha = mix(clearA, 1.0, metal);

  // The label, printed on the top side only.
  if (gl_FrontFacing) {
    vec4 ink = texture2D(uLabel, vUv);
    float lit = 0.62 + 0.38 * max(dot(N, L1), 0.0) + 0.12 * max(dot(N, L2), 0.0);
    vec3 printed = ink.rgb * lit + 0.06 * pow(max(dot(N, H), 0.0), 24.0);
    col = mix(col, printed, ink.a * metal);
  }
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Disc({ r }: { r: number }) {
  const material = useMemo(() => {
    const { hole, hub, ring, data } = DISC_ZONES;
    return new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERTEX,
      fragmentShader: fragment,
      uniforms: {
        uLabel: { value: canvasTexture(paintDisc(ring + 0.022, data - 0.013), 8) },
        uZones: { value: new THREE.Vector4(hole, hub, ring, data) },
        uTime: { value: 0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
    });
  }, []);
  useEffect(
    () => () => {
      (material.uniforms.uLabel!.value as THREE.Texture).dispose();
      material.dispose();
    },
    [material],
  );
  useFrame((state) => void (material.uniforms.uTime!.value = state.clock.elapsedTime));

  return (
    <mesh material={material}>
      <circleGeometry args={[r, 96]} />
    </mesh>
  );
}
