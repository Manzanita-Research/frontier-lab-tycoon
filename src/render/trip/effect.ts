// FLT-105: the trip's canvas pass, one postprocessing Effect. The map turns slowly into a kaleidoscope (lightly in the
// middle, so the campus stays readable and keeps its contrast, most of the way at the edges), the edges swirl, and the
// walls breathe: a slow zoom in and out. It only moves
// the picture about, never its brightness (trip.ts's `slideSpeed` holds the motion under a slow pan). Like the lite
// CRT, it tone-maps the scene itself and lays it over the sky, since the canvas is see-through.
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, type Texture } from "three";
import { aces } from "../crt/shaders";

const fragmentShader = /* glsl */ `
uniform float kaleido, segments, spin, swirl, breathe, aspect, toneExposure;
uniform sampler2D backdrop;
${aces}

vec2 toUv(vec2 p) { return clamp(p / vec2(aspect, 1.) + .5, 0., 1.); }

vec3 look(vec2 uv) {
  vec4 s = texture2D(inputBuffer, uv);
  float a = clamp(s.a, 0., 1.);
  vec3 c = a > 0. ? acesFilmic(s.rgb / a) : vec3(0.);
  return mix(texture2D(backdrop, uv).rgb, c, a);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 p = (uv - .5) * vec2(aspect, 1.) / breathe;
  float r = length(p);
  // The swirl: nothing at the middle, all of it at the edges.
  float a = atan(p.y, p.x) + swirl * smoothstep(0., .9, r);
  vec3 c = look(toUv(vec2(cos(a), sin(a)) * r));
  if (kaleido > .001) {
    float seg = 6.2831853 / segments;
    float k = abs(mod(a + spin, seg) - seg * .5);
    c = mix(c, look(toUv(vec2(cos(k), sin(k)) * r)), min(.9, kaleido * (.35 + 1.3 * smoothstep(.2, .75, r))));
  }
  outputColor = vec4(c, 1.);
}
`;

export interface TripPass {
  kaleido: number;
  segments: number;
  spin: number;
  swirl: number;
  breathe: number;
  aspect: number;
}

export class TripEffect extends Effect {
  constructor(backdrop: Texture) {
    super("TripEffect", fragmentShader, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["kaleido", new Uniform(0)],
        ["segments", new Uniform(6)],
        ["spin", new Uniform(0)],
        ["swirl", new Uniform(0)],
        ["breathe", new Uniform(1)],
        ["aspect", new Uniform(1)],
        ["toneExposure", new Uniform(1)],
        ["backdrop", new Uniform(backdrop)],
      ]),
    });
  }
  set(p: Partial<TripPass>) {
    for (const [k, v] of Object.entries(p)) {
      const u = this.uniforms.get(k);
      if (u && v !== undefined) u.value = v;
    }
  }
}
