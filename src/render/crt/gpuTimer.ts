// GPU time of the CRT pass (FLT-73), for `?debug=1` and the frame-time table: WebGL 2's disjoint timer query around
// the pass, read back a few frames later (queries never block). Most desktop Chrome builds expose the extension;
// Safari and many phones do not, and then `ms` stays null.
interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  /** Smoothed milliseconds per frame, or null (no extension, or no result yet). */
  ms: number | null = null;
  samples = 0;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl as WebGL2RenderingContext;
    this.ext = "createQuery" in gl ? (gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null) : null;
  }

  get supported() {
    return this.ext !== null;
  }

  begin() {
    if (!this.ext || this.active || this.pending.length > 3) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end() {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
    this.poll();
  }

  private poll() {
    const { gl, ext } = this;
    if (!ext) return;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const q = this.pending[0]!;
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) {
        const ms = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6;
        this.ms = this.ms === null ? ms : this.ms * 0.9 + ms * 0.1;
        this.samples++;
      }
      gl.deleteQuery(q);
    }
  }

  dispose() {
    for (const q of this.pending) this.gl.deleteQuery(q);
    this.pending.length = 0;
  }
}
