// Vibes, 0 to 999: the park rating. Weights: average happiness 40%, visitors impressed 20%, cleanliness 15% (a stub
// at 1 until FLT-10), hype 15%, and the last 10% is what is left after the incident and protest penalties. Recalculated
// once a game day and eased toward, so one bad afternoon dents it rather than crashes it.
import type { GameState, Vibes } from "./types";
import { happinessOf } from "./needs";

export const VIBES_MAX = 999;
export const WEIGHTS = { happiness: 0.4, impressed: 0.2, cleanliness: 0.15, hype: 0.15, penalties: 0.1 } as const;
/** The share of the gap to the target that closes each day. */
export const VIBES_EASE = 0.25;
/** Incident points fade by this factor each day. */
export const INCIDENT_FADE = 0.9;
/** This many protesters at the gate is the worst penalty. */
export const PROTEST_WORST = 25;
/** Vibes above this and researchers apply to join (if a hall has room). */
export const APPLICANT_VIBES = 350;
/** What the summary reads as neutral when nobody of that kind is around. */
const NEUTRAL_HAPPINESS = 0.6;
const NEUTRAL_IMPRESSED = 0.4;

/** The five inputs for the state as it is right now, each 0 to 1 (penalties: 0 none, 1 worst). */
export function readVibes(state: GameState) {
  let happy = 0;
  let people = 0;
  let impressed = 0;
  let visitors = 0;
  let protesters = 0;
  for (const w of state.walkers) {
    if (w.kind === "researcher") {
      happy += happinessOf(w);
      people++;
    } else if (w.kind === "visitor") {
      happy += happinessOf(w);
      people++;
      impressed += w.impressed;
      visitors++;
    } else if (w.kind === "protester") protesters++;
  }
  return {
    happiness: people > 0 ? happy / people : NEUTRAL_HAPPINESS,
    impressed: visitors > 0 ? impressed / visitors : NEUTRAL_IMPRESSED,
    // Nobody makes a mess yet: FLT-10 (janitor bots, slop) turns this into a real number.
    cleanliness: 1,
    hype: state.hype / 100,
    incident: Math.min(1, state.vibes.incidents),
    protest: Math.min(1, protesters / PROTEST_WORST),
  };
}

export function vibesTarget(p: Pick<Vibes, "happiness" | "impressed" | "cleanliness" | "hype" | "incident" | "protest">): number {
  const penalty = (p.incident + p.protest) / 2;
  const share =
    WEIGHTS.happiness * p.happiness +
    WEIGHTS.impressed * p.impressed +
    WEIGHTS.cleanliness * p.cleanliness +
    WEIGHTS.hype * p.hype +
    WEIGHTS.penalties * (1 - penalty);
  return Math.max(0, Math.min(VIBES_MAX, share * VIBES_MAX));
}

/** A fresh reading at exactly the target (a new game starts with no easing to do). */
export function initialVibes(state: GameState): Vibes {
  const parts = readVibes(state);
  const target = vibesTarget(parts);
  return { ...parts, value: target, target, delta: 0, incidents: state.vibes.incidents };
}

/** A placeholder for the moment before there is a crowd to read. */
export const blankVibes = (): Vibes => ({ value: 500, target: 500, delta: 0, happiness: 0.6, impressed: 0.4, cleanliness: 1, hype: 0.3, incident: 0, protest: 0, incidents: 0 });

/** Something went wrong in front of everyone: a resignation, a demo flop, a bailout. */
export function addIncident(state: GameState, amount: number) {
  state.vibes.incidents += amount;
}

/** Once a day: fade the incidents, read the room, ease toward it. */
export function dailyVibes(state: GameState) {
  const v = state.vibes;
  v.incidents *= INCIDENT_FADE;
  const parts = readVibes(state);
  const target = vibesTarget(parts);
  const value = v.value + (target - v.value) * VIBES_EASE;
  state.vibes = { ...parts, value, target, delta: value - v.value, incidents: v.incidents };
}

/** ▲ climbing, ▼ falling, ▬ steady (a point a day either way is worth an arrow). */
export function trendOf(v: Vibes): "up" | "down" | "flat" {
  return v.delta > 1 ? "up" : v.delta < -1 ? "down" : "flat";
}

/** Visitors arrive and stay in proportion to Vibes. */
export const visitorCapFor = (vibes: number) => Math.round(20 + vibes * 0.08);
export const visitorChanceFor = (vibes: number) => 0.01 + vibes * 0.00012;
