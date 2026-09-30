// Review moments for The Hearing (FLT-21) and the yacht summit (FLT-24): the same card and tick paths as play, run
// until the card the shot wants is on screen. No renderer or UI dependencies.
import { eventById } from "../../content/events";
import { openEventOf } from "../events";
import { answer, readyForPressure } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";
import { enableHearing } from "../hearing/driver";
import { enableYacht } from "../yacht/driver";

export const CIRCUS_MOMENTS = ["hearing", "hearing-verdict", "yacht-invite", "yacht-leak"] as const;
export type CircusMoment = (typeof CIRCUS_MOMENTS)[number];
export function isCircusMoment(value: string | null | undefined): value is CircusMoment {
  return (CIRCUS_MOMENTS as readonly unknown[]).includes(value);
}

const isHearingCard = (id: string | undefined) => !!id && eventById(id)?.kind === "hearing";

/** Tick (answering anything else with its first choice) until `want` says the card on screen is the one. */
function until(s: GameState, want: (id: string) => boolean, days = 90) {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    const open = openEventOf(s);
    if (open && want(open.id)) return;
    tick(s, open ? answer(s) : []);
  }
}

/** The lab is called in (a subpoena, so no waiting for the debut) and testifies. "hearing": one chaotic answer given,
 * the second senator asking. "hearing-verdict": chaotic, chaotic, earnest, which goes viral, and the gavel is up. */
export function stageHearing(s: GameState, moment: "hearing" | "hearing-verdict") {
  if (!s.models.length) s.models.push("Frontier-1");
  enableHearing(s);
  s.flags["subpoena:demo"] = s.day;
  const picks = moment === "hearing" ? [2] : [2, 2, 0];
  until(s, isHearingCard);
  for (const pick of picks) {
    applyNow(s, answer(s, pick));
    until(s, isHearingCard, 2);
  }
}

/** The invitation on the table, or (having signed) the group chat leaked. */
export function stageYacht(s: GameState, moment: "yacht-invite" | "yacht-leak") {
  readyForPressure(s); // cards wait for day 40 and a gateway
  enableYacht(s);
  until(s, (id) => id === "yacht-invite");
  if (moment === "yacht-invite") return;
  applyNow(s, answer(s, 0));
  until(s, (id) => id === "yacht-leak");
}

export function stageCircus(s: GameState, moment: CircusMoment) {
  if (moment === "hearing" || moment === "hearing-verdict") stageHearing(s, moment);
  else stageYacht(s, moment);
}
