// Review links for the late lunch (FLT-109): `?moment=slop-late` (two hours late: the crowd at the gate, the posts, the
// rival labs piling on, the run going backwards), `slop-card` (an hour late, the card on screen) and `slop-arrives` (three
// hours late: the courier at the gate handing the bowls over). Defection's lab a year in, played to noon with the order
// forced late, through the driver's own code paths. Pure sim and deterministic; the game itself never uses it.
import { TICKS_PER_DAY } from "../constants";
import { busyLab } from "../defection/demo";
import { openEventOf, pacerOf, unpaced } from "../events";
import { pacerMachine } from "../machines/cardPace";
import { step } from "../machines/run";
import { CARD_GAP_DAYS, STORY_GAP_DAYS } from "../../content/cardPacing";
import { talking } from "../meetings";
import { answer } from "../testkit";
import { applyNow, tick } from "../tick";
import type { GameState } from "../types";
import { enableBirdApp } from "../birdapp/driver";
import { enableSlopBowl, LATE_FLAG } from "./driver";
import { CARD } from "./pack";

export const SLOP_MOMENTS = ["slop-late", "slop-card", "slop-arrives"] as const;
export type SlopMoment = (typeof SLOP_MOMENTS)[number];
export const isSlopMoment = (m: string | null | undefined): m is SlopMoment => (SLOP_MOMENTS as readonly unknown[]).includes(m);

/** Tick until `done` (at most `days`), answering every card but lunch's own, which `stop` keeps on screen. */
function until(s: GameState, done: (s: GameState) => boolean, days: number, stop = false) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    if (open && (open.id !== CARD || !stop)) applyNow(s, answer(s));
    else tick(s);
  }
}

export function stageSlopBowl(s: GameState, moment: SlopMoment) {
  stage(s, moment);
  // Staged, the lab plays on paced as usual: the next card waits its turn instead of landing mid-lunch.
  s.pacer = step(pacerMachine, pacerOf(s), { type: "PACE", gap: CARD_GAP_DAYS, storyGap: STORY_GAP_DAYS, auto: false }).stored;
}

function stage(s: GameState, moment: SlopMoment) {
  unpaced(s);
  busyLab(s);
  if (s.flags.slopbowlOff) return;
  if (!s.flags.birdappOff) enableBirdApp(s);
  enableSlopBowl(s);
  s.flags[LATE_FLAG] = s.day;
  const stage = (v: string) => (w: GameState) => w.slopbowl!.machine.value === v;
  // Noon on the campus clock: the order falls due, and it is late.
  until(s, stage("late"), 8);
  if (moment === "slop-card") {
    until(s, (w) => openEventOf(w)?.id === CARD || w.slopbowl!.machine.value !== "late", 3, true);
    return;
  }
  if (moment === "slop-late") {
    until(s, stage("worse"), 4);
    // Twenty minutes into the second hour: everyone is at the gate, and the posts have been up a while.
    until(s, (w) => w.tick - w.slopbowl!.machine.context.due >= 58, 2);
    return;
  }
  until(s, stage("arriving"), 6);
  // The courier walks in from the gate; stop while they hand the bowls over.
  until(s, (w) => talking(w, "slopbowl").length > 0, 2);
  until(s, () => false, 4 / TICKS_PER_DAY);
}
