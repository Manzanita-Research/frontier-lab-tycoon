// Runs once per game day: pay the bills, collect the API revenue, let hype drift.
import { REVENUE_PER_CAPABILITY, RESEARCHER_SALARY, TICKS_PER_DAY } from "./constants";
import { initialStored, step } from "./machines/run";
import { economyMachine, FRESH_ECONOMY, type EconomyStored } from "./machines/economy";
import { arcMachine } from "./machines/arc";
import { BRIDGE_PICK, BRIDGE_ROUNDS, MAX_ROUNDS, OVERDRAFT_CARD, RECOVERED_TOAST, OVERDRAWN_TOAST, bridgeCardId, roundsLeftText } from "../content/bridgeRounds";
import { openEventOf } from "./events";
import { fillTemplate } from "./format";
import { revenueEffect, upkeepFactor } from "./disasters/driver";
import { addNews, addToast } from "./news";
import { isReachable } from "./pathfind";
import { addIncident } from "./vibes";
import { revenueFactor } from "./race/finance";
import { payroll } from "./staff";
import { solarHype } from "./race/power";
import type { Rng } from "./rng";
import type { GameState, Ledger } from "./types";
import { defs } from "./defs";
import { auraHype } from "./birdapp/effects";

/** Hype settles at 30, higher for a lab with real capability. */
export function hypeResting(state: GameState): number {
  return Math.min(75, 30 + state.capability * 0.5) + solarHype(state) + auraHype(state);
}

/** Shared books for the daily close and the pre-purchase forecast; never uses yesterday's stale ledger. */
export function estimateLedger(state: GameState, researchers = state.walkers.filter((w) => w.kind === "researcher").length): Ledger {
  let expenses = researchers * RESEARCHER_SALARY + payroll(state);
  let income = 0;
  const factor = revenueFactor(state) * revenueEffect(state) * stakeFactor(state);
  for (const b of state.buildings) {
    expenses += defs().buildings[b.kind].upkeepPerDay * upkeepFactor(state, b.kind);
    // A gateway that is down earns nothing (and the status page says all is well).
    if (b.kind !== "gateway" || b.broken || !isReachable(state, b)) continue;
    const amount = Math.round(state.capability * REVENUE_PER_CAPABILITY * factor);
    if (amount <= 0) continue;
    income += amount;
  }
  return { income, expenses, net: income - expenses };
}

export function dailyEconomy(state: GameState, _rng: Rng) {
  const { income, expenses } = estimateLedger(state);
  const factor = revenueFactor(state) * stakeFactor(state);
  for (const b of state.buildings) if (b.kind === "gateway" && !b.broken && isReachable(state, b)) {
    const amount = Math.round(state.capability * REVENUE_PER_CAPABILITY * factor);
    if (amount > 0) state.pops.push({ id: state.nextId++, x: b.x + b.w / 2, z: b.z + b.d / 2, amount, tick: state.tick });
  }
  state.cash += income - expenses;
  state.ledger = { income, expenses, net: income - expenses };
  if (income > 0) state.flags.firstRevenue ??= state.day;
  state.pops = state.pops.filter((p) => state.tick - p.tick < 3 * TICKS_PER_DAY);

  const target = hypeResting(state);
  const gap = target - state.hype;
  state.hype = Math.max(0, Math.min(100, state.hype + Math.sign(gap) * Math.min(1, Math.abs(gap))));

  // Below $0 the board offers a round (a card), three times, each dearer; then the bank's 30 days (FLT-86).
  const { stored, effects } = step(economyMachine, economyOf(state), { type: "DAY", cash: state.cash, day: state.day });
  state.economy = stored;
  for (const e of effects) {
    if (e.type === "OFFER") state.flags[`offer:${bridgeCardId(e.round)}`] = state.day;
    else if (e.type === "WITHDRAWN") {
      for (let n = 1; n <= MAX_ROUNDS; n++) delete state.flags[`offer:${bridgeCardId(n)}`];
      addToast(state, "Back above $0 before the board could wire anything. They'll keep the term sheet warm.", "good", { source: "economy", importance: "you" });
    } else if (e.type === "OVERDRAWN") {
      state.flags[`offer:${OVERDRAFT_CARD}`] = state.day;
      addToast(state, OVERDRAWN_TOAST, "bad", { source: "economy", importance: "you" });
    } else if (e.type === "RECOVERED") {
      delete state.flags[`offer:${OVERDRAFT_CARD}`];
      addToast(state, RECOVERED_TOAST, "good", { source: "economy", importance: "you" });
    } else if (e.type === "BANKRUPT") addNews(state, fillTemplate("{lab}'s bank 'regretfully' calls Macrohard", { lab: state.labName }), "bad");
  }
  openMoneyCard(state);
}

/** The economy machine, with a save from before FLT-86 brought up to date: its rounds were unlimited and had no terms. */
export function economyOf(state: GameState): EconomyStored {
  const e = state.economy;
  if (e.context.rounds !== undefined) return e;
  const old = e.context as { lastBailout: number | null };
  const was = e.value as string;
  const value = was === "bailout" ? "funded" : was === "bankrupt" ? "bankrupt" : "solvent";
  return { value, context: { ...FRESH_ECONOMY, lastBailout: old.lastBailout, rounds: old.lastBailout !== null ? 1 : 0 } } as EconomyStored;
}

/** The share of revenue still the lab's own after equity rounds (1 for a lab that never sold any). */
export function stakeFactor(state: GameState): number {
  const stake = state.economy.context.stake;
  return stake === undefined || stake >= 100 ? 1 : stake / 100;
}

const armed = (id: string) => initialStored(arcMachine, { choices: defs().eventById(id)!.choices.length, cooldownDays: 0, openedDay: null });

/** The round on the table, or the bank's letter, takes the screen at once if nothing else has it: money doesn't wait in line. */
function openMoneyCard(state: GameState) {
  if (openEventOf(state)) return;
  const e = state.economy;
  const id = e.value === "offered" ? bridgeCardId(e.context.rounds + 1) : e.value === "overdrawn" && state.flags[`offer:${OVERDRAFT_CARD}`] !== undefined ? OVERDRAFT_CARD : null;
  if (!id || !defs().eventById(id)) return;
  state.arcs[id] = step(arcMachine, armed(id), { type: "DAY", day: state.day, ready: true, slotFree: true, pace: 1 }).stored;
}

const EQUITY = `${BRIDGE_PICK}equity`;
const DIGNITY = `${BRIDGE_PICK}dignity`;

/** The answer to a round's card: sign it, wire the money in, book the terms. Runs paused or not, like the packs' appliers. */
export function applyBridgeChoices(state: GameState) {
  const flags = state.flags;
  if (flags[EQUITY] === undefined && flags[DIGNITY] === undefined) return;
  const equity = flags[EQUITY] !== undefined;
  delete flags[EQUITY];
  delete flags[DIGNITY];
  const econ = economyOf(state);
  if (econ.value !== "offered") return;
  const round = BRIDGE_ROUNDS[econ.context.rounds]!;
  const { stored, effects } = step(economyMachine, econ, { type: "SIGNED", day: state.day, equity: equity ? round.equity : 0 });
  state.economy = stored;
  for (const e of effects) {
    if (e.type !== "FUNDED") continue;
    state.cash += round.amount;
    if (!equity) {
      state.hype = Math.max(0, state.hype - round.hype);
      addIncident(state, round.incident);
    }
    addNews(state, fillTemplate(round.news, { lab: state.labName }), "bad");
    addToast(state, fillTemplate(round.signed, { left: roundsLeftText(MAX_ROUNDS - e.round) }), "bad", { source: "economy", importance: "you" });
  }
}
