import { levelOf } from "./progression";
import { coachCommand } from "./coach";
import { TUTORIAL, TUTORIAL_DONE, type TutorialStep, type TutorialTarget } from "../content/tutorial";
import { tutorialMachine } from "./machines/tutorial";
import { step } from "./machines/run";
import { addToast } from "./news";
import { isReachable } from "./pathfind";
import type { GameState } from "./types";
import { fillTemplate } from "./format";

export interface AssistantMessage {
  step: TutorialStep;
  message: string;
  highlight: TutorialTarget;
  /** The shell holds time until CONTINUE or a matching build action; presentation is FLT-29. */
  paused: boolean;
  canSkip: true;
}

export function assistantOf(state: GameState): AssistantMessage | null {
  const t = state.tutorial;
  if (!t || t.value === "done" || t.value === "skipped") return null;
  const key = t.value as TutorialStep;
  return { step: key, ...TUTORIAL[key], paused: false, canSkip: true };
}

/** Successful commands set facts; this driver steps synchronously even when the app is paused. */
export function updateTutorial(state: GameState) {
  if (!assistantOf(state)) return;
  const facts = {
    type: "FACTS" as const,
    path: state.flags.firstPath !== undefined,
    hall: state.buildings.some((b) => b.kind === "hall" && !b.broken && isReachable(state, b)),
    revenue: state.flags.firstRevenue !== undefined,
    hired: state.flags.firstSupportHire !== undefined,
    released: state.models.length > 0,
  };
  // Catch up out-of-order actions without asking an experienced player to do them twice.
  for (let i = 0; i < 5; i++) {
    const before = state.tutorial!;
    const result = step(tutorialMachine, before, facts);
    state.tutorial = result.stored;
    for (const e of result.effects) if (e.type === "FINISHED") addToast(state, fillTemplate(TUTORIAL_DONE, { model: state.models[0] ?? "Your model" }), "good");
    if (before.value === result.stored.value) break;
  }
}

export function continueTutorial(state: GameState, skip = false) {
  if (skip) coachCommand(state, "coachSkip");
  if (assistantOf(state)) state.tutorial = step(tutorialMachine, state.tutorial!, { type: skip ? "SKIP" : "CONTINUE" }).stored;
}

/** Pressure waits for a launch and a route to revenue; removing a gateway later cannot switch fires off. */
export function pressureReady(state: GameState): boolean {
  if (state.progression) return levelOf(state) >= 3;
  return state.day >= 40 && state.models.length > 0 && (state.flags.firstRevenue !== undefined || state.buildings.some((b) => b.kind === "gateway" && isReachable(state, b)));
}
