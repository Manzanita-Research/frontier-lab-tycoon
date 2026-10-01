import type { EventFromLogic } from "xstate";
import { PATH_PRICE } from "../content/buildings";
import { STAFF } from "../content/staff";
import { ENTRANCE_WARNING, REDUNDANT_HALL, runwayConfirmation } from "../content/guardrails";
import { MAX_ROUNDS, overdraftWarning, runwayNudge } from "../content/bridgeRounds";
import type { Command } from "./commands";
import { economyOf, estimateLedger } from "./economy";
import { runwayMonths } from "./format";
import { guardrailsMachine } from "./machines/guardrails";
import { initialStored, step } from "./machines/run";
import { addToast } from "./news";
import { entranceConnected, tileIndex } from "./pathfind";
import { computePerDay } from "./training";
import { COMPUTE_PER_HALL } from "./constants";
import type { GameState } from "./types";
import { defs } from "./defs";

export type SpendingCommand = Extract<Command, { type: "placeBuilding" | "placePath" | "hire" }>;
export interface PendingConfirm {
  kind: "build" | "hire";
  cost: number;
  runwayAfter: number;
  message: string;
  /** Reissue this exact command with confirmed:true; never store a UI closure in the World. */
  command: SpendingCommand;
}
function feed(s: GameState, event: EventFromLogic<typeof guardrailsMachine>) {
  const stored = s.guardrails ?? initialStored(guardrailsMachine, { pendingConfirm: null, lowRunway: false, gateDisconnected: false });
  const result = step(guardrailsMachine, stored, event);
  s.guardrails = result.stored;
  for (const e of result.effects) addToast(s, e.type === "NUDGE" ? runwayNudgeOf(s) : REDUNDANT_HALL, e.type === "NUDGE" ? "bad" : "neutral", { source: e.type === "NUDGE" ? "economy" : "build", importance: "you" });
}
export const pendingConfirmOf = (s: GameState): PendingConfirm | null => s.guardrails?.context.pendingConfirm ?? null;
export function clearConfirm(s: GameState) { if (pendingConfirmOf(s)) feed(s, { type: "CLEAR" }); }

/** Forecast hires/builds even while paused, including the researchers a Hall will admit. */
export function spendingForecast(s: GameState, c: SpendingCommand): { cost: number; runwayAfter: number | null } {
  let cost = 0;
  let projected = s;
  if (c.type === "placePath") {
    cost = PATH_PRICE;
    const paths = [...s.grid.paths];
    paths[tileIndex(s, c.x, c.z)] = true;
    projected = { ...s, version: s.version + 1, grid: { ...s.grid, paths } };
  }
  if (c.type === "placeBuilding") {
    cost = s.flags[`free:${c.kind}`] !== undefined ? 0 : defs().buildings[c.kind].price;
    const [w, d] = defs().buildings[c.kind].size;
    projected = { ...s, version: s.version + 1, buildings: [...s.buildings, { id: -1, kind: c.kind, x: c.x, z: c.z, w, d, placedTick: s.tick, reliability: 1, broken: false, brokenTick: 0 }] };
  }
  const researchers = Math.max(s.walkers.filter((w) => w.kind === "researcher").length, 3 + 4 * projected.buildings.filter((b) => b.kind === "hall").length);
  const books = estimateLedger(projected, researchers);
  const net = books.net - (c.type === "hire" ? STAFF[c.job].salary : 0);
  return { cost, runwayAfter: runwayMonths(s.cash - cost, net) };
}
export function guardSpending(s: GameState, c: SpendingCommand): boolean {
  if (!c.confirmed && pendingConfirmOf(s)) return false;
  const forecast = spendingForecast(s, c);
  if (!c.confirmed && forecast.runwayAfter !== null && forecast.runwayAfter < 3) {
    feed(s, { type: "REQUEST", pendingConfirm: { kind: c.type === "hire" ? "hire" : "build", cost: forecast.cost, runwayAfter: forecast.runwayAfter, message: runwayConfirmation(forecast.runwayAfter), command: { ...c } } });
    return false;
  }
  if (c.confirmed) clearConfirm(s);
  return true;
}
export function hallBuilt(s: GameState) {
  const halls = s.buildings.filter((b) => b.kind === "hall" && !b.broken).length;
  feed(s, { type: "HALL", redundant: halls > 1 && (halls - 1) * COMPUTE_PER_HALL >= computePerDay(s) && s.compute === 0 });
}
export function observeGuardrails(s: GameState) {
  const runway = runwayMonths(s.cash, estimateLedger(s).net);
  feed(s, { type: "OBSERVE", lowRunway: runway !== null && runway < 2, gateDisconnected: !entranceConnected(s) });
}
/** The low-runway warning says what happens at $0 from here: how many rounds are left, or that it's the bank (FLT-86). */
export const runwayNudgeOf = (s: GameState) => runwayNudge(MAX_ROUNDS - economyOf(s).context.rounds);

export function persistentWarnings(s: GameState): string[] {
  const c = s.guardrails?.context;
  const e = s.economy;
  // Overdrawn, the bank's countdown says it all; otherwise the runway warning while it is short.
  const money = e.value === "overdrawn" ? [overdraftWarning((e.context.overdraftDay ?? s.day) - s.day)] : c?.lowRunway ? [runwayNudgeOf(s)] : [];
  return [...(c?.gateDisconnected ? [ENTRANCE_WARNING] : []), ...money];
}
