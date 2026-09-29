// DOM elements pinned to points in the 3D scene (thought bubbles, coin pops, warnings).
// One lightweight registry instead of drei's <Html>, which mounts a React root per element.
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

interface Anchor {
  el: HTMLElement;
  /** Writes the world position into `out`; false hides the element (e.g. the walker went inside). */
  pos(out: THREE.Vector3): boolean;
}

const anchors = new Set<Anchor>();
const v = new THREE.Vector3();

/** Lives inside the Canvas: projects every anchor to screen space each frame. */
export function OverlayProjector() {
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      if (!a.pos(v)) {
        a.el.style.display = "none";
        continue;
      }
      v.project(camera);
      a.el.style.display = "block";
      a.el.style.transform = `translate3d(${Math.round((v.x * 0.5 + 0.5) * size.width)}px, ${Math.round((-v.y * 0.5 + 0.5) * size.height)}px, 0)`;
    }
  });
  return null;
}

/** Renders `children` pinned to a world position. Lives in the DOM overlay, outside the Canvas. */
export function Anchored({ pos, className, children }: { pos: Anchor["pos"]; className?: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const anchor: Anchor = { el: ref.current!, pos: (out) => posRef.current(out) };
    anchors.add(anchor);
    return () => void anchors.delete(anchor);
  }, []);
  return (
    <div ref={ref} className="anchor">
      <div className={className}>{children}</div>
    </div>
  );
}
