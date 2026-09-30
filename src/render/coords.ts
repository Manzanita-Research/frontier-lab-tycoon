import type { Rect } from "../sim/types";

/** The sim's tile grid is 24x24 with (0,0) in the corner; the scene is centred on the origin. */
export const HALF = 12;
export const worldX = (x: number) => x - HALF;
export const worldZ = (z: number) => z - HALF;
export const rectCenter = (r: Rect): [number, number] => [worldX(r.x + r.w / 2), worldZ(r.z + r.d / 2)];

/**
 * FLT-56: where the neo labs build, in scene units: on the lawn beyond the south fence, either side of the road out,
 * nearest the gate first (the first one is in the default camera on a phone too). One per lab, in founding order.
 */
export const NEO_LOTS: readonly (readonly [number, number])[] = [
  [4.4, 13.05],
  [-4.4, 13.05],
  [8.4, 13.05],
  [-8.4, 13.05],
];
/** Half the lot's width and depth: the trees there make way once someone builds. */
export const NEO_LOT_HALF: readonly [number, number] = [1.15, 0.95];

/** FLT-56: the auditors' grade plaque, on the verge just east of the gate (scene units). */
export const PLAQUE_AT: readonly [number, number] = [2.3, 12.5];
