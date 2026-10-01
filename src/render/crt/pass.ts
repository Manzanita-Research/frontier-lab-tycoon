/*
 * crt-shader's pmndrs adapter (postprocessing.js in crt-shader 1.0.1), ported. MIT, Copyright (c) 2026 Brooklyn
 * (OutThisLife); see ./LICENSE and ./NOTICE.md. Takes the composer's tone-mapped (or, with `toneMap`, raw) linear
 * input; writes encoded pixels to the screen, or linear ones to the next pass's buffer.
 */
import { Pass } from "postprocessing";
import type { TextureDataType, WebGLRenderer, WebGLRenderTarget } from "three";
import { CRTPipeline, type CRTOptions } from "./pipeline";

export class CRTPass extends Pass {
  readonly pipeline: CRTPipeline;
  constructor(options: CRTOptions = {}) {
    super("CRTPass");
    this.pipeline = new CRTPipeline(options);
  }
  setOptions(options: CRTOptions) {
    this.pipeline.setOptions(options);
    return this;
  }
  override setSize(width: number, height: number) {
    this.pipeline.setSize(width, height);
  }
  override initialize(renderer: WebGLRenderer, _alpha: boolean, _frameBufferType: TextureDataType) {
    this.pipeline.initialize(renderer);
  }
  get inputSize() {
    return this.pipeline.inputSize;
  }
  get stats() {
    return this.pipeline.stats;
  }
  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, outputBuffer: WebGLRenderTarget, _deltaTime?: number, stencilTest = false) {
    if (stencilTest) throw new Error("CRTPass does not support composer stencil masks.");
    this.pipeline.render(renderer, inputBuffer, this.renderToScreen ? null : outputBuffer, { linearInput: true, linearOutput: !this.renderToScreen });
  }
  override dispose() {
    this.pipeline.dispose();
  }
}
