// Small verbs on the Leapfrog state that both the race's weekly cycle and the launch driver need, kept apart from the
// driver so the race can call them without a circular import.
import { LEAPFROG } from "../../../content/leapfrog";
import { type RivalId, YOU } from "../../../content/rivals";
import { step } from "../../machines/run";
import type { GameState } from "../../types";
import type { PendingLaunch } from "./state";
import { voiceMachine } from "./voice";
import { defs } from "../../defs";

const R = LEAPFROG.rules;

/** Everyone on the leaderboard: you first, then the rivals in Arena order of definition. */
export const labIds = (state: GameState): string[] => [YOU, ...state.race.rivals.map((r) => r.context.id)];

export const rivalOf = (state: GameState, id: string) => state.race.rivals.find((r) => r.context.id === id);

/** Does the lab have a product to score? Super Super AI has none, so it never appears on a benchmark. */
export const hasProduct = (id: string): boolean => id === YOU || defs().rivalById[id as RivalId]?.models != null;

export const capOf = (state: GameState, id: string): number => (id === YOU ? state.capability : (rivalOf(state, id)?.context.capability ?? 0));
export const hypeOf = (state: GameState, id: string): number => (id === YOU ? state.hype : (rivalOf(state, id)?.context.hype ?? 0));
export const nameOf = (state: GameState, id: string): string => (id === YOU ? state.labName : (defs().rivalById[id as RivalId]?.name ?? id));

/**
 * Push a lab's share of the news cycle up (or, negative, down). A launch from a lab everyone is already watching is
 * louder: a positive push is scaled by the lab's hype.
 */
export function pushVoice(state: GameState, lab: string, amount: number) {
  if (!state.leapfrog.enabled) return;
  const scaled = amount > 0 ? amount * (0.75 + hypeOf(state, lab) / 200) * (lab === YOU ? 1 - R.trust.hypeWeight + R.trust.hypeWeight * (state.leapfrog.trust / 100) : 1) : amount;
  state.leapfrog.voice = step(voiceMachine, state.leapfrog.voice, { type: "PUSH", lab, amount: scaled }).stored;
}

/** A rival finished training a model that the calendar will launch: it joins the queue (a newer one adds to the older). */
export function queueFinished(state: GameState, e: { id: string; model: string; gain: number; open: boolean; hype: number }) {
  // A point release already paid part of this out: only the rest is news.
  const claims = state.leapfrog.labs[e.id];
  if (claims && claims.advance > 0) {
    const used = Math.min(claims.advance, e.gain);
    claims.advance -= used;
    e = { ...e, gain: e.gain - used };
  }
  const q = state.leapfrog.queue;
  const waiting = q.find((p) => p.id === e.id);
  if (waiting) {
    waiting.gain += e.gain;
    waiting.hype = Math.max(waiting.hype, e.hype);
    waiting.model = e.model;
    waiting.open = e.open;
    return;
  }
  const pending: PendingLaunch = { id: e.id, model: e.model, gain: e.gain, hype: e.hype, open: e.open, since: state.day };
  q.push(pending);
}

/** Trust moves by `amount` (0 to 100). */
export function shiftTrust(state: GameState, amount: number) {
  if (!state.leapfrog.enabled) return;
  state.leapfrog.trust = Math.max(0, Math.min(100, state.leapfrog.trust + amount));
}

/** A full release after a preview: what the preview already paid out comes off, so only the rest of the capability lands. */
export function settlePreview(state: GameState, gain: number): number {
  const lf = state.leapfrog;
  if (!lf.enabled || lf.credit <= 0) return gain;
  const owed = Math.min(gain, lf.credit);
  lf.credit -= owed;
  return gain - owed;
}
