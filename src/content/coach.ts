import type { BuildingKind } from "./buildings";

export type CoachTarget = "start" | "build:path" | "build:hall" | "training" | "speed" | "map:researcher" | "build:gateway" | "stat:runway" | "goals" | "map:suggest";
export type CoachTrigger = "buildPanelOpened" | "pathConnected" | "hallBuilt" | "spedUp" | "mindRead" | "released" | "gatewayBuilt" | "timer";
export interface CoachLine {
  id: string;
  /** `{goal}` is the current level's goal. */
  text: string;
  target: CoachTarget;
  waitFor: "action" | "timer";
  trigger: CoachTrigger;
  /** Dim everything but the target: only for a build step. Nothing is dimmed while you wait on a model (FLT-58). */
  dim?: true;
}
/** Jem's approved copy, FLT-47. Keep instructions and satire separate. */
export const COACH: readonly CoachLine[] = [
  { id: "start", text: "Welcome to your lab. Everything you build starts here. Click Start.", target: "start", waitFor: "action", trigger: "buildPanelOpened", dim: true },
  { id: "path", text: "Start with a path. Draw it from the gate. Everyone in your lab walks on paths.", target: "build:path", waitFor: "action", trigger: "pathConnected", dim: true },
  { id: "hall", text: "Now a Training Hall. Put it next to your path. It turns compute into a model.", target: "build:hall", waitFor: "action", trigger: "hallBuilt", dim: true },
  // FLT-58: the first run is a small one, and the wait has two things to do in it.
  { id: "speed", text: "Your first model is training. It's a small one: about a minute. Press ▶▶ to hurry it along.", target: "speed", waitFor: "action", trigger: "spedUp" },
  { id: "peek", text: "While it trains, click a researcher to read their mind. They are thinking about you.", target: "map:researcher", waitFor: "action", trigger: "mindRead" },
  { id: "training", text: "Your researchers walk between the Cluster and the Hall. When the bar fills, you ship.", target: "training", waitFor: "action", trigger: "released" },
  { id: "gateway", text: "You shipped a model! Build an API Gateway to sell it.", target: "build:gateway", waitFor: "action", trigger: "gatewayBuilt", dim: true },
  { id: "runway", text: "That's money coming in. Keep an eye on Runway: it's how long your cash lasts.", target: "stat:runway", waitFor: "timer", trigger: "timer" },
  { id: "goals", text: "Next goal: {goal}. New buildings unlock as you grow.", target: "goals", waitFor: "timer", trigger: "timer" },
];
export type CoachSuggestion = { kind: "path"; tiles: [number, number][] } | { kind: "building"; building: BuildingKind; x: number; z: number };
export interface CoachMark extends Omit<CoachLine, "trigger"> {
  step: number;
  of: number;
  canSkip: true;
  suggest?: CoachSuggestion;
}
