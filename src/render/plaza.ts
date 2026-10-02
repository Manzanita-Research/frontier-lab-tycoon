// FLT-96: the plaza's starter props (benches, planters, the welcome sign). Decoration only: nothing here is in the
// World, so the goldens and determinism never see them. Each prop stands on the verge side of a plaza tile, as the
// lamps do, outside the lane people walk down the middle of it, and makes way (is not drawn) once you pave or build
// across its back, where people would otherwise walk into it on their way in.

import type { Rect } from "../sim/types";

export type PropKind = "bench" | "planter" | "sign";

export interface PlazaProp {
  id: string;
  kind: PropKind;
  /** Where it stands, in tile units (the sim's x, z; a tile's middle is x + 0.5). */
  at: readonly [number, number];
  /** Turned this far about y: 0 faces +z (south, the gate's side), π faces north into the lot. */
  yaw: number;
  /** Its footprint on the ground, half-extents along x and z. The props test checks the model fits in it. */
  half: readonly [number, number];
  /** The plaza tiles it stands on; none for the sign, which stands on the verge outside the fence, off the board. */
  on: readonly (readonly [number, number])[];
  /** The side it backs onto: across it there must be nothing anyone walks to, or it makes way. */
  back: readonly [number, number];
}

const SOUTH = [0, 1] as const;
const NORTH = [0, -1] as const;
const EAST = [1, 0] as const;

/**
 * Along the fence a bench, a planter and a bench, looking into the plaza. On its far side a bench, beside the lamp at
 * (14, 22), looking back at the gate (and the camera), and at its east end a planter. The lamps and the Security guard's
 * beat (the fence row, and the gate's side of row 22) are left clear: the props test checks it. The welcome sign stands
 * by the road out, just west of the gate, where it is never in anyone's way and never has to move.
 */
export const PLAZA_PROPS: readonly PlazaProp[] = [
  { id: "bench-fence-w", kind: "bench", at: [14.5, 23.87], yaw: Math.PI, half: [0.32, 0.085], on: [[14, 23]], back: SOUTH },
  { id: "planter-fence", kind: "planter", at: [15.5, 23.87], yaw: 0, half: [0.27, 0.085], on: [[15, 23]], back: SOUTH },
  { id: "bench-fence-e", kind: "bench", at: [16.5, 23.87], yaw: Math.PI, half: [0.32, 0.085], on: [[16, 23]], back: SOUTH },
  { id: "bench-north", kind: "bench", at: [13.5, 22.13], yaw: 0, half: [0.32, 0.085], on: [[13, 22]], back: NORTH },
  { id: "planter-east", kind: "planter", at: [16.87, 22.55], yaw: Math.PI / 2, half: [0.085, 0.27], on: [[16, 22]], back: EAST },
  { id: "sign", kind: "sign", at: [10.2, 24.85], yaw: 0, half: [0.66, 0.05], on: [], back: NORTH },
];

interface Ground {
  grid: { w: number; h: number; paths: readonly boolean[] };
  buildings: readonly Rect[];
  gate: Rect;
}

const inside = (r: Rect, x: number, z: number) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;

/** Is anything there that people walk onto or into: a path, a building or the gate? Off the board is clear. */
function taken(g: Ground, x: number, z: number) {
  if (x < 0 || z < 0 || x >= g.grid.w || z >= g.grid.h) return false;
  return !!g.grid.paths[z * g.grid.w + x] || inside(g.gate, x, z) || g.buildings.some((b) => inside(b, x, z));
}

/** The props still standing: every tile under one is still paved, and nothing has gone in across its back. */
export function plazaProps(g: Ground): PlazaProp[] {
  return PLAZA_PROPS.filter((p) => p.on.every(([x, z]) => g.grid.paths[z * g.grid.w + x] && !taken(g, x + p.back[0], z + p.back[1])));
}
