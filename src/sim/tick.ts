// The fixed-step loop: apply queued commands, move everyone, run the daily systems at midnight.
import { applyCommands, type Command } from "./commands";
import { applyAuditorChoices, dailyAuditors, updateAuditors } from "./auditors/driver";
import { applyCollusionChoices, dailyCollusion, updateCollusion } from "./collusion/driver";
import { applyHearingChoices, dailyHearing } from "./hearing/driver";
import { applyYachtChoices, dailyYacht } from "./yacht/driver";
import { applyDefectionChoices, dailyDefection, updateDefection } from "./defection/driver";
import { updateMeetings } from "./meetings";
import { dailyNeoLabs } from "./neolabs/driver";
import { applyPoachingChoices, dailyPoaching } from "./poaching/driver";
import { applyPromisesChoices, dailyPromises } from "./promises/driver";
import { applyCaptureChoices, dailyCapture } from "./capture/driver";
import { TICKS_PER_DAY } from "./constants";
import { dailyBreakdowns } from "./breakdowns";
import { dailyDisasters, updateDisasters } from "./disasters/driver";
import { dailyCrowd } from "./crowd";
import { dailyEconomy } from "./economy";
import { dailyEvents, openEventOf } from "./events";
import { dailyGoals } from "./goals";
import { updateGroups } from "./groups";
import { dailyNews } from "./news";
import { dailyPapers } from "./race/papers/driver";
import { dailyLeapfrog } from "./race/leapfrog/driver";
import { dailyRace } from "./race/race";
import { dailySlop } from "./slop";
import { updateStaff } from "./staff";
import { dailyEscape, updateEscape } from "./escape/driver";
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
import { defs, withDefs } from "./defs";
import { dailyModArcs } from "./modArcs";
import { dailyFactions, updateFactions } from "./factions/driver";
import type { GameDefinition } from "../mods/game-definition";

export { TICKS_PER_DAY };

/**
 * Advance one tick, mutating `state` in place. Same state + same commands = same result.
 * Time stands still while an event card is open (commands still apply, so the answer gets in) and after a loss.
 * `def` is the run's resolved mod definition (FLT-37); without one the sim reads the session's (the base game unless the app loaded mods).
 */
export function tick(state: GameState, commands: readonly Command[] = [], def?: GameDefinition | null) {
  withDefs(def, () => step(state, commands));
}

function step(state: GameState, commands: readonly Command[]) {
  const rng = createRng(state.rngState);
  applyCommands(state, commands, rng);
  if (commands.length > 0) { updateTutorial(state); observeGuardrails(state); }
  if (systemUnlocked(state, "collusion")) applyCollusionChoices(state);
  applyCircusChoices(state);
  applyPackChoices(state);
  if (systemUnlocked(state, "auditors")) applyAuditorChoices(state);
  if (pendingConfirmOf(state) || openEventOf(state) || state.goals.value === "lost") {
    state.rngState = rng.state();
    return;
  }
  state.tick++;
  updateWalkers(state, rng);
  if (systemUnlocked(state, "protests")) updateProtesters(state, rng);
  if (state.factions && systemUnlocked(state, "factions")) updateFactions(state);
  updateStaff(state, rng);
  if (systemUnlocked(state, "escape")) updateEscape(state);
  updateGroups(state);
  if (systemUnlocked(state, "auditors")) updateAuditors(state);
  if (systemUnlocked(state, "collusion")) updateCollusion(state);
  if (systemUnlocked(state, "disasters")) updateDisasters(state);
  updateMeetings(state);
  if (systemUnlocked(state, "defection")) updateDefection(state);
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
    if (systemUnlocked(state, "defection")) dailyDefection(state);
    // The spin-outs move on the Arena's weekly beat, before the Race re-ranks it.
    if (systemUnlocked(state, "arena")) dailyNeoLabs(state);
    if (systemUnlocked(state, "arena")) dailyRace(state, rng);
    if (systemUnlocked(state, "poaching")) dailyPoaching(state);
    if (systemUnlocked(state, "leapfrog")) dailyLeapfrog(state, rng);
    if (systemUnlocked(state, "papers")) dailyPapers(state, rng);
    // FLT-33: the factions first, so the Circus and the Senate hear today's meters (FLT-52).
    if (state.factions && systemUnlocked(state, "factions")) dailyFactions(state);
    // The Circus (FLT-24, then FLT-21): the yacht first, so a subpoena it files today reaches the Senate today.
    if (systemUnlocked(state, "yacht")) dailyYacht(state);
    if (systemUnlocked(state, "hearing")) dailyHearing(state);
    // The Senate (FLT-23) before the bill (FLT-22): a roll call counted today is heard by the bill today.
    if (systemUnlocked(state, "promises")) dailyPromises(state);
    if (systemUnlocked(state, "capture")) dailyCapture(state);
    // FLT-59: before the day's bubbles, so an agent brooding about the fence has the floor.
    if (systemUnlocked(state, "escape")) dailyEscape(state);
    dailyThoughts(state, rng);
    dailyGoals(state, rng);
    if (defs().arcs.length > 0) dailyModArcs(state, rng);
    if (systemUnlocked(state, "auditors")) dailyAuditors(state);
    if (systemUnlocked(state, "events")) dailyEvents(state);
    updateProgression(state);
    updateTutorial(state);
    observeGuardrails(state);
  }
  updateCoach(state, true);
  state.rngState = rng.state();
}

/** Apply commands without advancing time (building while paused). Walkers re-route on the next tick. */
export function applyNow(state: GameState, commands: readonly Command[], def?: GameDefinition | null) {
  withDefs(def, () => now(state, commands));
}

function now(state: GameState, commands: readonly Command[]) {
  const rng = createRng(state.rngState);
  applyCommands(state, commands, rng);
  updateTutorial(state);
  observeGuardrails(state);
  if (systemUnlocked(state, "collusion")) applyCollusionChoices(state);
  applyCircusChoices(state);
  applyPackChoices(state);
  if (systemUnlocked(state, "auditors")) applyAuditorChoices(state);
  updateCoach(state);
  state.rngState = rng.state();
}

/** The Circus packs hear their card picks at once, paused or not: the next question follows the last answer. */
function applyCircusChoices(state: GameState) {
  if (systemUnlocked(state, "yacht")) applyYachtChoices(state);
  if (systemUnlocked(state, "hearing")) applyHearingChoices(state);
  if (systemUnlocked(state, "promises")) applyPromisesChoices(state);
  if (systemUnlocked(state, "capture")) applyCaptureChoices(state);
}

/** Defection and the Poaching War hear the player's pick at once, paused or not (their cards pause the game). */
function applyPackChoices(state: GameState) {
  if (systemUnlocked(state, "defection")) applyDefectionChoices(state);
  if (systemUnlocked(state, "poaching")) applyPoachingChoices(state);
}
