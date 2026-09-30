// Staging for `?disaster=<id>` (the dev hook and the screenshot script): the game is set up a moment before something is worth
// looking at. Pure sim and deterministic, like sim/opsDemo.ts; the game itself never uses it.
import type { Command } from "../commands";
import { openEventOf } from "../events";
import { applyNow, tick } from "../tick";
import type { GameState } from "../types";
import { triggerDisaster } from "./driver";
import { defs } from "../defs";

/** The command that answers the open card with choice `pick` (or nothing when no card is open). */
function answerWith(s: GameState, pick: number): Command[] {
  const open = openEventOf(s);
  if (!open) return [];
  return [{ type: "chooseEvent", eventId: open.id, choiceIndex: Math.min(pick, defs().eventById(open.id)!.choices.length - 1) }];
}

/**
 * Give an empty lab a crew (three Security, two SREs: the ones a disaster pulls off their posts), trigger `id`, and run
 * `ticks` ticks. Cards stay open (the game is paused on them, which is what a card screenshot wants) unless `pick` says
 * which choice to answer them with.
 */
export function stageDisaster(s: GameState, id: string, ticks = 0, pick: number | null = null): { ok: true } | { ok: false; reason: string } {
  if (s.staff.length === 0) {
    s.cash = Math.max(s.cash, 12_000_000);
    applyNow(s, [{ type: "hire", job: "security" }, { type: "hire", job: "security" }, { type: "hire", job: "security" }, { type: "hire", job: "sre" }, { type: "hire", job: "sre" }]);
    // Long enough to walk in through the gate and start their rounds.
    for (let i = 0; i < 60; i++) tick(s);
  }
  const r = triggerDisaster(s, id, { forced: true });
  if (!r.ok) return r;
  for (let i = 0; i < ticks; i++) tick(s, pick === null ? [] : answerWith(s, pick));
  return { ok: true };
}
