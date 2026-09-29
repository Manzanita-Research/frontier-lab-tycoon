// Materials that change with the time of day. They are shared, so one update per frame lights every window and
// lantern on the campus at once; models just point at them.
import * as THREE from "three";
import { hex, type Ambience, type RGB } from "./clock";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixHex = (a: RGB, b: RGB, t: number, out: THREE.Color) => out.setRGB(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), THREE.SRGBColorSpace);

const GLASS_DAY = hex("#8fb4d4");
const GLASS_LIT = hex("#ffe08e");
const LANTERN_DAY = hex("#f3e8c4");
const LANTERN_LIT = hex("#ffd463");

/** Window panes: cool glass by day, warm and lit at night. */
export const windowMat = new THREE.MeshBasicMaterial({ color: "#8fb4d4", toneMapped: false });
/** Lantern heads on the gate posts and the path lamps. */
export const lanternMat = new THREE.MeshBasicMaterial({ color: "#f3e8c4", toneMapped: false });
/** The pool of light a lamp throws on the path; fades in with the lamps. */
export const lampPoolMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

export function updateGlow(a: Ambience) {
  mixHex(GLASS_DAY, GLASS_LIT, a.windowGlow, windowMat.color);
  mixHex(LANTERN_DAY, LANTERN_LIT, a.lampGlow, lanternMat.color);
  lampPoolMat.opacity = a.lampGlow * 0.9;
  lampPoolMat.visible = a.lampGlow > 0.01;
}
