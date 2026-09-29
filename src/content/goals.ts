// The scenario: three milestones and a deadline. Data only; the sim decides what "met" means.
export type GoalMetric = "runs" | "revenue" | "hype";

export interface GoalDef {
  id: string;
  metric: GoalMetric;
  /** Shown next to the checkbox. */
  label: string;
  target: number;
  /** How the UI formats progress: a count of runs, dollars per day, or hype points. */
  unit: "runs" | "money" | "points";
}

export const GOALS: GoalDef[] = [
  { id: "release", metric: "runs", label: "Release Frontier-4", target: 3, unit: "runs" },
  { id: "revenue", metric: "revenue", label: "Reach $250K/day revenue", target: 250_000, unit: "money" },
  { id: "hype", metric: "hype", label: "Hype 60+", target: 60, unit: "points" },
];

export const SCENARIO = {
  /** Day 360 is Y2 · Jan 1. */
  deadlineDay: 360,
  /** Cash below this after the bailout joke has had its turn ends the game. */
  brokeBelow: -2_000_000,
  winHeadline: "{lab} hits every milestone; board celebrates by raising the milestones",
  loseHeadline: "{lab} pivots to selling AI-generated NFTs of its own GPUs",
};
