// The fixed-step loop: apply queued commands, move everyone, run the daily systems at midnight.
import { applyCommands, type Command } from "./commands";
import { applyCollusionChoices, dailyCollusion, updateCollusion } from "./collusion/driver";
import { TICKS_PER_DAY } from "./constants";
import { dailyBreakdowns } from "./breakdowns";
import { dailyDisasters, updateDisasters } from "./disasters/driver";
import { dailyCrowd } from "./crowd";
import { dailyEconomy } from "./economy";
import { dailyEvents, openEventOf } from "./events";
import { dailyGoals } from "./goals";
import { dailyNews } from "./news";
import { dailyLeapfrog } from "./race/leapfrog/driver";
import { dailyRace } from "./race/race";
import { dailySlop } from "./slop";
import { updateStaff } from "./staff";
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
  applyCollusionChoices(state);
  if (openEventOf(state) || state.goals.value === "lost") {
    state.rngState = rng.state();
    return;
  }
  state.tick++;
  updateWalkers(state, rng);
  updateProtesters(state, rng);
  updateStaff(state, rng);
  updateCollusion(state);
  updateDisasters(state);
  if (state.tick % TICKS_PER_DAY === 0) {
    state.day++;
    dailyDisasters(state);
    dailyEconomy(state, rng);
    dailyTraining(state, rng);
    dailyWalkers(state, rng);
    dailyBreakdowns(state, rng);
    dailyDiscourse(state, rng);
    dailyNews(state, rng);
    dailySlop(state, rng);
    dailyCrowd(state, rng);
    dailyCollusion(state);
    dailyRace(state, rng);
    dailyLeapfrog(state, rng);
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
  applyCollusionChoices(state);
  state.rngState = rng.state();
}
