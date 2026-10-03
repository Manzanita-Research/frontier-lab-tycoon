// `?moment=arc:<arc>:<state>` (FLT-101): any mod arc's beat as a one-click link, without a line of staging code per mod.
// Pure sim, like the other demos. The lab is Defection's lab a year in (a Hall, a gateway, the Kombucha Bar, researchers,
// three releases, so cards are in season), plays on to midnight (answering any card that opens, the arc held still so it
// can't wander off on its own), and at midnight, when arcs hear their day, the arc walks into `<state>`, running that
// state's entry calls: its card opens, its beat plays, its posts go up. If no card opened, the hour runs on so the Bird
// App's posts land, as they would at the next midnight. Nested states are written `parent/child`.
import { TICKS_PER_DAY } from "./constants";
import { landNow } from "./birdapp/driver";
import { busyLab } from "./defection/demo";
import { askFlag } from "./disasters/names";
import { dailyEvents, openEventOf, unpaced } from "./events";
import { stageModArc } from "./modArcs";
import { createRng } from "./rng";
import { answer } from "./testkit";
import { applyNow, tick } from "./tick";
import type { GameState } from "./types";

export const isArcMoment = (m: string | null | undefined): m is `arc:${string}` => !!m && /^arc:[\w:.-]+:[\w/.-]+$/.test(m);

/** `arc:<arc>:<state>` split at its last colon (an arc id may have colons; a state staged this way may not). */
export function parseArcMoment(m: string): { arc: string; state: string } {
  const rest = m.slice("arc:".length);
  const cut = rest.lastIndexOf(":");
  return { arc: rest.slice(0, cut), state: rest.slice(cut + 1) };
}

export function stageArcMoment(s: GameState, moment: `arc:${string}`): boolean {
  const { arc, state } = parseArcMoment(moment);
  const hold = `arcOff:${arc}`;
  const was = s.flags[hold];
  s.flags[hold] = s.day;
  // A staged moment is the card now, not after a quiet week (FLT-54).
  unpaced(s);
  busyLab(s);
  const until = (s.day + 1) * TICKS_PER_DAY;
  // tick() stands still while a card is open, so the warp answers them as a player would.
  for (let guard = 0; s.tick < until && guard < 4 * TICKS_PER_DAY; guard++) {
    if (openEventOf(s)) applyNow(s, answer(s));
    else tick(s);
  }
  while (openEventOf(s)) applyNow(s, answer(s));
  if (was === undefined) delete s.flags[hold];
  const rng = createRng(s.rngState);
  const ok = stageModArc(s, rng, arc, state);
  s.rngState = rng.state();
  // Whatever else the lab gets asked at that midnight (the app's launch livestream, say) is answered: the arc's card is the card.
  for (let i = 0; i < 6 && openEventOf(s) && s.flags[askFlag(openEventOf(s)!.id)] === undefined; i++) {
    applyNow(s, answer(s));
    dailyEvents(s);
  }
  if (ok && !openEventOf(s)) {
    tick(s);
    landNow(s, "posts");
  }
  return ok;
}
