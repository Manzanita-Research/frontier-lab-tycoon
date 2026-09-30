// The fixed-step loop: apply queued commands, move everyone, run the daily systems at midnight.
import { applyCommands, type Command } from "./commands";
import { applyCollusionChoices, dailyCollusion, updateCollusion } from "./collusion/driver";
import { TICKS_PER_DAY } from "./constants";
import { dailyBreakdowns } from "./breakdowns";
import { dailyDisasters, updateDisasters } from "./disasters/driver";
import { declineBuilding } from "./endings/autopilot";
import { dailyEndings, endingHalts, endingsOwnTheGame, updateEndings } from "./endings/driver";
import { dailyCrowd } from "./crowd";
import { dailyEconomy } from "./economy";
import { dailyEvents, openEventOf } from "./events";
import { dailyGoals } from "./goals";
import { dailyNews } from "./news";
import { dailyPapers } from "./race/papers/driver";
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
import { updateCoach } from "./coach";
import { systemUnlocked, updateProgression } from "./progression";
import { updateTutorial } from "./tutorial";
import { observeGuardrails, pendingConfirmOf } from "./guardrails";

export { TICKS_PER_DAY };

/**
 * Advance one tick, mutating `state` in place. Same state + same commands = same result.
 * Time stands still while an event card is open (commands still apply, so the answer gets in), after a loss, and after
 * an ending that doesn't let you carry on.
 */
export function tick(state: GameState, commands: readonly Command[] = []) {
  const rng = createRng(state.rngState);
  commands = declineBuilding(state, commands);
  applyCommands(state, commands, rng);
  if (commands.length > 0) { updateTutorial(state); observeGuardrails(state); }
  if (systemUnlocked(state, "collusion")) applyCollusionChoices(state);
  if (pendingConfirmOf(state) || openEventOf(state) || state.goals.value === "lost" || endingHalts(state)) {
    state.rngState = rng.state();
    return;
  }
  state.tick++;
  updateWalkers(state, rng);
  if (systemUnlocked(state, "protests")) updateProtesters(state, rng);
  updateStaff(state, rng);
  if (systemUnlocked(state, "collusion")) updateCollusion(state);
  if (systemUnlocked(state, "disasters")) updateDisasters(state);
  if (state.endings) updateEndings(state, rng);
  if (state.tick % TICKS_PER_DAY === 0) {
    state.day++;
    if (systemUnlocked(state, "disasters")) dailyDisasters(state);
    dailyEconomy(state, rng);
    dailyTraining(state, rng);
    dailyWalkers(state, rng);
    if (systemUnlocked(state, "breakdowns")) dailyBreakdowns(state, rng);
    if (systemUnlocked(state, "protests")) dailyDiscourse(state, rng);
    dailyNews(state, rng);
    if (systemUnlocked(state, "slop")) dailySlop(state, rng);
    dailyCrowd(state, rng);
    if (systemUnlocked(state, "collusion")) dailyCollusion(state);
    if (systemUnlocked(state, "arena")) dailyRace(state, rng);
    if (systemUnlocked(state, "leapfrog")) dailyLeapfrog(state, rng);
    if (systemUnlocked(state, "papers")) dailyPapers(state, rng);
    dailyThoughts(state, rng);
    if (state.endings) dailyEndings(state, rng);
    if (!endingsOwnTheGame(state)) dailyGoals(state, rng);
    if (systemUnlocked(state, "events")) dailyEvents(state);
    updateProgression(state);
    updateTutorial(state);
    observeGuardrails(state);
  }
  updateCoach(state, true);
  state.rngState = rng.state();
}

/** Apply commands without advancing time (building while paused). Walkers re-route on the next tick. */
export function applyNow(state: GameState, commands: readonly Command[]) {
  const rng = createRng(state.rngState);
  applyCommands(state, declineBuilding(state, commands), rng);
  updateTutorial(state);
  observeGuardrails(state);
  if (systemUnlocked(state, "collusion")) applyCollusionChoices(state);
  updateCoach(state);
  state.rngState = rng.state();
}
