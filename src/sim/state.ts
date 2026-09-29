import { BUILDINGS, type BuildingKind } from "../content/buildings";
import { LAB_NAMES, modelName } from "../content/names";
import { createGoals } from "./goals";
import { pushNews } from "./news";
import { createRng } from "./rng";
import { dailyThoughts } from "./thoughts";
import { agentTarget, researcherTarget, seedWalkers } from "./walkers";
import type { GameState } from "./types";

export const GRID_SIZE = 24;
export const START_CASH = 5_000_000;
const START_CAPABILITY = 10;
const START_VISITORS = 10;

/** A living campus at tick 0: gate, paths, one of each core building, a run 40% done, and a crowd mid-stride. */
export function createInitialState(seed = 1): GameState {
  const rng = createRng(seed);
  const w = GRID_SIZE;
  const h = GRID_SIZE;
  const paths = new Array<boolean>(w * h).fill(false);
  const path = (x: number, z: number) => {
    paths[z * w + x] = true;
  };
  for (let z = 10; z <= 22; z++) path(11, z);
  path(12, 22);
  for (let x = 6; x <= 17; x++) path(x, 16);
  for (let x = 8; x <= 15; x++) path(x, 10);

  const state: GameState = {
    seed,
    rngState: rng.state(),
    tick: 0,
    day: 0,
    cash: START_CASH,
    capability: START_CAPABILITY,
    compute: 0,
    hype: 30,
    labName: rng.pick(LAB_NAMES),
    grid: { w, h, paths },
    gate: { x: 11, z: 23, w: 2, d: 1 },
    buildings: [],
    walkers: [],
    training: { run: 1, progress: 120, cost: 300, name: modelName(1, rng, 0) },
    models: [],
    news: [],
    thoughts: [],
    pops: [],
    toasts: [],
    ledger: { income: 0, expenses: 0, net: 0 },
    version: 1,
    nextId: 1,
    flags: { nextFiller: 3, nextRival: 14 },
    recentThoughts: [],
    agentBonus: 0,
    waterDiscourse: 0,
    goals: createGoals(),
    outcome: "playing",
    event: null,
  };

  const put = (kind: BuildingKind, x: number, z: number) => {
    const [bw, bd] = BUILDINGS[kind].size;
    state.buildings.push({ id: state.nextId++, kind, x, z, w: bw, d: bd, placedTick: 0 });
    state.flags[`built:${kind}`] = 0;
  };
  put("cluster", 8, 11);
  put("hall", 12, 11);
  // Down front, so a gateway dropped beside the spine never hides it from the default camera.
  put("kombucha", 12, 19);

  seedWalkers(state, "researcher", researcherTarget(state), rng);
  seedWalkers(state, "agent", agentTarget(state), rng);
  seedWalkers(state, "visitor", START_VISITORS, rng);

  pushNews(state, rng, "start");
  pushNews(state, rng, "runStarted", { model: state.training.name });
  for (let i = 0; i < 3; i++) dailyThoughts(state, rng, true);

  state.rngState = rng.state();
  return state;
}
