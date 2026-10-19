// HTML-in-canvas (FLT-88): does this browser let a WebGL canvas draw its own DOM children? Three API generations are
// out there (all behind `chrome://flags/#canvas-draw-element` until Chrome 157 ships it):
//   - Chromium 153: `<canvas layoutsubtree>`, `texElementImage2D(target, internalformat, element)`, and hit testing
//     follows the child's CSS `transform`.
//   - Chrome 154+: adds `texElementSubImage2D` and `canvas.updateElementGeometry(el, { canvasTransform })`.
//   - Chrome 157+: adds `content="drawable"` and the `drawable` attribute (the explainer as of 2026-09-16).
// The glass sets both attributes and calls whichever methods exist. No support: no glass, no CRT, the plain DOM UI.

export interface GlassSupport {
  /** `texElementSubImage2D` (154+) rather than the 153-era `texElementImage2D`. */
  sub: boolean;
  /** `updateElementGeometry` (154+) rather than hit testing through the child's CSS transform. */
  geometry: boolean;
  /** `content="drawable"` (157+) rather than only `layoutsubtree`. */
  content: boolean;
}

const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);

/** `?glass=off` behaves as if the browser had no HTML-in-canvas (for before/after shots on a flagged Chrome). */
export const glassOff = params.get("glass") === "off";

function probe(): GlassSupport | null {
  if (typeof window === "undefined" || glassOff) return null;
  const C = window.HTMLCanvasElement?.prototype as unknown as Record<string, unknown> | undefined;
  const G = window.WebGL2RenderingContext?.prototype as unknown as Record<string, unknown> | undefined;
  if (!C || !G || !("requestPaint" in C) || !("onpaint" in C)) return null;
  const sub = "texElementSubImage2D" in G;
  if (!sub && !("texElementImage2D" in G)) return null;
  return {
    sub,
    geometry: "updateElementGeometry" in C,
    content: "content" in C,
  };
}

/** The canvas side of HTML-in-canvas, as far as the glass uses it. */
export interface DrawableCanvas extends HTMLCanvasElement {
  requestPaint(): void;
  captureElementImage(el: Element): {
    width: number;
    height: number;
    close?(): void;
  };
  updateElementGeometry?(el: Element, options: { canvasTransform?: DOMMatrixInit }): void;
}

/** The WebGL side: 154+ snapshots into a texture it sized, 153 sizes the texture itself. */
export interface ElementTexturing {
  texElementSubImage2D?(target: GLenum, level: GLint, x: GLint, y: GLint, el: Element): void;
  texElementImage2D?(target: GLenum, internalformat: GLenum, el: Element): void;
}

/** What this browser offers, or null: decided once, at load. */
export const glassSupport: GlassSupport | null = probe();
