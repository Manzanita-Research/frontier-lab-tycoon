// The lite CRT (FLT-73): one postprocessing Effect, merged into the same pass as the tone mapping, for phones and for
// machines where the multi-pass pipeline costs too much. It borrows the full pipeline's ideas at a fraction of the
// cost: scanlines whose dark gaps close up on bright pixels (the beam widening), a faint RGB triad, the same barrel
// bow, and the world's vignette. One texture read per pixel.
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform } from "three";

const fragmentShader = /* glsl */ `
uniform float pitch, scan, mask, curve, vignette, vignetteInner;

void mainUv(inout vec2 uv) {
  vec2 c = uv * 2. - 1.;
  c *= 1. + curve * c.yx * c.yx;
  uv = c * .5 + .5;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) { outputColor = vec4(0., 0., 0., 1.); return; }
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(.2126, .7152, .0722));
  // Distance from the middle of this scanline, 0..0.5; bright pixels get a wider beam.
  float d = abs(fract(gl_FragCoord.y / pitch) - .5);
  float width = mix(.22, .42, sqrt(clamp(l, 0., 1.)));
  float beam = exp(-.5 * d * d / (width * width));
  // Keep the average brightness: the lines move light around, they do not dim the picture.
  c *= mix(1., beam / mix(.6, .85, sqrt(clamp(l, 0., 1.))), scan);
  float cell = mod(floor(gl_FragCoord.x), 3.);
  vec3 triad = cell < 1. ? vec3(1., 1. - mask, 1. - mask) : cell < 2. ? vec3(1. - mask, 1., 1. - mask) : vec3(1. - mask, 1. - mask, 1.);
  c *= triad / (1. - 2. * mask / 3.);
  vec2 k = vUv * 2. - 1.;
  c *= 1. - vignette * clamp((length(k) / 1.4142136 - vignetteInner) / max(1. - vignetteInner, .0001), 0., 1.);
  outputColor = vec4(c, inputColor.a);
}
`;

export interface LiteCrtOptions {
  /** Device pixels per scanline. */
  pitch: number;
  scan: number;
  mask: number;
  curve: number;
  vignette: number;
  vignetteInner: number;
}

export class LiteCrtEffect extends Effect {
  constructor(options: LiteCrtOptions) {
    super("LiteCrtEffect", fragmentShader, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.NONE,
      uniforms: new Map(Object.entries(options).map(([k, v]) => [k, new Uniform(v)])),
    });
  }
  set(options: Partial<LiteCrtOptions>) {
    for (const [k, v] of Object.entries(options)) {
      const u = this.uniforms.get(k);
      if (u && v !== undefined) u.value = v;
    }
  }
}
