// Debug scenes for Release Leapfrog (`?moment=shipnow|pair|stream[:mishap]|solved`): the game is staged a moment before
// something happens, so a link or a screenshot script lands right on it. Pure sim, deterministic, the way a player could
// have got there; the game itself doesn't use it.
import { LEAPFROG } from "../../../content/leapfrog";
import { canPlace } from "../../commands";
import { createRng } from "../../rng";
import { applyNow, TICKS_PER_DAY } from "../../tick";
import type { GameState } from "../../types";
import { enableLeapfrog, handleDrop, ownRelease, refreshRecords } from "./driver";

export const LEAP_MOMENTS = ["shipnow", "pair", "stream", "solved"] as const;
export type LeapMoment = (typeof LEAP_MOMENTS)[number];

/** `stream` or `stream:dog` (a mishap id from the pack). */
export function parseLeapMoment(s: string | null | undefined): { moment: LeapMoment; arg: string } | null {
  if (!s) return null;
  const [name, arg = ""] = s.split(":");
  return (LEAP_MOMENTS as readonly string[]).includes(name!) ? { moment: name as LeapMoment, arg } : null;
}
export const isLeapMoment = (s: string | null | undefined): boolean => parseLeapMoment(s) !== null;

/** Put the clock `ticks` before the midnight that starts `day`. */
function before(s: GameState, day: number, ticks: number) {
  s.tick = day * TICKS_PER_DAY - ticks;
  s.day = Math.floor(s.tick / TICKS_PER_DAY);
}

/** A lab with a gateway and some revenue, a few models out and a bit of buzz. */
function established(s: GameState) {
  for (const [x, z] of [[6, 14], [15, 13], [7, 17]] as const) {
    if (canPlace(s, "gateway", x, z).ok) {
      applyNow(s, [{ type: "placeBuilding", kind: "gateway", x, z }]);
      break;
    }
  }
  s.cash = 12_000_000;
  s.hype = 56;
  s.vibes = { ...s.vibes, value: 560 };
  s.capability = 46;
  s.models = ["Frontier-2", "Frontier-3-Reasoner", "Frontier-4"];
  s.ledger = { income: 46_000, expenses: 30_000, net: 16_000 };
}

export function stageLeapfrog(s: GameState, moment: LeapMoment, arg = "") {
  enableLeapfrog(s);
  established(s);
  // Past the first eras already: their title cards must not butt in on the moment.
  const peak = moment === "solved" ? 8 : 3;
  s.race.era = { value: peak > 5 ? "era3" : "era2", context: { peak } } as never;
  s.race.nextAuction = 9_999;
  s.leapfrog.modelsSeen = s.models.length;
  const rng = createRng(s.rngState);
  const cal = s.leapfrog.calendar;
  switch (moment) {
    case "shipnow": {
      // Day 39, your run 94% done, a lab is a second from launching: the card opens as the day turns.
      s.training = { ...s.training, context: { ...s.training.context, run: 5, progress: 0.94 * 8_400, cost: 8_400, name: "Frontier-5-Reasoner-Pro" } };
      s.leapfrog.calendar = { value: "quiet", context: { ...cal.context, daysLeft: 1 } } as never;
      before(s, 40, 6);
      break;
    }
    case "pair": {
      // A lab launched today; another answers tomorrow, a second away.
      s.day = 44;
      handleDrop(s, rng, "lead");
      s.leapfrog.calendar = { value: "answering", context: { ...cal.context, leads: 1, daysLeft: 0 } } as never;
      before(s, 45, 6);
      break;
    }
    case "stream": {
      // Your model just went out and the livestream is on: the mishap card opens as the day turns.
      s.day = 60;
      s.models = [...s.models, "Frontier-5-Reasoner-Pro"];
      s.capability += 14;
      ownRelease(s, rng, { early: false, ready: 1, mishap: LEAPFROG.mishaps.some((m) => m.id === arg) ? arg : "dog" });
      before(s, 61, 6);
      break;
    }
    case "solved": {
      // A benchmark has just been declared solved: the headline is on the ticker, the harder one is on the board.
      s.day = 90;
      s.capability = 112;
      refreshRecords(s, rng);
      before(s, 91, 6);
      break;
    }
  }
  s.rngState = rng.state();
}
