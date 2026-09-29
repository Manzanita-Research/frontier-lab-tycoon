// Runs once per game day: pay the bills, collect the API revenue, let hype drift.
import { BUILDINGS } from "../content/buildings";
import { REVENUE_PER_CAPABILITY, RESEARCHER_SALARY, TICKS_PER_DAY } from "./constants";
import { addToast, pushNews } from "./news";
import { isReachable } from "./pathfind";
import type { Rng } from "./rng";
import type { GameState } from "./types";

/** Hype settles at 30, higher for a lab with real capability. */
export function hypeResting(state: GameState): number {
  return Math.min(75, 30 + state.capability * 0.5);
}

export function dailyEconomy(state: GameState, rng: Rng) {
  const researchers = state.walkers.filter((w) => w.kind === "researcher").length;
  let expenses = researchers * RESEARCHER_SALARY;
  let income = 0;
  for (const b of state.buildings) {
    expenses += BUILDINGS[b.kind].upkeepPerDay;
    if (b.kind !== "gateway" || !isReachable(state, b)) continue;
    const amount = Math.round(state.capability * REVENUE_PER_CAPABILITY);
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
  if (state.cash < 0 && state.day - (state.flags.lastBailout ?? -99) > 20) {
    state.cash += 2_000_000;
    state.hype = Math.max(0, state.hype - 5);
    state.flags.lastBailout = state.day;
    pushNews(state, rng, "bailout");
    addToast(state, "Emergency bridge round: +$2M. The board has notes.", "bad");
  }
}
