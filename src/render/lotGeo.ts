// FLT-98: the lot's models, hand-built like FLT-96's plaza props: one vertex-coloured geometry per model, with the words
// on separate textured cards. Every model faces +z, stands on y = 0 and is centred on its spot; `lot.ts` places it.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STAKE_SIGN_Y } from "./lot";
import { blob, box, bud, merge, paint, type Part } from "./plazaGeo";

const PLY = "#e2c48f";
const POST = "#8a6240";
const SURVEY = "#ff7a1a";
export const FLAG = "#ff3d8b";

/** The sign's painted face (a card on the board's front). */
export const STAKE_FACE = { w: 0.48, h: 0.28, z: 0.017 } as const;
/** The survey stake beside the sign, and where its flag is tied on. */
export const SURVEY_STAKE = { x: -0.31, z: 0.05, top: 0.64 } as const;

/** A plywood sign on two legs, and a survey stake knocked in beside it, its top sprayed orange. */
export function stakeGeometry(): THREE.BufferGeometry {
  const y = STAKE_SIGN_Y;
  return merge([
    box([0.03, y + 0.1, 0.03], POST, [-0.19, (y + 0.1) / 2, -0.03]),
    box([0.03, y + 0.1, 0.03], POST, [0.19, (y + 0.1) / 2, -0.03]),
    box([0.52, 0.32, 0.026], PLY, [0, y, 0]),
    box([0.026, SURVEY_STAKE.top, 0.026], "#d9b98a", [SURVEY_STAKE.x, SURVEY_STAKE.top / 2, SURVEY_STAKE.z]),
    box([0.03, 0.07, 0.03], SURVEY, [SURVEY_STAKE.x, SURVEY_STAKE.top - 0.035, SURVEY_STAKE.z]),
  ]);
}

/** The flag: a strip of pink survey tape, hinged at x = 0 where it's tied to the stake, streaming out along -x. */
export function flagGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.BoxGeometry(0.11, 0.065, 0.006).translate(-0.055, -0.035, 0), FLAG, [0, 0, 0]),
    paint(new THREE.BoxGeometry(0.03, 0.03, 0.03), FLAG, [0, -0.012, 0]),
  ]);
}

/** One card per stake, all in one geometry over a texture atlas of faces stacked top to bottom (`faces` of them). */
export function stakeFacesGeometry(placed: readonly { x: number; z: number; yaw: number; slot: number }[], faces: number): THREE.BufferGeometry {
  if (placed.length === 0) return new THREE.BufferGeometry();
  const cards = placed.map(({ x, z, yaw, slot }) => {
    const g = new THREE.PlaneGeometry(STAKE_FACE.w, STAKE_FACE.h).translate(0, STAKE_SIGN_Y, STAKE_FACE.z).rotateY(yaw).translate(x, 0, z);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (slot + 1 - uv.getY(i)) / faces);
    return g;
  });
  const g = mergeGeometries(cards)!;
  for (const c of cards) c.dispose();
  return g;
}

// The food truck. Its length runs along x, the cab at +x; the hatch and awning are on the +z side.
const TACO_YELLOW = "#ffcf4a";
const TEAL = "#2bb3a3";
const CORAL = "#ff6f59";
const CREAM = "#fff3d0";
const TYRE = "#2d2f33";
const GLASS = "#3b5b7a";

/** Where the truck's painted cards go: the roof sign (front) and the strip under the hatch. */
export const TRUCK_CARDS = {
  sign: { w: 0.7, h: 0.22, x: -0.11, y: 1.12, z: 0.017 },
  strip: { w: 1.0, h: 0.12, x: -0.22, y: 0.385, z: 0.326 },
} as const;

/** A taco van: a box body, a cab with a windscreen, an open hatch with a counter under a striped awning, and a taco. */
export function truckGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [
    // The body and the cab, on a teal skirt.
    box([1.16, 0.7, 0.64], TACO_YELLOW, [-0.22, 0.56, 0]),
    box([1.18, 0.14, 0.66], TEAL, [-0.22, 0.2, 0]),
    box([0.42, 0.46, 0.62], TACO_YELLOW, [0.57, 0.44, 0]),
    box([0.42, 0.12, 0.64], TEAL, [0.57, 0.2, 0]),
    box([0.03, 0.2, 0.52], GLASS, [0.78, 0.56, 0]),
    box([0.3, 0.2, 0.01], GLASS, [0.56, 0.56, 0.311]),
    box([0.3, 0.2, 0.01], GLASS, [0.56, 0.56, -0.311]),
    box([0.04, 0.06, 0.6], "#c9cdd2", [0.79, 0.2, 0]),
    box([0.02, 0.05, 0.08], CREAM, [0.79, 0.32, 0.22]),
    box([0.02, 0.05, 0.08], CREAM, [0.79, 0.32, -0.22]),
    box([0.04, 0.08, 0.6], "#c9cdd2", [-0.81, 0.2, 0]),
    // The hatch, the counter, and two bottles of hot sauce.
    box([0.72, 0.3, 0.01], "#3a2a1c", [-0.28, 0.66, 0.321]),
    box([0.78, 0.03, 0.1], "#c9cdd2", [-0.28, 0.5, 0.37]),
    box([0.03, 0.07, 0.03], "#d8322b", [-0.5, 0.55, 0.38]),
    box([0.03, 0.07, 0.03], "#2fa84f", [-0.44, 0.55, 0.38]),
    // The roof, and the sign's posts.
    box([1.2, 0.03, 0.68], CREAM, [-0.22, 0.925, 0]),
    box([0.03, 0.1, 0.03], "#6b4a2e", [-0.4, 0.99, 0]),
    box([0.03, 0.1, 0.03], "#6b4a2e", [0.18, 0.99, 0]),
    box([0.76, 0.27, 0.025], CORAL, [TRUCK_CARDS.sign.x, TRUCK_CARDS.sign.y, 0]),
  ];
  // The awning: cream and coral stripes, tipped out over the counter.
  for (let i = 0; i < 6; i++) {
    const g = new THREE.BoxGeometry(0.135, 0.02, 0.17).rotateX(0.38);
    parts.push(paint(g, i % 2 ? CREAM : CORAL, [-0.62 + i * 0.135 + 0.0675, 0.86, 0.39]));
  }
  // Wheels.
  for (const x of [-0.52, 0.56]) for (const z of [-0.31, 0.31]) {
    parts.push(paint(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 10).rotateX(Math.PI / 2), TYRE, [x, 0.11, z]));
    parts.push(paint(new THREE.CylinderGeometry(0.045, 0.045, 0.075, 8).rotateX(Math.PI / 2), "#c9cdd2", [x, 0.11, z]));
  }
  // The taco on the roof: a shell standing on its curve, filled to overflowing, on a little post.
  const shell = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  parts.push(paint(shell, "#f2b84b", [-0.66, 1.16, 0]));
  [-0.09, -0.03, 0.03, 0.09].forEach((dx, i) => parts.push(blob(0.04, i % 2 ? "#4ea347" : "#6cc04f", [-0.66 + dx, 1.17, 0.01], i)));
  parts.push(bud(0.032, "#e2402f", [-0.69, 1.2, 0.03]));
  parts.push(bud(0.032, "#e2402f", [-0.62, 1.195, -0.02]));
  parts.push(blob(0.04, "#8a4b2a", [-0.66, 1.15, -0.01]));
  parts.push(box([0.025, 0.1, 0.025], "#6b4a2e", [-0.66, 0.98, 0]));
  return merge(parts);
}

/** The cards: the roof sign's face and the strip under the hatch, over one texture (the sign on top, the strip below). */
export const TRUCK_ATLAS = { w: 1024, h: 512, sign: [0, 0, 1024, 304], strip: [0, 320, 1024, 130] } as const;
export function truckCardsGeometry(): THREE.BufferGeometry {
  const card = (c: { w: number; h: number; x: number; y: number; z: number }, [, top, , height]: readonly number[]) => {
    const g = new THREE.PlaneGeometry(c.w, c.h).translate(c.x, c.y, c.z);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (top! + (1 - uv.getY(i)) * height!) / TRUCK_ATLAS.h);
    return g;
  };
  const parts = [card(TRUCK_CARDS.sign, TRUCK_ATLAS.sign), card(TRUCK_CARDS.strip, TRUCK_ATLAS.strip)];
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return g;
}
