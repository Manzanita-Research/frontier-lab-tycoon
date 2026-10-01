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
  /** FLT-86: days in a row the metric must stay at the target before it counts (not set: the day it gets there). */
  hold?: number;
  /** The final-stretch beat's line when this is the last one left. */
  stretch?: string;
}

export const GOALS: GoalDef[] = [
  { id: "release", metric: "runs", label: "Ship 3 models", target: 3, unit: "runs", stretch: "One more model to ship. The board has booked the champagne; the champagne has a cancellation policy." },
  { id: "era", metric: "era", label: "Reach Era 3: Superhuman Coder", target: 3, unit: "era", stretch: "Only Era 3 left. Marketing has already printed \"Superhuman\" on the tote bags." },
  // The metric counts places from the bottom, so "higher is better" holds for every goal: #3 of 7 is 5.
  // FLT-86: held for 30 days, so the last objective is a month of defending a place, not a lucky Tuesday.
  {
    id: "arena", metric: "arena", label: "Hold Top 3 on the Arena for 30 days in Era 3", target: ARENA_SIZE + 1 - 3, unit: "rank", hold: 30,
    stretch: "Only the Arena left: top 3 for 30 days in a row. The board has booked the champagne and is refreshing the leaderboard.",
  },
];

/** FLT-86: what the objectives say as they land. */
export const GOAL_TEXT = {
  met: "Objective met: {label}. {done} of {total}.",
  stretch: "Final stretch",
  holding: "Top 3 on the Arena. Hold it for {hold} days and the scenario is yours.",
  slipped: "You slipped to #{rank} after {held} days. The champagne goes back in the fridge; the count starts again.",
  won: "Scenario complete",
};

export const SCENARIO = {
  /** Day 1080 is Y4 · Jan 1: the end of Y3, about 45 minutes of play. */
  deadlineDay: 1080,
  winHeadline: "{lab} hits every milestone; board celebrates by raising the milestones",
  loseHeadline: "{lab} pivots to selling AI-generated NFTs of its own GPUs",
};
