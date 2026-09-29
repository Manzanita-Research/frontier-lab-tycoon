// The fixed-step loop: apply queued commands, move everyone, run the daily systems at midnight.
import { applyCommands, type Command } from "./commands";
import { TICKS_PER_DAY } from "./constants";
import { dailyEconomy } from "./economy";
import { dailyEvents } from "./events";
import { dailyGoals } from "./goals";
import { dailyNews } from "./news";
import { dailyDiscourse, updateProtesters } from "./protest";
import { createRng } from "./rng";
import { dailyThoughts } from "./thoughts";
import { dailyTraining } from "./training";
import { dailyWalkers, updateWalkers } from "./walkers";
import type { GameState } from "./types";

export { TICKS_PER_DAY };

/**
 * Advance one tick, mutating `state` in place. Same state + same commands = same result.
 * Time stands still while an event card is open (commands still apply, so the answer gets in) and after a loss.
 */
export function tick(state: GameState, commands: readonly Command[] = []) {
  const rng = createRng(state.rngState);
  applyCommands(state, commands, rng);
  if (state.event || state.goals.value === "lost") {
    state.rngState = rng.state();
    return;
  }
  state.tick++;
  updateWalkers(state, rng);
  updateProtesters(state, rng);
  if (state.tick % TICKS_PER_DAY === 0) {
    state.day++;
    dailyEconomy(state, rng);
    dailyTraining(state, rng);
    dailyWalkers(state, rng);
    dailyDiscourse(state, rng);
    dailyNews(state, rng);
    dailyThoughts(state, rng);
    dailyGoals(state, rng);
    dailyEvents(state);
  }
  state.rngState = rng.state();
}

/** Apply commands without advancing time (building while paused). Walkers re-route on the next tick. */
export function applyNow(state: GameState, commands: readonly Command[]) {
  const rng = createRng(state.rngState);
  applyCommands(state, commands, rng);
  state.rngState = rng.state();
}
