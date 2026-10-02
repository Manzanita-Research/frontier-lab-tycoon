import type { BuildingKind } from "../content/buildings";
import { EVENT_COOLDOWN_DAYS } from "../content/events";
import { modelName } from "../content/names";
import type { GameDefinition } from "../mods/game-definition";
import { defs, withDefs } from "./defs";
import { createDisasters } from "./disasters/driver";
import { createGoals } from "./goals";
import { initialStored } from "./machines/run";
import { arcMachine } from "./machines/arc";
import { economyMachine, FRESH_ECONOMY } from "./machines/economy";
import { goalsMachine } from "./machines/goals";
import { trainingMachine } from "./machines/training";
import { coachMachine } from "./machines/coach";
import { progressionMachine } from "./machines/progression";
import { pushNews } from "./news";
import { enableEarnedPacks } from "./progression";
import { newSlop } from "./slop";
import { blankVibes, initialVibes } from "./vibes";
import { createLeapfrog } from "./race/leapfrog/state";
import { createRace } from "./race/state";
import { openingPaths, STUB } from "./opening";
import { createRng } from "./rng";
import { dailyThoughts } from "./thoughts";
import { agentTarget, researchersAtStart, seedWalkers } from "./walkers";
import type { GameState } from "./types";

export const GRID_SIZE = 24;
export const START_CASH = 5_000_000;
const START_CAPABILITY = 10;
/** The garage's first model is a small one (FLT-58): about a minute and a half at 1× on the starting Cluster. */
export const FIRST_RUN_COST = 100;

/**
 * A quiet campus: the gate, an entrance plaza and a short walk from it (FLT-91), compute, three researchers and one agent.
 * `def` is the run's resolved mod definition (FLT-37): rivals, goals, event arcs and names come from it.
 */
/** How a run starts: the garage, a finished campus, or the garage with the pre-FLT-91 stub for test fixtures (see `STUB`). */
export type Opening = "garage" | "campus" | "stub";

export function createInitialState(seed = 1, opening: Opening = "garage", def?: GameDefinition | null): GameState {
  return withDefs(def, () => create(seed, opening));
}

function create(seed: number, opening: Opening): GameState {
  const content = defs();
  const rng = createRng(seed);
  const w = GRID_SIZE;
  const h = GRID_SIZE;
  const paths = new Array<boolean>(w * h).fill(false);
  const path = (x: number, z: number) => {
    paths[z * w + x] = true;
  };
  if (opening !== "campus") for (const [x, z] of opening === "stub" ? STUB : openingPaths()) path(x, z);
  if (opening === "campus") {
    // The finished campus keeps the pre-FLT-91 approach: its spine runs straight to the gate.
    path(12, 22);
    for (let z = 10; z <= 22; z++) path(11, z);
    for (let x = 6; x <= 17; x++) path(x, 16);
    for (let x = 8; x <= 15; x++) path(x, 10);
  }

  const state: GameState = {
    seed,
    rngState: rng.state(),
    tick: 0,
    day: 0,
    cash: START_CASH,
    capability: START_CAPABILITY,
    compute: 0,
    hype: 30,
    vibes: blankVibes(),
    labName: rng.pick(content.names.LAB_NAMES),
    grid: { w, h, paths },
    gate: { x: 11, z: 23, w: 2, d: 1 },
    buildings: [],
    walkers: [],
    economy: initialStored(economyMachine, FRESH_ECONOMY),
    training: { ...initialStored(trainingMachine, { run: 1, progress: 0, cost: opening !== "campus" ? FIRST_RUN_COST : 300, name: modelName(1, rng, 0) }), value: "idle" },
    models: [],
    news: [],
    thoughts: [],
    pops: [],
    toasts: [],
    ledger: { income: 0, expenses: 0, net: 0 },
    version: 1,
    nextId: 1,
    // The old generic "rival" headlines are retired: the six rival labs of the Race (sim/race) make the real news.
    flags: { nextFiller: 3, nextRival: 1e9, walkerPathCount: paths.filter(Boolean).length },
    recentThoughts: [],
    agentBonus: 0,
    waterDiscourse: 0,
    goals: initialStored(goalsMachine, { goals: createGoals(), outcomeDay: null }),
    race: createRace({ capability: START_CAPABILITY, hype: 30 }),
    leapfrog: createLeapfrog(),
    slop: newSlop(w, h),
    staff: [],
    coach: initialStored(coachMachine, undefined),
    progression: initialStored(progressionMachine, undefined),
    unlockCards: [],
    disasters: createDisasters(seed),
    arcs: Object.fromEntries(
      content.events.map((def) => [def.id, initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? EVENT_COOLDOWN_DAYS, openedDay: null })]),
    ),
  };

  const put = (kind: BuildingKind, x: number, z: number) => {
    const [bw, bd] = content.buildings[kind].size;
    state.buildings.push({ id: state.nextId++, kind, x, z, w: bw, d: bd, placedTick: 0, reliability: 1, broken: false, brokenTick: 0 });
    state.flags[`built:${kind}`] = 0;
  };
  if (opening === "campus") {
    put("cluster", 8, 11); put("hall", 12, 11); put("kombucha", 12, 19);
    state.progression = { value: "complete", context: { level: 5 } };
    state.coach = { value: "skipped", context: { index: 0, elapsed: 0 } };
    state.flags.coachBuildOpened = 0; state.flags.started = 0;
    state.training = { ...state.training, value: "training", context: { ...state.training.context, progress: 120 } };
  } else put("cluster", 9, 19);

  seedWalkers(state, "researcher", opening === "campus" ? 11 : researchersAtStart(state), rng);
  seedWalkers(state, "agent", opening === "campus" ? 11 : agentTarget(state), rng);

  if (opening === "campus") seedWalkers(state, "visitor", 18, rng);
  state.vibes = initialVibes(state);

  pushNews(state, rng, "start");
  if (opening === "campus") pushNews(state, rng, "runStarted", { model: state.training.context.name });
  for (let i = 0; i < 3; i++) dailyThoughts(state, rng, true);

  state.rngState = rng.state();
  // Systems the run starts with already earned (a campus, or a first rung a mod gave one) wake their packs now.
  enableEarnedPacks(state);
  return state;
}
