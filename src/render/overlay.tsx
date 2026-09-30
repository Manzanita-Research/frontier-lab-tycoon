// DOM elements pinned to points in the 3D scene (thought bubbles, coin pops, warnings).
// One lightweight registry instead of drei's <Html>, which mounts a React root per element.
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { layoutBubbles, type BubbleIn } from "./bubbles";

interface Anchor {
  el: HTMLElement;
  /** Writes the world position into `out`; false hides the element (e.g. the walker went inside). */
  pos(out: THREE.Vector3): boolean;
  /** Thought bubbles are laid out together (render/bubbles.ts): at most three show, and they nudge apart instead of overlapping. */
  group?: "bubble";
  /** A bubble that beats thoughts to the three places (speech). */
  first?: boolean;
  /** Keep a centred panel (translate(-50%)) inside the screen's width instead of letting it hang off an edge. */
  clamp?: boolean;
  /** The element's size in px, kept current by a ResizeObserver (bubbles and clamped panels). */
  w: number;
  h: number;
}

const anchors = new Set<Anchor>();
const v = new THREE.Vector3();

const bubbles: BubbleIn<Anchor>[] = [];

const put = (a: Anchor, x: number, y: number) => {
  a.el.style.display = "block";
  a.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
};

/** Lives inside the Canvas: projects every anchor to screen space each frame. */
export function OverlayProjector() {
  useFrame(({ camera, size }) => {
    bubbles.length = 0;
    for (const a of anchors) {
      if (!a.pos(v)) {
        a.el.style.display = "none";
        continue;
      }
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      if (a.group === "bubble") bubbles.push({ item: a, x, y, w: a.w, h: a.h, depth: v.z, first: a.first });
      else put(a, a.clamp ? Math.max(a.w / 2 + 6, Math.min(size.width - a.w / 2 - 6, x)) : x, y);
    }
    if (bubbles.length === 0) return;
    const shown = layoutBubbles(bubbles);
    const keep = new Set(shown.map((s) => s.item));
    for (const p of bubbles) if (!keep.has(p.item)) p.item.el.style.display = "none";
    for (const s of shown) put(s.item, s.x, s.y);
  });
  return null;
}

/** Renders `children` pinned to a world position. Lives in the DOM overlay, outside the Canvas. `bubble` joins the thought-bubble layout. */
export function Anchored({ pos, className, children, bubble, first, clamp }: { pos: Anchor["pos"]; className?: string; children?: ReactNode; bubble?: boolean; first?: boolean; clamp?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const el = ref.current!;
    const anchor: Anchor = { el, pos: (out) => posRef.current(out), group: bubble ? "bubble" : undefined, first, clamp, w: 120, h: 40 };
    let watch: ResizeObserver | null = null;
    if ((bubble || clamp) && typeof ResizeObserver !== "undefined") {
      const inner = el.firstElementChild as HTMLElement | null;
      watch = new ResizeObserver(() => {
        if (!inner) return;
        anchor.w = inner.offsetWidth;
        anchor.h = inner.offsetHeight;
      });
      if (inner) watch.observe(inner);
    }
    anchors.add(anchor);
    return () => {
      anchors.delete(anchor);
      watch?.disconnect();
    };
  }, [bubble, first, clamp]);
  return (
    <div ref={ref} className="anchor">
      <div className={className}>{children}</div>
    </div>
  );
}
