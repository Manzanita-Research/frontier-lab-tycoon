// The glass tube (FLT-88): one WebGL 2 pass over everything on screen. It lays the HUD (a drawable child of the
// canvas) over the 3D world (the R3F canvas, copied in) over the sky (another drawable child), then gives the
// picture the lite tube's scanlines, phosphor triad, bow and vignette, plus the rounded bezel, a faint phosphor
// bleed and (full) the roll and the flicker. Plain WebGL: no three, no React.
import type { DrawableCanvas, ElementTexturing, GlassSupport } from "./support";

const vertex = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  // One triangle over the whole screen.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D sky, world, hud;
uniform vec2 res;
uniform float pitch, scan, mask, curve, vignette, vignetteInner, corner, bleed, roll, flicker, time;
in vec2 vUv;
out vec4 color;

// Every layer is premultiplied, its first row at the top of the screen.
vec4 layers(vec2 uv) {
  vec2 t = vec2(uv.x, 1. - uv.y);
  vec4 c = texture(sky, t);
  vec4 w = texture(world, t);
  c = w + c * (1. - w.a);
  vec4 h = texture(hud, t);
  return h + c * (1. - h.a);
}

void main() {
  // The bow: the glass at vUv shows the picture at warp(vUv) (looks.ts \`warp\`, which aims clicks the same way).
  vec2 k = vUv * 2. - 1.;
  vec2 b = k * (1. + curve * k.yx * k.yx);
  vec2 uv = b * .5 + .5;
  if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) { color = vec4(0., 0., 0., 1.); return; }
  // Phosphor bleed: a little of the neighbours on the same line (the beam smears sideways, never up or down).
  vec2 px = vec2(1. / res.x, 0.);
  vec3 c = layers(uv).rgb * (1. - bleed) + (layers(uv - px).rgb + layers(uv + px).rgb) * (bleed * .5);
  float l = dot(c, vec3(.2126, .7152, .0722));
  // Scanlines whose gaps close on bright pixels, keeping the average brightness (lite.ts).
  float d = abs(fract(gl_FragCoord.y / pitch) - .5);
  float width = mix(.22, .42, sqrt(clamp(l, 0., 1.)));
  float beam = exp(-.5 * d * d / (width * width));
  c *= mix(1., beam / mix(.6, .85, sqrt(clamp(l, 0., 1.))), scan);
  float cell = mod(floor(gl_FragCoord.x), 3.);
  vec3 triad = cell < 1. ? vec3(1., 1. - mask, 1. - mask) : cell < 2. ? vec3(1. - mask, 1., 1. - mask) : vec3(1. - mask, 1. - mask, 1.);
  c *= triad / (1. - 2. * mask / 3.);
  c *= 1. - vignette * clamp((length(k) / 1.4142136 - vignetteInner) / max(1. - vignetteInner, .0001), 0., 1.);
  // Full: a slow bright band rolling down, and a flicker (both zero under reduced motion).
  float band = fract(vUv.y + time * .07);
  c *= 1. + roll * smoothstep(.9, 1., band) * (1. - smoothstep(.98, 1., band));
  c *= 1. - flicker * (.5 + .5 * sin(time * 61.));
  // The bezel's rounded corners, in device pixels on the glass.
  vec2 q = abs(vUv - .5) * res - (res * .5 - corner);
  float outside = length(max(q, 0.)) - corner;
  c *= 1. - smoothstep(-1., 1., outside);
  color = vec4(c, 1.);
}`;

export interface TubeLook {
  pitch: number;
  scan: number;
  mask: number;
  curve: number;
  vignette: number;
  vignetteInner: number;
  /** Device pixels. */
  corner: number;
  bleed: number;
  roll: number;
  flicker: number;
}

type Uniforms = Record<keyof TubeLook | "res" | "time" | "sky" | "world" | "hud", WebGLUniformLocation | null>;

/** The GL side of the glass: three textures and one draw. */
export class GlassTube {
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly u: Uniforms;
  private readonly tex: { sky: WebGLTexture; world: WebGLTexture; hud: WebGLTexture };
  private readonly api: GlassSupport;
  private readonly vao: WebGLVertexArrayObject;

  constructor(canvas: HTMLCanvasElement, api: GlassSupport) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: true });
    if (!gl) throw new Error("glass: no WebGL 2");
    this.gl = gl;
    this.api = api;
    this.program = link(gl, vertex, fragment);
    const names = ["pitch", "scan", "mask", "curve", "vignette", "vignetteInner", "corner", "bleed", "roll", "flicker", "res", "time", "sky", "world", "hud"] as const;
    this.u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(this.program, n)])) as Uniforms;
    const make = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // Transparent until the first paint fills it.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      return t;
    };
    this.tex = { sky: make(), world: make(), hud: make() };
    this.vao = gl.createVertexArray()!;
  }

  /** Snapshot a drawable child into its layer (call inside the canvas's `paint` event). */
  element(layer: "sky" | "hud", el: Element) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex[layer]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const tex = gl as unknown as ElementTexturing;
    if (this.api.sub && tex.texElementSubImage2D) {
      const img = (gl.canvas as DrawableCanvas).captureElementImage(el);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, Math.max(1, Math.round(img.width)), Math.max(1, Math.round(img.height)), 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      img.close?.();
      tex.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, el);
    } else {
      // Chromium 153: (target, internalformat, element).
      tex.texElementImage2D?.(gl.TEXTURE_2D, gl.RGBA8, el);
    }
  }

  /** Copy the 3D world's canvas in (same frame: R3F drew it in this frame's animation callbacks). */
  world(src: HTMLCanvasElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex.world);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  draw(look: TubeLook, time: number) {
    const gl = this.gl;
    const { width, height } = gl.canvas;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    (["sky", "world", "hud"] as const).forEach((k, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[k]);
      gl.uniform1i(this.u[k], i);
    });
    for (const k of Object.keys(look) as (keyof TubeLook)[]) gl.uniform1f(this.u[k], look[k]);
    gl.uniform2f(this.u.res, width, height);
    gl.uniform1f(this.u.time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const gl = this.gl;
    Object.values(this.tex).forEach((t) => gl.deleteTexture(t));
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
  }
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`glass shader: ${gl.getShaderInfoLog(s)}`);
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`glass program: ${gl.getProgramInfoLog(p)}`);
  return p;
}
