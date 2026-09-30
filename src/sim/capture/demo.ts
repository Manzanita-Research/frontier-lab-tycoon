// Review moments for Regulatory Capture (FLT-22) and the Promise Tracker (FLT-23): the same card and tick paths as
// play, run until the card the shot wants is on screen. No renderer or UI dependencies.
import { eventById } from "../../content/events";
import { openEventOf } from "../events";
import { answer, readyForPressure } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";
import { enableHearing } from "../hearing/driver";
import { enablePromises } from "../promises/driver";
import { promisesView } from "../promises/view";
import { ROLLCALL_CARD, WHIP_CARD } from "../promises/pack";
import { enableCapture } from "./driver";
import { DRAFT_CARD, EXPOSED_CARD } from "./pack";

export const SENATE_MOMENTS = ["bill", "bill-law", "bill-exposed", "vote", "rollcall"] as const;
export type SenateMoment = (typeof SENATE_MOMENTS)[number];
export function isSenateMoment(value: string | null | undefined): value is SenateMoment {
  return (SENATE_MOMENTS as readonly unknown[]).includes(value);
}

/** Tick (answering anything else with its first choice) until `want` holds. */
function until(s: GameState, want: (s: GameState) => boolean, days = 120) {
  for (let i = 0; i < days * TICKS_PER_DAY && !want(s); i++) {
    const open = openEventOf(s);
    tick(s, open && eventById(open.id)?.kind !== "bill" && eventById(open.id)?.kind !== "vote" ? answer(s) : []);
  }
}
const showing = (id: string) => (s: GameState) => openEventOf(s)?.id === id;

/** The lab has been to one hearing and holds a lot of Capture: both packs awake, the Senate in session. */
export function wakeSenate(s: GameState, capture = 40) {
  readyForPressure(s);
  if (!s.models.length) s.models.push("Frontier-1");
  enableHearing(s);
  enablePromises(s);
  enableCapture(s);
  s.hearing!.history.push({ day: s.day, topic: "what the lab even is", trigger: "debut", verdict: "captured", trust: 0, capture: 10 });
  s.capture = Math.max(s.capture ?? 0, capture);
}

/** Lobby every senator not yet lobbied on the motion on the docket (a lean is only odds: only the lobbyists make it sure). */
export function lobbyAll(s: GameState) {
  const v = promisesView(s);
  if (!v.lobbying) return;
  for (const sen of v.senators) if (!sen.lobbied) applyNow(s, [{ type: "lobby", senator: sen.id }]);
}

/**
 * "bill": the staffer's draft on screen, two clauses ticked. "bill-law": the bill (lobbied through) is law. "bill-exposed":
 * then someone reads the file properties. "vote": a motion on the docket, one senator lobbied, the whip card up.
 * "rollcall": the roll call after that, with the flipped vote.
 */
export function stageSenate(s: GameState, moment: SenateMoment) {
  s.cash = Math.max(s.cash, 2_000_000);
  if (moment === "vote" || moment === "rollcall") {
    wakeSenate(s, 0);
    until(s, showing(WHIP_CARD));
    const v = promisesView(s);
    const against = [...v.senators].sort((a, b) => a.odds - b.odds)[0]!;
    applyNow(s, [{ type: "lobby", senator: against.id }]);
    if (moment === "vote") return;
    applyNow(s, answer(s, 0));
    until(s, showing(ROLLCALL_CARD));
    return;
  }
  wakeSenate(s);
  until(s, showing(DRAFT_CARD));
  applyNow(s, [{ type: "draftClause", clause: "threshold", on: true }, { type: "draftClause", clause: "permit", on: true }]);
  if (moment === "bill") return;
  applyNow(s, answer(s, 0));
  // The floor: the lobbyists see everyone leaning the wrong way, every card is answered, until the roll call.
  for (let i = 0; i < 60 * TICKS_PER_DAY && s.bill!.machine.value === "floor"; i++) {
    lobbyAll(s);
    tick(s, openEventOf(s) ? answer(s) : []);
  }
  if (moment === "bill-law") {
    // Three weeks of law, the Senate's own cards answered, and a quiet screen for the shot.
    const aged = (s: GameState) => s.bill!.lawDay !== null && s.day >= s.bill!.lawDay + 21;
    for (let i = 0; i < 40 * TICKS_PER_DAY && !(aged(s) && !openEventOf(s)); i++) tick(s, openEventOf(s) ? answer(s) : []);
    return;
  }
  if (openEventOf(s)) tick(s, answer(s));
  s.flags["capture:leak"] = s.day;
  until(s, showing(EXPOSED_CARD), 5);
}
