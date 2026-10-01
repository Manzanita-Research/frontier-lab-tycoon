// Staged moments for FLT-76's beats (`?moment=beats-pileup|badnews|logo|offsite`): links Jem can open on a phone, no
// console. Pure sim, like the other demos: the World is moved along the way a player could have, a moment before the beat.
//
//   beats-pileup  Level 4, one tick before a midnight that ships a model and re-ranks the Arena, which puts you in the top
//                 three (Level 5's New! card); the next midnight a card opens. Played at ▶▶▶ (the app starts it there).
//   badnews       the auditors are on campus, about to catch the boxes; a few seconds at ▶▶▶ later the report costs
//                 about 16 points of public trust, and the game drops to 1× with the pinned toast.
//   logo          Level 1 with "Your first model needs a logo" open.
//   offsite       The leadership offsite open, a hundred and six days into Scrutiny.
import { eventById } from "../content/events";
import { modelName } from "../content/names";
import { stageAudit } from "./auditors/demo";
import { TICKS_PER_DAY } from "./constants";
import { openEventOf, unpaced } from "./events";
import { arcMachine } from "./machines/arc";
import { initialStored, step } from "./machines/run";
import { enableEarnedPacks } from "./progression";
import { seedField } from "./race/arena";
import { createRng } from "./rng";
import { before, withRevenue } from "./race/demo";
import { answer } from "./testkit";
import { applyNow, tick } from "./tick";
import type { GameState } from "./types";

export const BEATS_MOMENTS = ["beats-pileup", "badnews", "logo", "offsite"] as const;
export type BeatsMoment = (typeof BEATS_MOMENTS)[number];
export const isBeatsMoment = (s: string | null | undefined): s is BeatsMoment => !!s && (BEATS_MOMENTS as readonly string[]).includes(s);
/** These keep the ladder (Level 1 for the logo, Level 4 for the pile-up): staging deletes it for every other moment. */
export const keepsLadder = (s: string | null | undefined): boolean => s === "beats-pileup" || s === "logo";
/** These are about ▶▶▶: the app starts them at 10× unless `?speed=` says otherwise. */
export const startsFast = (s: string | null | undefined): boolean => s === "beats-pileup" || s === "badnews";

/** Ticks of lead before the bad news: about four seconds at ▶▶▶ (10 × 20/6 ticks a second). */
export const BADNEWS_LEAD = 130;

/** Open `id` now, whatever its condition says. */
function openNow(s: GameState, id: string) {
  while (openEventOf(s)) applyNow(s, answer(s));
  const def = eventById(id)!;
  const armed = s.arcs[id] ?? initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? 0, openedDay: null });
  s.arcs[id] = step(arcMachine, armed, { type: "DAY", day: s.day, ready: true, slotFree: true, pace: 1 }).stored;
}

/** Move the clock on whole days (the hour stays). */
function laterBy(s: GameState, days: number) {
  s.tick += days * TICKS_PER_DAY;
  s.day += days;
}

export function stageBeats(s: GameState, moment: BeatsMoment) {
  unpaced(s);
  switch (moment) {
    case "beats-pileup": {
      s.progression = { value: "growing", context: { level: 4 } };
      enableEarnedPacks(s);
      withRevenue(s);
      // Let the hall start a run (a day or two), then the Race opens as it does at Level 4: you at #6.
      for (let i = 0; i < 3 * TICKS_PER_DAY && s.training.value === "idle"; i++) tick(s, answer(s));
      seedField(s);
      // A week on, one tick before the Monday re-rank: the run is a hair from done. At midnight it ships, the re-rank that
      // follows puts the new model in the top three (Level 5's New! card), and the cards the ladder held back (an era's,
      // the auction booked for that midnight) open the next one.
      const monday = (Math.floor(s.day / 7) + 2) * 7;
      before(s, monday, 1);
      s.compute = Math.max(s.compute, 400);
      // The lab already has Frontier-2 to Frontier-4 (withRevenue): this run is the next one, named the way play names it.
      const run = Math.max(s.training.context.run, s.models.length + 1);
      s.training.context = { ...s.training.context, progress: s.training.context.cost - 1, run, name: modelName(run, createRng(s.seed), s.day) };
      s.race.nextAuction = monday;
      delete s.flags["offer:auction"];
      return;
    }
    case "badnews": {
      // The tour with the boxes out (audit-tidy), then the auditors' dice are tried until a tour catches them: the same
      // ticks as play, only luckier for the auditors. Then the clock runs to BADNEWS_LEAD ticks before the report.
      stageAudit(s, "audit-tidy");
      const base = s.auditors!.rngState;
      for (let k = 0; k < 24; k++) {
        const copy = structuredClone(s);
        copy.auditors!.rngState = (base + k * 0x9e3779b9) >>> 0;
        const drop = rehearseDrop(copy);
        if (drop === null) continue;
        s.auditors!.rngState = (base + k * 0x9e3779b9) >>> 0;
        for (let i = 0; i < drop; i++) tick(s, answer(s));
        return;
      }
      return;
    }
    case "logo": {
      // Level 1, two days after the first path: the hall is up and the first model is training.
      for (let z = 18; z >= 14; z--) applyNow(s, [{ type: "placePath", x: 11, z }]);
      applyNow(s, [{ type: "placeBuilding", kind: "hall", x: 12, z: 14 }]);
      s.flags.firstPath = s.day - 2;
      openNow(s, "theLogo");
      return;
    }
    case "offsite": {
      withRevenue(s);
      if (s.day < 120) laterBy(s, 120 - s.day);
      s.flags.scrutinyDay = s.day - 106;
      openNow(s, "offsite");
      return;
    }
  }
}

/**
 * Play a copy until public trust falls 10 or more from its high (a caught tour's report); the tick to stop the real World
 * on, BADNEWS_LEAD before the drop and after the last card that opened on the way (so nothing holds the clock in between),
 * or null if this tour caught nobody.
 */
function rehearseDrop(copy: GameState): number | null {
  let lastCard = -1;
  const trust: number[] = [];
  for (let i = 0; i < 3000; i++) {
    trust.push(copy.disasters.trust);
    if (openEventOf(copy)) lastCard = i;
    tick(copy, answer(copy));
    if (copy.auditors!.report) {
      if (!copy.auditors!.report.caught) return null;
      const from = Math.max(0, i + 1 - BADNEWS_LEAD, lastCard + 1);
      const high = Math.max(...trust.slice(from));
      return high - copy.disasters.trust >= 10 ? from : null;
    }
  }
  return null;
}
