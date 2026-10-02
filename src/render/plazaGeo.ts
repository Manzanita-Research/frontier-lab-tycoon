// FLT-96: the plaza props' models, hand-built from boxes and low-poly blobs. Each is one geometry with vertex colours,
// so all the benches (or planters) draw in one call, and none comes near FLT-89's 3,000-triangle budget for a prop.
// Every model faces +z, stands on y = 0, and is centred on its spot; `plaza.ts` turns and places it.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Part = THREE.BufferGeometry;

const WOOD = "#c98d52";
const WOOD_DARK = "#a9713f";
const IRON = "#3d4249";
const POST = "#6b4a2e";

/** One coloured piece: a geometry moved to `p` (and turned `ry` about y), painted `color` in its vertices. */
export function paint(geo: Part, color: string, p: readonly [number, number, number], ry = 0): Part {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute("uv");
  g.rotateY(ry);
  g.translate(p[0], p[1], p[2]);
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

export const box = (s: readonly [number, number, number], color: string, p: readonly [number, number, number]) => paint(new THREE.BoxGeometry(s[0], s[1], s[2]), color, p);
export const blob = (r: number, color: string, p: readonly [number, number, number], ry = 0) => paint(new THREE.IcosahedronGeometry(r, 0), color, p, ry);
export const bud = (r: number, color: string, p: readonly [number, number, number]) => paint(new THREE.OctahedronGeometry(r, 0), color, p);

export function merge(parts: Part[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** A park bench: three seat slats and two back slats on cast-iron ends, sized for a 0.79-tall researcher. */
export function benchGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [];
  [-0.05, 0, 0.05].forEach((z, i) => parts.push(box([0.6, 0.024, 0.042], i % 2 ? WOOD_DARK : WOOD, [0, 0.19, z])));
  [0.26, 0.32].forEach((y, i) => parts.push(box([0.6, 0.042, 0.02], i % 2 ? WOOD : WOOD_DARK, [0, y, -0.068])));
  for (const x of [-0.27, 0.27]) {
    parts.push(box([0.03, 0.18, 0.03], IRON, [x, 0.09, 0.055]));
    parts.push(box([0.03, 0.36, 0.03], IRON, [x, 0.18, -0.065]));
    parts.push(box([0.03, 0.022, 0.15], IRON, [x, 0.25, -0.005]));
  }
  return merge(parts);
}

/** A long terracotta trough with three shrubs and a scatter of flowers. */
export function planterGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [
    box([0.5, 0.13, 0.15], "#c4693d", [0, 0.065, 0]),
    box([0.54, 0.03, 0.17], "#dc8a5a", [0, 0.14, 0]),
    box([0.48, 0.01, 0.12], "#5a3d28", [0, 0.152, 0]),
  ];
  const greens = ["#4ea347", "#3f8f3e", "#5cb54f"];
  [-0.16, 0, 0.16].forEach((x, i) => parts.push(blob(i === 1 ? 0.085 : 0.07, greens[i]!, [x, 0.2 + (i === 1 ? 0.02 : 0), 0], i * 0.9)));
  const flowers: [number, number, number, string][] = [
    [-0.21, 0.24, 0.035, "#ff7aa8"], [-0.1, 0.27, -0.03, "#ffd23f"], [-0.03, 0.31, 0.04, "#ffffff"],
    [0.06, 0.29, -0.035, "#ff7aa8"], [0.13, 0.26, 0.04, "#ffd23f"], [0.21, 0.24, -0.02, "#ff5d4d"],
  ];
  for (const [x, y, z, c] of flowers) parts.push(bud(0.026, c, [x, y, z]));
  return merge(parts);
}

/** The welcome sign's posts, frame and cap; its painted face is a separate textured card (`SIGN_FACE`). */
export const SIGN_FACE = { w: 1.14, h: 0.42, y: 0.66, z: 0.027 } as const;
export function signGeometry(): THREE.BufferGeometry {
  return merge([
    box([0.055, 0.9, 0.055], POST, [-0.56, 0.45, 0]),
    box([0.055, 0.9, 0.055], POST, [0.56, 0.45, 0]),
    box([1.22, 0.5, 0.05], "#ff8a4c", [0, SIGN_FACE.y, 0]),
    box([1.3, 0.045, 0.09], "#f7eed6", [0, SIGN_FACE.y + 0.27, 0]),
    // A little sun on top, rising.
    paint(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), "#ffbe3d", [0.42, SIGN_FACE.y + 0.29, 0]),
  ]);
}

/** The face, front and back, so it reads from the gate and from across the lot. */
export function signFaceGeometry(): THREE.BufferGeometry {
  const front = new THREE.PlaneGeometry(SIGN_FACE.w, SIGN_FACE.h).translate(0, SIGN_FACE.y, SIGN_FACE.z);
  const back = new THREE.PlaneGeometry(SIGN_FACE.w, SIGN_FACE.h).rotateY(Math.PI).translate(0, SIGN_FACE.y, -SIGN_FACE.z);
  const g = mergeGeometries([front, back])!;
  front.dispose();
  back.dispose();
  return g;
}

export const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;
