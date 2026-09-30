// Runs once per game day: pay the bills, collect the API revenue, let hype drift.
import { BUILDINGS } from "../content/buildings";
import { REVENUE_PER_CAPABILITY, RESEARCHER_SALARY, TICKS_PER_DAY } from "./constants";
import { step } from "./machines/run";
import { economyMachine } from "./machines/economy";
import { revenueEffect, upkeepFactor } from "./disasters/driver";
import { addToast, pushNews } from "./news";
import { isReachable } from "./pathfind";
import { addIncident } from "./vibes";
import { revenueFactor } from "./race/finance";
import { payroll } from "./staff";
import { solarHype } from "./race/power";
import type { Rng } from "./rng";
import type { GameState } from "./types";

/** Hype settles at 30, higher for a lab with real capability. */
export function hypeResting(state: GameState): number {
  return Math.min(75, 30 + state.capability * 0.5) + solarHype(state);
}

export function dailyEconomy(state: GameState, rng: Rng) {
  const researchers = state.walkers.filter((w) => w.kind === "researcher").length;
  let expenses = researchers * RESEARCHER_SALARY + payroll(state);
  let income = 0;
  const factor = revenueFactor(state) * revenueEffect(state);
  for (const b of state.buildings) {
    expenses += BUILDINGS[b.kind].upkeepPerDay * upkeepFactor(state, b.kind);
    // A gateway that is down earns nothing (and the status page says all is well).
    if (b.kind !== "gateway" || b.broken || !isReachable(state, b)) continue;
    const amount = Math.round(state.capability * REVENUE_PER_CAPABILITY * factor);
    if (amount <= 0) continue;
    income += amount;
    state.pops.push({ id: state.nextId++, x: b.x + b.w / 2, z: b.z + b.d / 2, amount, tick: state.tick });
  }
  state.cash += income - expenses;
  state.ledger = { income, expenses, net: income - expenses };
  state.pops = state.pops.filter((p) => state.tick - p.tick < 3 * TICKS_PER_DAY);

  const target = hypeResting(state);
  const gap = target - state.hype;
  state.hype = Math.max(0, Math.min(100, state.hype + Math.sign(gap) * Math.min(1, Math.abs(gap))));

  // Going broke is a joke, not a game over: the investors always have a few questions and $2M.
  const { stored, effects } = step(economyMachine, state.economy, { type: "DAY", cash: state.cash, day: state.day });
  state.economy = stored;
  for (const e of effects) {
    state.cash += e.amount;
    state.hype = Math.max(0, state.hype - 5);
    addIncident(state, 0.5);
    pushNews(state, rng, "bailout");
    addToast(state, "Emergency bridge round: +$2M. The board has notes.", "bad");
  }
}
