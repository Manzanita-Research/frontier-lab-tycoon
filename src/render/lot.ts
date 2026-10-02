// FLT-98: dressing for the empty lot. Survey stakes with little flags say what's coming where ("Future site of:
// Training Hall"), and a food truck is parked on the verge by the gate. Decoration only, like FLT-96's plaza props:
// nothing here is in the World, so the goldens and determinism never see it, nothing takes a tile, nothing takes a tap.

import { Atom } from "effect/unstable/reactivity";
import type { BuildingKind, Rect } from "../sim/types";

export interface Stake {
  id: string;
  /** The tile it is knocked into (the sim's x, z). Pave or build there and it is pulled up. */
  tile: readonly [number, number];
  /** Where it stands, in tile units: the sign's middle. */
  at: readonly [number, number];
  /**
   * The building it promises. Once there are this many anywhere, the promise is kept (if somewhere else) and the stake
   * comes out. The garage starts with one Cluster, so the Cluster's stake waits for a second.
   */
  until?: { kind: BuildingKind; count: number };
}

/** Turned to face the camera, which looks in from the gate's right (+x, +z). */
export const STAKE_YAW = Math.PI / 4;
/** Half its footprint along x and z once turned (the sign, its legs and the flag's stake). The props test checks it. */
export const STAKE_HALF = 0.34;
/** How high the sign's middle is: the hover hint is pinned above it. */
export const STAKE_SIGN_Y = 0.5;

/**
 * Three stakes where the coach (and the journey's player) put the first Hall, the second Cluster and the first Gateway,
 * so the lot quietly hints; two jokes out on the open lawn, beyond where protesters picket. None is on the walk, the
 * plaza, or the tiles the coach asks you to pave (x 11, z 15 to 18).
 */
export const STAKES: readonly Stake[] = [
  { id: "hall", tile: [13, 17], at: [13.5, 17.5], until: { kind: "hall", count: 1 } },
  { id: "cluster", tile: [9, 16], at: [9.5, 16.5], until: { kind: "cluster", count: 2 } },
  { id: "gateway", tile: [12, 20], at: [12.5, 20.5], until: { kind: "gateway", count: 1 } },
  { id: "bigger", tile: [18, 13], at: [18.5, 13.5] },
  { id: "ethics", tile: [5, 14], at: [5.5, 14.5] },
];

interface Ground {
  grid: { w: number; h: number; paths: readonly boolean[] };
  buildings: readonly (Rect & { kind: BuildingKind })[];
  gate: Rect;
}

const inside = (r: Rect, x: number, z: number) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;

/** The stakes still in the ground: nothing paved or built on their tile, and their promise not yet kept. */
export function standingStakes(g: Ground): Stake[] {
  return STAKES.filter((s) => {
    const [x, z] = s.tile;
    if (g.grid.paths[z * g.grid.w + x] || inside(g.gate, x, z) || g.buildings.some((b) => inside(b, x, z))) return false;
    return !s.until || g.buildings.filter((b) => b.kind === s.until!.kind).length < s.until.count;
  });
}

/** The stake the mouse is over (desktop only), or null: `ui/WorldOverlay.tsx` shows its full text. */
export const stakeHoverAtom = Atom.keepAlive(Atom.make<string | null>(null));

/**
 * The food truck, in scene units: parked on the verge east of the road out, nose to the east, its hatch and awning
 * towards the camera. Clear of the road (everyone leaving, and the auditors queueing, walk down its middle), the welcome
 * sign, the auditors' plaque and the neo labs' lots; the trees and bushes under it are never planted.
 */
export const TRUCK = { at: [2.1, 13.38] as const, yaw: 0, half: [0.84, 0.48] as const };
