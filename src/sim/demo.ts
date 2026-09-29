// The Demo Stage puts on a show for whoever is in the audience. A show lasts SHOW_TICKS and works or flops with the
// lab's capability; everyone let in while it runs gets the same result. Shows start when the first visitor walks in.
import { pushNews, addToast } from "./news";
import type { Rng } from "./rng";
import { addIncident } from "./vibes";
import type { Building, GameState } from "./types";

export const SHOW_TICKS = 60;
/** A flop takes away this fraction of what a good show gives. */
export const FLOP_SCALE = -0.4;

/** Chance a live demo goes well: 30% for a bare lab, 95% once capability is well past 70. */
export const demoOdds = (capability: number) => Math.max(0.3, Math.min(0.95, 0.3 + capability / 120));

/** The stage's current show as flags: when it ends and whether it worked. */
export const showEnds = (state: GameState, b: Building) => state.flags[`show:${b.id}`] ?? -1;
export const showWorked = (state: GameState, b: Building) => state.flags[`showOk:${b.id}`] === 1;

/** A visitor is let in: start a show if none is running. Returns the scale for what the audience takes away. */
export function showFor(state: GameState, rng: Rng, b: Building): number {
  if (state.tick < showEnds(state, b)) return showWorked(state, b) ? 1 : FLOP_SCALE;
  const worked = rng.chance(demoOdds(state.capability));
  state.flags[`show:${b.id}`] = state.tick + SHOW_TICKS;
  state.flags[`showOk:${b.id}`] = worked ? 1 : 0;
  pushNews(state, rng, worked ? "demoOk" : "demoFail");
  if (!worked) addIncident(state, 0.1);
  // Toasts are for the moments that matter, so not every show gets one.
  if (state.tick - (state.flags.lastShowToast ?? -999) > 5 * 20) {
    state.flags.lastShowToast = state.tick;
    addToast(state, worked ? "Demo went flawlessly (it was pre-recorded)" : "Live demo crashed. Presenter blames the Wi-Fi.", worked ? "good" : "bad");
  }
  return worked ? 1 : FLOP_SCALE;
}
