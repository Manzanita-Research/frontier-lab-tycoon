import type { Rect } from "../sim/types";

/** The sim's tile grid is 24x24 with (0,0) in the corner; the scene is centred on the origin. */
export const HALF = 12;
export const worldX = (x: number) => x - HALF;
export const worldZ = (z: number) => z - HALF;
export const rectCenter = (r: Rect): [number, number] => [worldX(r.x + r.w / 2), worldZ(r.z + r.d / 2)];
