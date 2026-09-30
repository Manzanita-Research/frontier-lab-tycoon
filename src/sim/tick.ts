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
import { declineBuilding } from "./endings/autopilot";
import { dailyEndings, endingHalts, endingsOwnTheGame, updateEndings } from "./endings/driver";
import { dailyCrowd } from "./crowd";
import { dailyEconomy } from "./economy";
import { dailyEvents, openEventOf } from "./events";
import { dailyGoals } from "./goals";
import { updateGroups } from "./groups";
import { dailyNews, replying } from "./news";
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
import { defs, withDefs } from "./defs";
import { dailyModArcs } from "./modArcs";
import { dailyFactions, updateFactions } from "./factions/driver";
import type { GameDefinition } from "../mods/game-definition";

export { TICKS_PER_DAY };

/** A stopwatch the tick reports to after each system (FLT-39's per-system table, `sim/perf/`). Off, a lap is a null check. */
export interface TickProbe {
  start(): void;
  lap(system: string): void;
}
let probe: TickProbe | null = null;
export function setTickProbe(p: TickProbe | null) {
  probe = p;
}

/**
 * Advance one tick, mutating `state` in place. Same state + same commands = same result.
 * Time stands still while an event card is open (commands still apply, so the answer gets in), after a loss, and after
 * an ending that doesn't let you carry on.
 * `def` is the run's resolved mod definition (FLT-37); without one the sim reads the session's (the base game unless the app loaded mods).
 */
export function tick(state: GameState, commands: readonly Command[] = [], def?: GameDefinition | null) {
  withDefs(def, () => step(state, commands));
}

function step(state: GameState, commands: readonly Command[]) {
  probe?.start();
  const rng = createRng(state.rngState);
  replying(state, () => {
    commands = declineBuilding(state, commands);
    applyCommands(state, commands, rng);
  });
  probe?.lap("commands");
  if (commands.length > 0) { updateTutorial(state); observeGuardrails(state); }
  // Answers to cards are replies too (FLT-51): the toasts they send are never held back.
  replying(state, () => {
    if (systemUnlocked(state, "collusion")) applyCollusionChoices(state);
    applyCircusChoices(state);
    applyPackChoices(state);
    if (systemUnlocked(state, "auditors")) applyAuditorChoices(state);
  });
  probe?.lap("choices");
  if (pendingConfirmOf(state) || openEventOf(state) || state.goals.value === "lost" || endingHalts(state)) {
    state.rngState = rng.state();
    return;
  }
  state.tick++;
  probe?.lap("pause");
  updateWalkers(state, rng);
  probe?.lap("walkers");
  if (systemUnlocked(state, "protests")) updateProtesters(state, rng);
  probe?.lap("protesters");
  if (state.factions && systemUnlocked(state, "factions")) updateFactions(state);
  probe?.lap("factions");
  updateStaff(state, rng);
  probe?.lap("staff");
  updateGroups(state);
  probe?.lap("groups");
  if (systemUnlocked(state, "auditors")) updateAuditors(state);
  probe?.lap("auditors");
  if (systemUnlocked(state, "collusion")) updateCollusion(state);
  probe?.lap("collusion");
  if (systemUnlocked(state, "disasters")) updateDisasters(state);
  probe?.lap("disasters");
  updateMeetings(state);
  probe?.lap("meetings");
  if (systemUnlocked(state, "defection")) updateDefection(state);
  probe?.lap("defection");
  if (state.endings) updateEndings(state, rng);
  probe?.lap("endings");
  if (state.tick % TICKS_PER_DAY === 0) {
    state.day++;
    if (systemUnlocked(state, "disasters")) dailyDisasters(state);
    probe?.lap("daily:disasters");
    dailyEconomy(state, rng);
    probe?.lap("daily:economy");
    dailyTraining(state, rng);
    probe?.lap("daily:training");
    dailyWalkers(state, rng);
    probe?.lap("daily:walkers");
    if (systemUnlocked(state, "breakdowns")) dailyBreakdowns(state, rng);
    probe?.lap("daily:breakdowns");
    if (systemUnlocked(state, "protests")) dailyDiscourse(state, rng);
    probe?.lap("daily:discourse");
    dailyNews(state, rng);
    probe?.lap("daily:news");
    if (systemUnlocked(state, "slop")) dailySlop(state, rng);
    probe?.lap("daily:slop");
    dailyCrowd(state, rng);
    probe?.lap("daily:crowd");
    if (systemUnlocked(state, "collusion")) dailyCollusion(state);
    probe?.lap("daily:collusion");
    if (systemUnlocked(state, "defection")) dailyDefection(state);
    probe?.lap("daily:defection");
    // The spin-outs move on the Arena's weekly beat, before the Race re-ranks it.
    if (systemUnlocked(state, "arena")) dailyNeoLabs(state);
    probe?.lap("daily:neolabs");
    if (systemUnlocked(state, "arena")) dailyRace(state, rng);
    probe?.lap("daily:race");
    if (systemUnlocked(state, "poaching")) dailyPoaching(state);
    probe?.lap("daily:poaching");
    if (systemUnlocked(state, "leapfrog")) dailyLeapfrog(state, rng);
    probe?.lap("daily:leapfrog");
    if (systemUnlocked(state, "papers")) dailyPapers(state, rng);
    probe?.lap("daily:papers");
    // FLT-33: the factions first, so the Circus and the Senate hear today's meters (FLT-52).
    if (state.factions && systemUnlocked(state, "factions")) dailyFactions(state);
    probe?.lap("daily:factions");
    // The Circus (FLT-24, then FLT-21): the yacht first, so a subpoena it files today reaches the Senate today.
    if (systemUnlocked(state, "yacht")) dailyYacht(state);
    probe?.lap("daily:yacht");
    if (systemUnlocked(state, "hearing")) dailyHearing(state);
    probe?.lap("daily:hearing");
    // The Senate (FLT-23) before the bill (FLT-22): a roll call counted today is heard by the bill today.
    if (systemUnlocked(state, "promises")) dailyPromises(state);
    probe?.lap("daily:promises");
    if (systemUnlocked(state, "capture")) dailyCapture(state);
    probe?.lap("daily:capture");
    dailyThoughts(state, rng);
    probe?.lap("daily:thoughts");
    if (state.endings) dailyEndings(state, rng);
    probe?.lap("daily:endings");
    if (!endingsOwnTheGame(state)) dailyGoals(state, rng);
    probe?.lap("daily:goals");
    if (defs().arcs.length > 0) dailyModArcs(state, rng);
    probe?.lap("daily:modArcs");
    if (systemUnlocked(state, "auditors")) dailyAuditors(state);
    probe?.lap("daily:auditors");
    if (systemUnlocked(state, "events")) dailyEvents(state);
    probe?.lap("daily:events");
    updateProgression(state);
    updateTutorial(state);
    observeGuardrails(state);
    probe?.lap("daily:progression");
  } else updateProgression(state);
  probe?.lap("progression");
  updateCoach(state, true);
  probe?.lap("coach");
  state.rngState = rng.state();
}

/** Apply commands without advancing time (building while paused). Walkers re-route on the next tick. */
export function applyNow(state: GameState, commands: readonly Command[], def?: GameDefinition | null) {
  withDefs(def, () => now(state, commands));
}

function now(state: GameState, commands: readonly Command[]) {
  const rng = createRng(state.rngState);
  replying(state, () => applyCommands(state, declineBuilding(state, commands), rng));
  updateTutorial(state);
  observeGuardrails(state);
  // Answers to cards are replies too (FLT-51): the toasts they send are never held back.
  replying(state, () => {
    if (systemUnlocked(state, "collusion")) applyCollusionChoices(state);
    applyCircusChoices(state);
    applyPackChoices(state);
    if (systemUnlocked(state, "auditors")) applyAuditorChoices(state);
  });
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
