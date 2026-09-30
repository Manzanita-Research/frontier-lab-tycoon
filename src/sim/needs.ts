// Needs: how they drain, how buildings refill them, and how they add up to happiness. Plain arithmetic on a walker;
// what to do about a need (go somewhere, get sad, quit) is the machines' and the driver's business.
import type { BuildingDef } from "../content/buildings";
import { NEEDS, NEEDS_BY_KIND, type NeedKey } from "../content/needs";
import type { MoodLevel } from "./machines/mood";
import { MESS_UNHAPPINESS } from "./slop";
import type { Walker } from "./types";

/** Per tick, at 20 ticks a game day. */
export const ENERGY_DRAIN = 0.0025;
export const FOCUS_DRAIN = 0.0016;
export const FOMO_DECAY = 0.0015;
export const PATIENCE_DRAIN = 0.0022;
/** Waiting in a queue wears patience down this many times faster. */
export const QUEUE_PATIENCE_FACTOR = 3;
export const DRIFT_BASE = 0.0005;
/** Drift creeps up a little faster the more capable the agents are. */
export const DRIFT_PER_CAPABILITY = 0.000004;
/** A rival shipping gives every researcher this much fomo. */
export const RIVAL_FOMO = 0.45;
/** A building has to give at least this much of a need to be worth a special trip for it. */
export const MIN_GAIN = 0.3;

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Called once per tick for every walker that isn't a protester. */
export function tickNeeds(w: Walker, capability: number) {
  switch (w.kind) {
    case "researcher":
      w.energy = Math.max(0, w.energy - ENERGY_DRAIN);
      w.focus = Math.max(0, w.focus - FOCUS_DRAIN);
      if (w.fomo > 0) w.fomo = Math.max(0, w.fomo - FOMO_DECAY);
      break;
    case "visitor":
      w.patience = Math.max(0, w.patience - PATIENCE_DRAIN * (w.machine.value === "queuing" ? QUEUE_PATIENCE_FACTOR : 1));
      break;
    case "agent":
      if (w.drift < 1) w.drift = Math.min(1, w.drift + DRIFT_BASE + capability * DRIFT_PER_CAPABILITY);
      break;
  }
}

/** Happiness, 0 to 1, from the needs: researchers 40% energy, 35% focus, 25% calm; visitors half patience, half wonder. Fresh from a puddle of slop, a little less. */
export function happinessOf(w: Walker): number {
  const slop = w.mess > 0 ? MESS_UNHAPPINESS : 0;
  switch (w.kind) {
    case "researcher":
      return Math.max(0, 0.4 * w.energy + 0.35 * w.focus + 0.25 * (1 - w.fomo) - slop);
    case "visitor":
      return Math.max(0, 0.5 * w.patience + 0.5 * w.impressed - slop);
    case "agent":
      return 1 - w.drift;
    default:
      return 0.5;
  }
}

/** How badly a need wants attention: 0 (fine) to 1 (desperate), whichever end of the bar is bad. */
export function urgencyOf(w: Walker, need: NeedKey): number {
  return NEEDS[need].goodWhenHigh ? 1 - w[need] : w[need];
}

/** The need shouting loudest, with its urgency. Null for walkers with no needs. */
export function mostUrgent(w: Walker): { need: NeedKey; urgency: number } | null {
  let best: NeedKey | null = null;
  let bestU = -1;
  for (const need of NEEDS_BY_KIND[w.kind]) {
    const u = urgencyOf(w, need);
    if (u > bestU) {
      bestU = u;
      best = need;
    }
  }
  return best ? { need: best, urgency: bestU } : null;
}

/** How much one stay at `def` helps `w` with `need`. */
export const gainOf = (def: BuildingDef, w: Walker, need: NeedKey): number => def.serves[w.kind]?.[need] ?? 0;

/** Refill from a stay: `scale` is 1 for a normal stay, more or less for a demo that went well or badly. */
export function applyServes(w: Walker, def: BuildingDef, scale = 1) {
  const serves = def.serves[w.kind];
  if (!serves) return;
  for (const need of NEEDS_BY_KIND[w.kind]) {
    const amount = serves[need];
    if (!amount) continue;
    w[need] = clamp01(NEEDS[need].goodWhenHigh ? w[need] + amount * scale : w[need] - amount * scale);
  }
  if (w.lost && gainOf(def, w, w.lost) >= MIN_GAIN) w.lost = "";
}

/** Slump under 0.4 (out again above 0.5), miserable under 0.2. Researchers and visitors only; the rest stay content. */
export function moodFor(h: number, now: MoodLevel): MoodLevel {
  if (h < 0.2) return "miserable";
  if (h < 0.4) return "slumped";
  if (h >= 0.5) return "content";
  return now === "resigned" || now === "miserable" ? "slumped" : now;
}
