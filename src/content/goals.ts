// The scenario: three milestones and a deadline. Data only; the sim decides what "met" means.
import { ARENA_SIZE } from "./rivals";

export type GoalMetric = "runs" | "revenue" | "hype" | "era" | "arena";

export interface GoalDef {
  id: string;
  metric: GoalMetric;
  /** Shown next to the checkbox. */
  label: string;
  target: number;
  /** How the UI formats progress: runs, dollars per day, hype points, an era, or an Arena place. */
  unit: "runs" | "money" | "points" | "era" | "rank";
}

export const GOALS: GoalDef[] = [
  { id: "release", metric: "runs", label: "Ship 3 models", target: 3, unit: "runs" },
  { id: "era", metric: "era", label: "Reach Era 3: Superhuman Coder", target: 3, unit: "era" },
  // The metric counts places from the bottom, so "higher is better" holds for every goal: #3 of 7 is 5.
  { id: "arena", metric: "arena", label: "Top 3 on the Arena in Era 3", target: ARENA_SIZE + 1 - 3, unit: "rank" },
];

export const SCENARIO = {
  /** Day 1080 is Y4 · Jan 1: the end of Y3, about 45 minutes of play. */
  deadlineDay: 1080,
  /** Cash below this after the bailout joke has had its turn ends the game. */
  brokeBelow: -2_000_000,
  winHeadline: "{lab} hits every milestone; board celebrates by raising the milestones",
  loseHeadline: "{lab} pivots to selling AI-generated NFTs of its own GPUs",
};
