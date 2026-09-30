import type { BuildingKind } from "./buildings";

export type CoachTarget = "start" | "build:path" | "build:hall" | "training" | "build:gateway" | "stat:runway" | "goals" | "map:suggest";
export type CoachTrigger = "buildPanelOpened" | "pathConnected" | "hallBuilt" | "released" | "gatewayBuilt" | "timer";
export interface CoachLine {
  id: string;
  text: string;
  target: CoachTarget;
  waitFor: "action" | "timer";
  trigger: CoachTrigger;
}
/** Jem's approved copy, FLT-47. Keep instructions and satire separate. */
export const COACH: readonly CoachLine[] = [
  { id: "start", text: "Welcome to your lab. Everything you build starts here. Click Start.", target: "start", waitFor: "action", trigger: "buildPanelOpened" },
  { id: "path", text: "Start with a path. Draw it from the gate. Everyone in your lab walks on paths.", target: "build:path", waitFor: "action", trigger: "pathConnected" },
  { id: "hall", text: "Now a Training Hall. Put it next to your path. It turns compute into a model.", target: "build:hall", waitFor: "action", trigger: "hallBuilt" },
  { id: "training", text: "Your first model is training. Your researchers walk between the Cluster and the Hall. Speed it up with ▶▶ if you like.", target: "training", waitFor: "action", trigger: "released" },
  { id: "gateway", text: "You shipped a model! Build an API Gateway to sell it.", target: "build:gateway", waitFor: "action", trigger: "gatewayBuilt" },
  { id: "runway", text: "That's money coming in. Keep an eye on Runway: it's how long your cash lasts.", target: "stat:runway", waitFor: "timer", trigger: "timer" },
  { id: "goals", text: "Next goal: earn $20K a day. New buildings unlock as you grow.", target: "goals", waitFor: "timer", trigger: "timer" },
];
export type CoachSuggestion = { kind: "path"; tiles: [number, number][] } | { kind: "building"; building: BuildingKind; x: number; z: number };
export interface CoachMark extends Omit<CoachLine, "trigger"> {
  step: number;
  of: number;
  canSkip: true;
  suggest?: CoachSuggestion;
}
