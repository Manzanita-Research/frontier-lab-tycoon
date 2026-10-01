// The glass (FLT-88): the CRT over everything, UI included, through HTML-in-canvas. The sky and the 2D UI (world
// labels and the skin's HUD) become drawable children of one full-screen WebGL canvas, which snapshots them into
// textures, copies the 3D world's canvas in between, and runs one tube pass over the lot. The children stay real DOM:
// they keep focus, keyboard, accessibility and hit testing (the canvas is told where it drew them). The canvas itself
// takes no pointer, so a click that misses the UI falls through to the world, aimed through the bow (crt/events.ts).
// No HTML-in-canvas: none of this mounts, and there is no CRT at all (crt.ts).
import { useAtomValue } from "@effect/atom-react";
import { useEffect, useRef, type ReactNode } from "react";
import { CRT_LOOKS } from "../../render/crt/looks";
import { crtAtom, crtView } from "../../render/crt/state";
import { glassSupport, type DrawableCanvas } from "./support";
import { GlassTube, type TubeLook } from "./tube";
import "./glass.css";

/** Is the glass up: the browser has HTML-in-canvas and a CRT look is on. */
export function useGlass(): boolean {
  const { mode } = useAtomValue(crtAtom);
  return glassSupport !== null && mode !== "off";
}

interface Stat {
  ms: number;
  n: number;
}
const avg = (s: Stat, ms: number) => {
  s.n++;
  s.ms += (ms - s.ms) / Math.min(s.n, 60);
};

/**
 * `window.__glass`: what the glass is doing and what it costs on the main thread, per frame (a running mean over the
 * last ~60 frames): `hud` and `sky` are the element snapshots (only frames where they changed), `world` the copy of
 * the 3D canvas, `draw` the tube pass, `total` the whole paint handler.
 */
export const glassStats = {
  api: glassSupport,
  frames: 0,
  hudUploads: 0,
  skyUploads: 0,
  size: [0, 0] as [number, number],
  hud: { ms: 0, n: 0 },
  sky: { ms: 0, n: 0 },
  world: { ms: 0, n: 0 },
  draw: { ms: 0, n: 0 },
  total: { ms: 0, n: 0 },
  errors: [] as string[],
};

function lookFor(mode: "subtle" | "full", dpr: number, reduced: boolean): TubeLook {
  const l = CRT_LOOKS[mode];
  return {
    pitch: l.pitch * dpr,
    scan: l.lite.scan,
    mask: l.lite.mask,
    curve: l.curve,
    vignette: l.vignette,
    vignetteInner: l.vignetteInner,
    corner: l.css.corner * dpr,
    bleed: mode === "full" ? 0.3 : 0.16,
    roll: reduced ? 0 : l.css.roll,
    flicker: reduced ? 0 : l.css.flicker,
  };
}

/** The 3D world's canvas (R3F's), the one canvas on the page that is not the glass. */
const worldCanvas = () => document.querySelector<HTMLCanvasElement>("canvas:not(.crt-glass)");

export function Glass({ back, children }: { back: ReactNode; children: ReactNode }) {
  const { mode } = useAtomValue(crtAtom);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current as DrawableCanvas | null;
    const sky = backRef.current;
    const hud = frontRef.current;
    const api = glassSupport;
    if (!canvas || !sky || !hud || !api || mode === "off") return;
    (window as unknown as { __glass: typeof glassStats }).__glass = glassStats;
    let tube: GlassTube;
    try {
      tube = new GlassTube(canvas, api);
    } catch (e) {
      glassStats.errors.push(String(e));
      return;
    }
    const reducedQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let dpr = 1;
    let look = lookFor(mode, dpr, !!reducedQuery?.matches);
    // Picks and R3F's ray go through the bow; the labels don't pre-bend, the tube bends them with everything else.
    crtView.curve = look.curve;
    crtView.glass = true;

    // Hit testing: tell the canvas where each child is drawn. They fill the canvas at its own CSS size, so it is the
    // identity; the bow is not affine, so near the corners a click lands a few pixels off what the glass shows
    // (see the FLT-88 PR). Chromium 153 has no updateElementGeometry and hit-tests the child where its layout is.
    const place = () => {
      canvas.updateElementGeometry?.(hud, { canvasTransform: new DOMMatrix() });
    };

    const resize = new ResizeObserver(([entry]) => {
      const css = entry?.contentBoxSize[0];
      if (!entry || !css) return;
      const box = entry.devicePixelContentBoxSize?.[0];
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(box && scale === window.devicePixelRatio ? box.inlineSize : css.inlineSize * scale));
      canvas.height = Math.max(1, Math.round(box && scale === window.devicePixelRatio ? box.blockSize : css.blockSize * scale));
      dpr = canvas.width / Math.max(1, css.inlineSize);
      look = lookFor(mode, dpr, !!reducedQuery?.matches);
      glassStats.size = [canvas.width, canvas.height];
      fresh = true;
      canvas.requestPaint();
    });
    try {
      resize.observe(canvas, { box: "device-pixel-content-box" });
    } catch {
      resize.observe(canvas);
    }

    let fresh = true;
    let placed = false;
    const t0 = performance.now();
    const onPaint = (ev: Event) => {
      const start = performance.now();
      try {
        const changed = (ev as Event & { changedElements?: readonly Element[] }).changedElements;
        const all = fresh || !changed;
        fresh = false;
        let t = performance.now();
        if (all || changed!.includes(sky)) {
          tube.element("sky", sky);
          glassStats.skyUploads++;
          avg(glassStats.sky, performance.now() - t);
        }
        t = performance.now();
        if (all || changed!.includes(hud)) {
          tube.element("hud", hud);
          glassStats.hudUploads++;
          avg(glassStats.hud, performance.now() - t);
          if (!placed) {
            place();
            placed = true;
          }
        }
        t = performance.now();
        const w = worldCanvas();
        if (w) tube.world(w);
        avg(glassStats.world, performance.now() - t);
        t = performance.now();
        tube.draw(look, (performance.now() - t0) / 1000);
        avg(glassStats.draw, performance.now() - t);
        glassStats.frames++;
        avg(glassStats.total, performance.now() - start);
      } catch (e) {
        if (glassStats.errors.length < 20) glassStats.errors.push(String(e));
      }
      // The world moves every frame, so the glass paints every frame too.
      canvas.requestPaint();
    };
    canvas.addEventListener("paint", onPaint);
    canvas.requestPaint();

    return () => {
      canvas.removeEventListener("paint", onPaint);
      resize.disconnect();
      tube.dispose();
      crtView.curve = 0;
      crtView.glass = false;
    };
  }, [mode]);

  if (!glassSupport || mode === "off") return <>{children}</>;
  // `layoutsubtree` (Chromium 153+) and `content="drawable"` (157+) both opt the children into layout; `drawable`
  // (157+) marks what can be drawn. Unknown attributes are harmless on the builds that predate them.
  const canvasAttrs = { layoutsubtree: "", content: "drawable" } as object;
  const layerAttrs = { drawable: "" } as object;
  return (
    <canvas ref={canvasRef} className="crt-glass" {...canvasAttrs}>
      <div ref={backRef} className="glass-layer glass-back" aria-hidden="true" {...layerAttrs}>
        {back}
      </div>
      <div ref={frontRef} className="glass-layer glass-front" {...layerAttrs}>
        {children}
      </div>
    </canvas>
  );
}
