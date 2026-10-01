/*
 * The CRT pipeline, ported to TypeScript from crt-shader 1.0.1's three-pipeline.js (https://github.com/OutThisLife/crt-shader).
 * SPDX-License-Identifier: MIT. Copyright (c) 2026 Brooklyn (OutThisLife). See ./LICENSE and ./NOTICE.md.
 *
 * Why a port and not the npm package: crt-shader asks for three ^0.186 (we are on 0.180), and FLT needs two things
 * inside the pipeline rather than as extra full-screen passes: the scene's ACES tone mapping (folded into the first
 * preparation stage) and the tube (curvature, vignette, corners; folded into the optics stage). The stage structure,
 * the downsampling chain, the targets and the renderer-state bookkeeping are upstream's. FLT changes are marked `FLT:`.
 *
 * Cost per frame: log2(scene / input) half-size preparation draws, then three stages: horizontal (15 taps, at output
 * width x input rows), vertical (7 taps, output size) and optics (13 taps, output size; 49 more if `cameraBlur` > 0,
 * which the game's looks keep at 0).
 */
import {
  BufferGeometry, Float32BufferAttribute, GLSL3, HalfFloatType, LinearFilter, Mesh, NearestFilter, NoBlending,
  NoColorSpace, OrthographicCamera, RawShaderMaterial, Scene, UnsignedByteType, Vector2, Vector4, WebGLRenderTarget,
  type IUniform, type MagnificationTextureFilter, type Texture, type TextureDataType, type WebGLRenderer,
} from "three";
import { PRESETS, SETTING_KEYS, resolveSettings, type CRTPreset, type CRTSettings } from "./presets";
import { copy as copyShader, horizontal, optics, prepare as prepareShader, vertex, vertical } from "./shaders";

export type CRTMode = "crt" | "pixelated" | "original";

/** FLT: the tube the picture is shown through. All zero is upstream's flat picture. */
export interface CRTTube {
  /** Barrel bow: 0 is flat, 0.02 is a gentle 90s monitor, 0.05 is a TV from a yard sale. */
  curve: number;
  /** How dark the farthest corner gets (0..1). */
  vignette: number;
  /** Where the vignette starts, as a share of the centre-to-corner distance. */
  vignetteInner: number;
  /** Corner radius in output pixels (0: square). */
  corner: number;
}
export const FLAT_TUBE: CRTTube = Object.freeze({ curve: 0, vignette: 0, vignetteInner: 0.6, corner: 0 });

export interface CRTOptions extends Partial<CRTSettings> {
  preset?: CRTPreset;
  /** The longest edge of the downsampled input. Auto: 32px per 384 CSS pixels, rounded up in 8px steps (upstream). */
  inputResolution?: "auto" | number;
  mode?: CRTMode;
  tube?: Partial<CRTTube>;
  /** FLT: tone-map linear input with ACES filmic before encoding it (the renderer's own tone mapping). */
  toneMap?: boolean;
}

export interface CRTSize {
  width: number;
  height: number;
}

const OPTION_KEYS = ["preset", "inputResolution", "mode", "tube", "toneMap"];

function material(fragmentShader: string, uniforms: Record<string, IUniform>) {
  const strip = (s: string) => s.replace(/^#version 300 es\n/, "");
  return new RawShaderMaterial({
    glslVersion: GLSL3, vertexShader: strip(vertex), fragmentShader: strip(fragmentShader), uniforms,
    depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: false,
  });
}

interface Resources {
  uniforms: Record<string, IUniform>;
  stages: RawShaderMaterial[];
  preparation: RawShaderMaterial;
  copier: RawShaderMaterial;
  geometry: BufferGeometry;
  mesh: Mesh;
  scene: Scene;
  camera: OrthographicCamera;
}

/** One CRT: prepare (downsample), then horizontal, vertical and optics stages. Shared by the pass and by render-to-texture users. */
export class CRTPipeline {
  options: CRTOptions = {};
  settings: CRTSettings = { ...PRESETS.reference };
  tube: CRTTube = { ...FLAT_TUBE };
  mode: CRTMode = "crt";
  inputResolution: "auto" | number = "auto";
  toneMap = false;
  toneExposure = 1;
  /**
   * FLT: a display-encoded picture to show where the scene is transparent (the sky, when the canvas is see-through).
   * Laid under the scene after tone mapping, so it keeps its colours. Null: the scene's own alpha is ignored.
   */
  backdrop: Texture | null = null;
  readonly size = new Vector2(1, 1);
  private readonly cssSize = new Vector2();
  private readonly screenSize = new Vector2();
  private readonly savedViewport = new Vector4();
  private readonly savedCurrentViewport = new Vector4();
  private readonly savedScissor = new Vector4();
  private readonly savedCurrentScissor = new Vector4();
  private readonly targets = new Map<string, WebGLRenderTarget>();
  private resources: Resources | null = null;
  private floatTargets: boolean | null = null;
  private _inputSize: CRTSize = { width: 0, height: 0 };
  disposed = false;
  readonly counters = { renders: 0, drawCalls: 0, targetAllocations: 0, preparationPasses: 0 };

  constructor(options: CRTOptions = {}) {
    this.setOptions(options);
  }

  setOptions(options: CRTOptions = {}): this {
    const next: Record<string, unknown> = { ...this.options, ...options };
    for (const key of Object.keys(next)) {
      if (!(SETTING_KEYS as string[]).includes(key) && !OPTION_KEYS.includes(key)) throw new TypeError(`Unknown CRT option: ${key}`);
      if (next[key] === undefined) delete next[key];
    }
    const opts = next as CRTOptions;
    const resolution = opts.inputResolution ?? "auto";
    if (resolution !== "auto" && (!Number.isInteger(resolution) || resolution < 1)) throw new RangeError("CRT inputResolution must be auto or a positive integer.");
    const mode = opts.mode ?? "crt";
    if (!["crt", "pixelated", "original"].includes(mode)) throw new RangeError(`Unknown CRT mode: ${mode}`);
    const overrides = Object.fromEntries(SETTING_KEYS.filter((k) => opts[k] !== undefined).map((k) => [k, opts[k]]));
    this.settings = resolveSettings(opts.preset ?? "reference", overrides);
    this.tube = { ...FLAT_TUBE, ...opts.tube };
    this.toneMap = opts.toneMap ?? false;
    this.options = opts;
    this.mode = mode;
    this.inputResolution = resolution;
    return this;
  }

  setSize(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new RangeError("CRT output dimensions must be positive.");
    this.size.set(Math.round(width), Math.round(height));
  }

  initialize(renderer: WebGLRenderer) {
    // FLT: a disposed pipeline comes back on its next render (React's strict mode disposes and reuses effects' objects).
    this.disposed = false;
    if (this.resources) return;
    this.floatTargets = renderer.extensions.has("EXT_color_buffer_float");
    const uniforms: Record<string, IUniform> = {
      tex: { value: null }, sourceSize: { value: new Vector2() }, outputSize: { value: new Vector2() },
      viewOrigin: { value: new Vector2() }, viewSize: { value: new Vector2() }, bypass: { value: 0 },
      ...Object.fromEntries(SETTING_KEYS.map((key) => [key, { value: this.settings[key] }])),
      // FLT: the tube.
      curve: { value: 0 }, vignette: { value: 0 }, vignetteInner: { value: 0.6 }, corner: { value: 0 },
    };
    const stages = [horizontal, vertical, optics].map((shader) => material(shader, uniforms));
    const preparation = material(prepareShader, { tex: { value: null }, encodeInput: { value: false }, toneMap: { value: false }, toneExposure: { value: 1 }, useBackdrop: { value: false }, backdrop: { value: null } });
    const copier = material(copyShader, { tex: { value: null }, encodeInput: { value: false }, decodeOutput: { value: false }, nearestInput: { value: false } });
    const geometry = new BufferGeometry();
    // The frozen vertex shader names its attribute a_position, not position.
    geometry.setAttribute("a_position", new Float32BufferAttribute([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1], 2));
    geometry.setDrawRange(0, 6);
    const mesh = new Mesh(geometry, preparation);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    this.resources = { uniforms, stages, preparation, copier, geometry, mesh, scene, camera: new OrthographicCamera() };
  }

  get inputSize(): CRTSize {
    return { ...this._inputSize };
  }

  get stats() {
    return { ...this.counters, inputSize: this.inputSize, outputSize: { width: this.size.x, height: this.size.y }, targets: this.targets.size, floatTargets: this.floatTargets, disposed: this.disposed };
  }

  private target(key: string, width: number, height: number, filter: MagnificationTextureFilter = NearestFilter, type: TextureDataType = this.floatTargets ? HalfFloatType : UnsignedByteType) {
    let target = this.targets.get(key);
    if (!target) {
      target = new WebGLRenderTarget(width, height, { type, minFilter: filter, magFilter: filter, colorSpace: NoColorSpace, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      target.texture.name = `CRT ${key}`;
      this.targets.set(key, target);
      this.counters.targetAllocations++;
    } else target.setSize(width, height);
    return target;
  }

  private draw(renderer: WebGLRenderer, shader: RawShaderMaterial, texture: Texture, target: WebGLRenderTarget | null, width: number, height: number) {
    const { mesh, scene, camera } = this.resources!;
    shader.uniforms.tex!.value = texture;
    mesh.material = shader;
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, width / renderer.getPixelRatio(), height / renderer.getPixelRatio());
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    this.counters.drawCalls++;
  }

  private copy(renderer: WebGLRenderer, texture: Texture, target: WebGLRenderTarget | null, width: number, height: number, { encode = false, decode = false, nearest = false } = {}) {
    const shader = this.resources!.copier;
    shader.uniforms.encodeInput!.value = encode;
    shader.uniforms.decodeOutput!.value = decode;
    shader.uniforms.nearestInput!.value = nearest;
    this.draw(renderer, shader, texture, target, width, height);
  }

  private prepare(renderer: WebGLRenderer, input: WebGLRenderTarget, linearInput: boolean) {
    const { width, height } = input;
    renderer.getSize(this.cssSize);
    const longest = this.inputResolution === "auto" ? Math.max(32, Math.ceil(((Math.max(this.cssSize.x, this.cssSize.y) / 384) * 32) / 8) * 8) : this.inputResolution;
    const scale = Math.min(1, longest / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    this._inputSize = { width: w, height: h };
    let sw = width;
    let sh = height;
    let texture: Texture = input.texture;
    let level = 0;
    const prep = this.resources!.preparation;
    prep.uniforms.toneMap!.value = this.toneMap;
    prep.uniforms.toneExposure!.value = renderer.toneMappingExposure;
    prep.uniforms.useBackdrop!.value = this.backdrop !== null;
    prep.uniforms.backdrop!.value = this.backdrop;
    // Even at native resolution, isolate nearest sampling and RGBA8 input from the caller's target.
    do {
      const nw = Math.max(w, Math.ceil(sw / 2));
      const nh = Math.max(h, Math.ceil(sh / 2));
      const target = this.target(`prepare-${level}`, nw, nh, NearestFilter, UnsignedByteType);
      prep.uniforms.encodeInput!.value = linearInput && level === 0;
      this.draw(renderer, prep, texture, target, nw, nh);
      texture = target.texture;
      sw = nw;
      sh = nh;
      level++;
    } while (sw !== w || sh !== h);
    for (const [key, target] of this.targets) {
      if (key.startsWith("prepare-") && Number(key.slice(8)) >= level) {
        target.dispose();
        this.targets.delete(key);
      }
    }
    this.counters.preparationPasses = level;
    return texture;
  }

  render(renderer: WebGLRenderer, input: WebGLRenderTarget, output: WebGLRenderTarget | null, { linearInput = false, linearOutput = false } = {}) {
    this.initialize(renderer);
    const width = output?.width ?? renderer.getDrawingBufferSize(this.screenSize).x;
    const height = output?.height ?? this.screenSize.y;
    this.setSize(width, height);
    const savedTarget = renderer.getRenderTarget();
    const cubeFace = renderer.getActiveCubeFace();
    const mipLevel = renderer.getActiveMipmapLevel();
    const autoClear = renderer.autoClear;
    const xr = renderer.xr.enabled;
    const scissorTest = renderer.getScissorTest();
    const gl = renderer.getContext();
    const currentScissorTest = gl.isEnabled(gl.SCISSOR_TEST);
    this.savedCurrentScissor.fromArray(gl.getParameter(gl.SCISSOR_BOX));
    renderer.getViewport(this.savedViewport);
    renderer.getCurrentViewport(this.savedCurrentViewport);
    renderer.getScissor(this.savedScissor);
    renderer.autoClear = false;
    renderer.xr.enabled = false;
    try {
      if (this.mode === "original") {
        this._inputSize = { width: input.width, height: input.height };
        this.counters.preparationPasses = 0;
        this.copy(renderer, input.texture, output, width, height, { encode: linearInput && !linearOutput });
      } else {
        const prepared = this.prepare(renderer, input, linearInput);
        if (this.mode === "pixelated") {
          this.copy(renderer, prepared, output, width, height, { decode: linearOutput, nearest: true });
        } else {
          const { uniforms, stages } = this.resources!;
          const { width: sw, height: sh } = this._inputSize;
          uniforms.sourceSize!.value.set(sw, sh);
          uniforms.viewSize!.value.set(sw, sh);
          uniforms.outputSize!.value.set(width, height);
          for (const key of SETTING_KEYS) uniforms[key]!.value = this.settings[key];
          // FLT: the tube. The corner radius is given in CSS pixels by the looks, so it follows the pixel ratio.
          uniforms.curve!.value = this.tube.curve;
          uniforms.vignette!.value = this.tube.vignette;
          uniforms.vignetteInner!.value = this.tube.vignetteInner;
          uniforms.corner!.value = this.tube.corner * (output ? 1 : renderer.getPixelRatio());
          const horizontalTarget = this.target("horizontal", width, sh);
          const verticalTarget = this.target("vertical", width, height, LinearFilter);
          this.draw(renderer, stages[0]!, prepared, horizontalTarget, width, sh);
          this.draw(renderer, stages[1]!, horizontalTarget.texture, verticalTarget, width, height);
          const destination = linearOutput ? this.target("encoded-output", width, height, LinearFilter) : output;
          this.draw(renderer, stages[2]!, verticalTarget.texture, destination, width, height);
          if (linearOutput) this.copy(renderer, destination!.texture, output, width, height, { decode: true });
        }
      }
      this.counters.renders++;
    } finally {
      renderer.autoClear = autoClear;
      renderer.xr.enabled = xr;
      renderer.setViewport(this.savedViewport);
      renderer.setScissor(this.savedScissor);
      renderer.setScissorTest(scissorTest);
      // setRenderTarget resets the active viewport, even when the caller used setViewport after binding its target.
      if (savedTarget) {
        const viewport = savedTarget.viewport;
        savedTarget.viewport = this.savedCurrentViewport;
        try {
          renderer.setRenderTarget(savedTarget, cubeFace, mipLevel);
        } finally {
          savedTarget.viewport = viewport;
        }
      } else renderer.setRenderTarget(null, cubeFace, mipLevel);
      renderer.state.scissor(this.savedCurrentScissor);
      renderer.state.setScissorTest(currentScissorTest);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const target of this.targets.values()) target.dispose();
    this.targets.clear();
    if (this.resources) {
      const { stages, preparation, copier, geometry, scene } = this.resources;
      for (const shader of [...stages, preparation, copier]) shader.dispose();
      geometry.dispose();
      scene.clear();
      this.resources = null;
    }
  }
}
