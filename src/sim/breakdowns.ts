// Breakdowns (FLT-10): every building wears out. Reliability starts at 100% and loses 0.5% a day; each day a building
// breaks with chance (1 - reliability) x utilisation x 0.2. A broken building stops working (no compute, no training,
// no revenue, nobody goes in) and burns until an SRE walks over and fixes it, which puts its reliability back to 90%.
// If nobody does, an emergency contractor turns up after a few days and charges for it.
import { COMPUTE_PER_CLUSTER, COMPUTE_PER_HALL, TICKS_PER_DAY } from "./constants";
import { formatMoney } from "./format";
import { addIncident } from "./vibes";
import { addToast, pushNews } from "./news";
import type { NewsTrigger } from "../content/headlines";
import type { Rng } from "./rng";
import type { Building, GameState } from "./types";
import { pressureReady } from "./tutorial";
import { defs } from "./defs";

export const RELIABILITY_LOSS = 0.005;
export const BREAKDOWN_FACTOR = 0.2;
/** What a repair leaves behind: better than a wreck, worse than new. */
export const REPAIRED_TO = 0.9;
/** A building nobody is using still breaks a little: the floor of utilisation. */
export const MIN_UTILISATION = 0.3;
/** Days a building stays broken before the emergency contractor is called, unless an SRE is on the way. */
export const CONTRACTOR_DAYS = 5;
export const CONTRACTOR_FEE = 60_000;
/** The contractor's fix is a patch job. */
export const CONTRACTOR_REPAIRED_TO = 0.8;

/** Buildings that wear out (not scenery). */
export const wearsOut = (b: Building): boolean => !defs().buildings[b.kind].scenery;

/** How hard a building is being worked, 0 to 1 (never below the floor): clusters by how much the halls ask of them, public buildings by how full they are. */
export function utilisationOf(state: GameState, b: Building, halls: number, clusters: number, inside: Map<number, number>): number {
  switch (b.kind) {
    case "cluster":
      return clamp(clusters > 0 ? (halls * COMPUTE_PER_HALL) / (clusters * COMPUTE_PER_CLUSTER) : 0);
    case "hall":
      return state.training.value === "training" ? 1 : MIN_UTILISATION;
    case "gateway":
      return 0.8;
    case "datacenter":
    case "gas":
    case "solar":
      return 0.7;
    default: {
      const cap = defs().buildings[b.kind].capacity;
      return clamp(cap > 0 ? (inside.get(b.id) ?? 0) / cap : 0);
    }
  }
}

const clamp = (n: number) => Math.min(1, Math.max(MIN_UTILISATION, n));

/** The chance this building breaks today. */
export const breakdownChance = (reliability: number, utilisation: number): number => (1 - reliability) * utilisation * BREAKDOWN_FACTOR;

export const brokenBuildings = (state: GameState): Building[] => state.buildings.filter((b) => b.broken);

/** The state change of a breakdown, with no words: the building is out, the walkers re-plan, the Vibes take a dent. Disasters (FLT-17) use it too. */
export function breakBuilding(state: GameState, b: Building) {
  b.broken = true;
  b.brokenTick = state.tick;
  state.version++;
  state.flags.breakdowns = (state.flags.breakdowns ?? 0) + 1;
  state.flags.lastBreakdown = b.id;
  // Ops trouble, not a safety story: the factions do not count it (FLT-33).
  addIncident(state, 0.12, false);
}

/** Fire in the cluster, an outage at the gateway: the headline, the status page joke, the toast, and the ripple through the crowd. */
function breakDown(state: GameState, rng: Rng, b: Building) {
  breakBuilding(state, b);
  pushNews(state, rng, `breakdown:${b.kind}` as NewsTrigger);
  // The status page is never wrong, because it is never updated.
  if (b.kind === "cluster" || b.kind === "gateway" || b.kind === "hall" || b.kind === "datacenter") pushNews(state, rng, "statusPage");
  addToast(state, `${defs().buildings[b.kind].name} is out of order. ${state.staff.some((s) => s.job === "sre") ? "An SRE is on it." : "Hire an SRE."}`, "bad");
}

/** Put a building back in service. */
export function repairBuilding(state: GameState, b: Building, to = REPAIRED_TO) {
  b.broken = false;
  b.reliability = to;
  state.version++;
  state.flags.repairs = (state.flags.repairs ?? 0) + 1;
}

/** Is an SRE already walking to (or working on) this building? */
const attended = (state: GameState, b: Building) => state.staff.some((s) => s.job === "sre" && s.task === b.id && (s.machine.value === "going" || s.machine.value === "working"));

/** Once a day: everything wears a little, and some of it gives out. */
export function dailyBreakdowns(state: GameState, rng: Rng) {
  if (!pressureReady(state)) return;
  const inside = new Map<number, number>();
  for (const w of state.walkers) if (w.kind !== "agent" && w.machine.value === "inside") inside.set(w.targetId, (inside.get(w.targetId) ?? 0) + 1);
  let halls = 0;
  let clusters = 0;
  for (const b of state.buildings) {
    if (b.kind === "hall") halls++;
    else if (b.kind === "cluster") clusters++;
  }
  for (const b of state.buildings) {
    if (!wearsOut(b)) continue;
    if (b.broken) {
      if (state.tick - b.brokenTick >= CONTRACTOR_DAYS * TICKS_PER_DAY && !attended(state, b)) callContractor(state, rng, b);
      continue;
    }
    b.reliability = Math.max(0, b.reliability - RELIABILITY_LOSS);
    if (rng.chance(breakdownChance(b.reliability, utilisationOf(state, b, halls, clusters, inside)))) breakDown(state, rng, b);
  }
}

/** Nobody came: a contractor fixes it, expensively, and not very well. */
function callContractor(state: GameState, rng: Rng, b: Building) {
  state.cash -= CONTRACTOR_FEE;
  repairBuilding(state, b, CONTRACTOR_REPAIRED_TO);
  pushNews(state, rng, "contractor", { amount: formatMoney(CONTRACTOR_FEE) });
  addToast(state, `A contractor fixed the ${defs().buildings[b.kind].name} for ${formatMoney(CONTRACTOR_FEE)}. It was a wire. An SRE is $4K a day.`, "bad");
}
