// The manual as a real little book: six bent sheets that turn around the spine. Each sheet is one strip of geometry
// bent along its width (the free edge lags behind while it turns), drawn twice: the front page, and the back page with
// its texture mirrored. Pages are canvases painted from `manual.ts`; the front cover is printed art.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { paintPage } from "../art";
import { PAGES, SHEETS } from "../manual";
import { canvasTexture, frameDt, k, useClock } from "./rig";
import { useArt } from "./textures";

const SEGMENTS = 22;
const GAP = 0.0025;

export function Book3D({ page, w, h }: { page: number; w: number; h: number }) {
  const clock = useClock();
  const group = useRef<THREE.Group>(null);
  const art = useArt();
  const sheets = useMemo(
    () =>
      Array.from({ length: SHEETS }, (_, i) => {
        const geometry = new THREE.PlaneGeometry(w, h, SEGMENTS, 1);
        const printed = i === 0 && PAGES[0]!.kind === "cover";
        const front = printed ? art.manualCover : canvasTexture(paintPage(PAGES[i * 2]!, i * 2), 8);
        const back = canvasTexture(paintPage(PAGES[i * 2 + 1]!, i * 2 + 1), 8);
        back.repeat.x = -1;
        back.offset.x = 1;
        const cover = i === 0 || i === SHEETS - 1;
        return {
          geometry,
          front: new THREE.MeshStandardMaterial({ map: front, roughness: cover ? 0.45 : 0.9, side: THREE.FrontSide }),
          back: new THREE.MeshStandardMaterial({ map: back, roughness: cover ? 0.45 : 0.9, side: THREE.BackSide }),
          printed,
          turn: -1,
          stiff: cover ? 0.25 : 0.95,
        };
      }),
    [w, h, art],
  );
  useEffect(
    () => () => {
      for (const s of sheets) {
        s.geometry.dispose();
        if (!s.printed) s.front.map?.dispose();
        s.back.map?.dispose();
        s.front.dispose();
        s.back.dispose();
      }
    },
    [sheets],
  );

  useFrame((_, raw) => {
    const dt = frameDt(clock.current, raw);
    sheets.forEach((s, i) => {
      const target = page > i ? 1 : 0;
      // Sheets turn one after another when you jump several pages.
      const next = s.turn < 0 ? target : s.turn + (target - s.turn) * k(6 - Math.min(4, Math.abs(page - i - 0.5)), dt);
      if (Math.abs(next - s.turn) < 1e-5 && s.turn >= 0) return;
      s.turn = Math.abs(next - target) < 1e-4 ? target : next;
      bend(s.geometry, s.turn, s.stiff, i, w, h);
    });
    // Closed on the cover, the book sits right of the spine; closed on the back, left of it; open, centred.
    if (group.current) {
      const x = page <= 0 ? -w / 2 : page >= SHEETS ? w / 2 : 0;
      group.current.position.x += (x - group.current.position.x) * k(5, dt);
    }
  });

  return (
    <group ref={group}>
      {sheets.map((s, i) => (
        <group key={i}>
          <mesh geometry={s.geometry} material={s.front} />
          <mesh geometry={s.geometry} material={s.back} />
        </group>
      ))}
    </group>
  );
}

/** Bend a sheet: `turn` 0 lies flat right of the spine, 1 flat left of it. */
function bend(g: THREE.PlaneGeometry, turn: number, stiff: number, i: number, w: number, h: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const a = turn * Math.PI;
  const lift = Math.sin(a);
  // Stack order: unturned sheets lie with sheet 0 on top; turned ones with the last turned on top.
  const z0 = THREE.MathUtils.lerp((SHEETS - i) * GAP, i * GAP, turn);
  let x = 0;
  let z = z0;
  const ds = w / SEGMENTS;
  const cols = SEGMENTS + 1;
  for (let j = 0; j < cols; j++) {
    if (j > 0) {
      const s = j / SEGMENTS;
      const phi = a - stiff * lift * s * 1.1;
      x += Math.cos(phi) * ds;
      z += Math.sin(phi) * ds;
    }
    // PlaneGeometry rows: top row (y = h/2) then bottom row.
    pos.setXYZ(j, x, h / 2, z);
    pos.setXYZ(cols + j, x, -h / 2, z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
}
