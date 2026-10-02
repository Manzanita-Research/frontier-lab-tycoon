// The Certificate of Authenticity (FLT-70's hero prop). The paper and the foil strip are printed art (generated on
// Fal, the foil's height and metal masks pulled out with Patina); this shader makes the foil a hologram. It treats the
// foil as a diffraction grating: light from L leaves toward V in wavelength d·|(L+V)·g|/m, where g runs across the
// grooves (in the surface), d is their spacing and m the order. The seal and the sunrise are pressed with concentric
// grooves, so a rainbow wheel turns with them; the field behind the lettering is cut in bands at different angles
// (a kinegram, so the bands flip colour as you tilt); a scatter of glitter cells each has its own random grating and
// only flashes at its own angle; a thin-film sheen under it all keeps some colour at every angle. The emboss comes
// from the height map. Drag to tilt it.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { paintCoaText } from "../art";
import RECTS from "../assets/art.rects.json";
import { HOLO, SURFACE_VERTEX } from "./holo";
import { canvasTexture, frameDt, k, useClock } from "./rig";
import { useArt } from "./textures";

const KEY_BOX = RECTS["coa-paper.magenta"][0]!;
const STRIP = RECTS["coa-paper.green"][0]!;

const fragment = /* glsl */ `
uniform sampler2D uPaper;
uniform sampler2D uFoil;
uniform sampler2D uHrm;
uniform sampler2D uText;
// The strip on the paper (uv, y up: x, y, w, h), its width over its height in metres, and one foil texel.
uniform vec4 uStrip;
uniform float uStripAspect;
uniform vec2 uTexel;
uniform float uBump;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;

// Two lamps, in view space (the camera's), so tilting the card is what moves the light across it.
const vec3 LAMP1 = vec3(0.14, 0.24, 0.04);
const vec3 LAMP2 = vec3(-0.3, -0.06, 0.12);

${HOLO}
void main() {
  vec3 N = normalize(vN);
  vec3 T = normalize(vT);
  vec3 B = normalize(vB);
  vec3 V = normalize(-vPos);
  vec3 L1 = normalize(LAMP1 - vPos);
  vec3 L2 = normalize(LAMP2 - vPos);
  if (!gl_FrontFacing) {
    // The back is plain card.
    gl_FragColor = vec4(vec3(0.62, 0.66, 0.6) * (0.6 + 0.3 * abs(dot(N, L1))), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }

  // Paper: the printed art, lit softly, and this visitor's key printed in its panel.
  vec3 paper = texture2D(uPaper, vUv).rgb;
  vec4 text = texture2D(uText, vUv);
  paper = mix(paper, text.rgb, text.a);
  float lit = 0.62 + 0.38 * max(dot(N, L1), 0.0) + 0.12 * max(dot(N, L2), 0.0);
  vec3 col = paper * lit + 0.04 * pow(max(dot(N, normalize(L1 + V)), 0.0), 24.0);

  // The foil strip.
  vec2 s = (vUv - uStrip.xy) / uStrip.zw;
  vec2 aa = fwidth(s);
  float inside = smoothstep(0.0, aa.x, s.x) * smoothstep(0.0, aa.x, 1.0 - s.x) * smoothstep(0.0, aa.y, s.y) * smoothstep(0.0, aa.y, 1.0 - s.y);
  if (inside > 0.0) {
    vec3 hrm = texture2D(uHrm, s).rgb;
    float hx = texture2D(uHrm, s + vec2(uTexel.x, 0.0)).r;
    float hy = texture2D(uHrm, s + vec2(0.0, uTexel.y)).r;
    vec3 Nf = normalize(N - uBump * ((hx - hrm.r) * T + (hy - hrm.r) * B));
    float raised = hrm.b; // Patina's metalness: the raised, polished parts (the field behind them is cut finer)
    vec2 q = vec2(s.x * uStripAspect, s.y);

    // Where the grooves run: rings round the seal and the sun, bands at their own angles in the field.
    vec2 seal = vec2(0.5 * uStripAspect, 0.878);
    vec2 sun = vec2(0.5 * uStripAspect, 0.676);
    float band = floor((q.y + q.x * 0.7) * 26.0);
    float bandAngle = hash(vec2(band, 3.1)) * 3.14159;
    vec2 gBand = vec2(cos(bandAngle), sin(bandAngle));
    vec2 gSeal = q - seal;
    vec2 gSun = q - sun;
    float rSeal = length(gSeal);
    float rSun = length(gSun);
    float wheel = max(smoothstep(0.105, 0.09, rSeal), smoothstep(0.15, 0.13, rSun) * step(sun.y - 0.02, q.y));
    vec3 g = wheel > 0.5 ? inPlane(rSeal < 0.105 ? gSeal : gSun, T, B) : inPlane(gBand, T, B);
    float d = wheel > 0.5 ? 1150.0 : 900.0 + 600.0 * hash(vec2(band, 9.7));
    float spread = mix(0.32, 0.18, raised);
    vec3 holo = grating(L1, V, Nf, g, d, spread) + 0.55 * grating(L2, V, Nf, g, d, spread);
    // A second, finer cut across the first keeps colour in the field at angles the bands miss.
    vec3 g2 = inPlane(vec2(-gBand.y, gBand.x) + 0.3 * vec2(sin(q.y * 40.0), 0.0), T, B);
    holo += (1.0 - raised) * 0.5 * (grating(L1, V, Nf, g2, 1600.0, 0.5) + 0.55 * grating(L2, V, Nf, g2, 1600.0, 0.5));

    // And under both, a film's sheen: a hue that slides with the angle you look from, so no tilt is ever plain silver.
    float film = dot(Nf, V) * 2.2 + q.y * 1.3 + hrm.r * 0.8;
    holo += spectral(430.0 + 250.0 * (0.5 + 0.5 * sin(film * 6.28318))) * mix(0.42, 0.22, raised);

    // Glitter: cells two texels wide, one in four cut at a random angle, each flashing only at its own.
    vec2 cell = floor(s / (uTexel * 2.0));
    float hc = hash(cell);
    float a = hash(cell + 17.0) * 6.28318;
    vec3 glitter = step(0.75, hc) * (grating(L1, V, Nf, inPlane(vec2(cos(a), sin(a)), T, B), 800.0 + 900.0 * hash(cell + 5.0), 0.05) * 3.0);

    // Silver under it all: the printed foil's own shading, a soft studio in its reflection, and the lamps' glints.
    vec3 R = reflect(-V, Nf);
    float room = 0.3 + 0.55 * smoothstep(-0.3, 0.9, R.y) + 0.5 * exp(-pow((R.x - 0.35) * 3.0, 2.0) - pow((R.y - 0.5) * 2.0, 2.0));
    vec3 base = texture2D(uFoil, s).rgb * room * mix(0.55, 0.9, raised);
    float glint = pow(max(dot(Nf, normalize(L1 + V)), 0.0), 90.0) * (0.6 + raised);
    vec3 foil = base + holo * mix(1.25, 0.8, raised) + glitter + vec3(glint * 1.6);
    col = mix(col, foil, inside);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Coa({ w, h, weightsKey, held }: { w: number; h: number; weightsKey: string; held: boolean }) {
  const clock = useClock();
  const art = useArt();
  const tiltGroup = useRef<THREE.Group>(null);
  const material = useMemo(() => {
    const foil = art.coaFoil.image as { width: number; height: number };
    return new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERTEX,
      fragmentShader: fragment,
      uniforms: {
        uPaper: { value: art.coaPaper },
        uFoil: { value: art.coaFoil },
        uHrm: { value: art.coaFoilHrm },
        uText: { value: canvasTexture(paintCoaText(weightsKey, KEY_BOX), 8) },
        uStrip: { value: new THREE.Vector4(STRIP.x, 1 - STRIP.y - STRIP.h, STRIP.w, STRIP.h) },
        uStripAspect: { value: (STRIP.w * w) / (STRIP.h * h) },
        uTexel: { value: new THREE.Vector2(1 / foil.width, 1 / foil.height) },
        uBump: { value: 3 },
      },
      side: THREE.DoubleSide,
    });
  }, [art, weightsKey, w, h]);
  useEffect(
    () => () => {
      (material.uniforms.uText!.value as THREE.Texture).dispose();
      material.dispose();
    },
    [material],
  );

  useFrame((state, raw) => {
    const dt = frameDt(clock.current, raw);
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
