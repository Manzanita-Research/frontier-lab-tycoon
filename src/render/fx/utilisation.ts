// How hard the compute clusters are working, read off the World (never written): halls ask for compute, clusters
// supply it, and a hall that can't get what it wants is "over capacity". Drives the cluster fans and the smoke.
import { COMPUTE_PER_CLUSTER, COMPUTE_PER_HALL } from "../../sim/constants";
import type { GameState } from "../../sim/types";

export interface Load {
  clusters: number;
  halls: number;
  supply: number;
  demand: number;
  /** demand / supply, 0 when there's no demand and no cluster to blame. */
  util: number;
  /** The halls want more than the clusters make and the stockpile can't cover the gap: the racks are cooking. */
  over: boolean;
}

export function loadOf(world: GameState): Load {
  let clusters = 0;
  let halls = 0;
  for (const b of world.buildings) {
    if (b.kind === "cluster") clusters++;
    else if (b.kind === "hall") halls++;
  }
  const supply = clusters * COMPUTE_PER_CLUSTER;
  const demand = halls * COMPUTE_PER_HALL;
  const util = supply > 0 ? demand / supply : demand > 0 ? 2 : 0;
  return { clusters, halls, supply, demand, util, over: clusters > 0 && demand > supply && world.compute < demand };
}

/** Fan speed in radians per second: a lazy 1.5 when idle up to a furious 15 when the halls are starving the racks. */
export const fanSpeed = (load: Load) => 1.5 + 9 * Math.min(1.5, load.util);

let cachedTick = -1;
let cachedWorld: GameState | null = null;
let cachedVersion = -1;
let cached: Load | null = null;

/** `loadOf`, memoised per tick: every cluster model asks each frame. */
export function currentLoad(world: GameState): Load {
  if (cached && cachedWorld === world && cachedTick === world.tick && cachedVersion === world.version) return cached;
  cachedWorld = world;
  cachedTick = world.tick;
  cachedVersion = world.version;
  cached = loadOf(world);
  return cached;
}
