import type { BuildingKind } from "./buildings";
import type { StaffJob } from "../sim/types";

export type Level = 1 | 2 | 3 | 4 | 5;
export type SystemId = "breakdowns" | "slop" | "leapfrog" | "arena" | "rnd" | "news" | "events" | "protests" | "disasters" | "papers" | "collusion" | "hearing" | "yacht";
export type HudPanel = "revenue" | "vibes" | "arena" | "rnd" | "thoughts" | "news" | "staff" | "events" | "papers" | "disasters";
export const HUD_PANELS: HudPanel[] = ["revenue", "vibes", "arena", "rnd", "thoughts", "news", "staff", "events", "papers", "disasters"];
export interface ProgressionLevel {
  id: string;
  level: Level;
  name: string;
  buildings: readonly BuildingKind[];
  staff: readonly StaffJob[];
  systems: readonly SystemId[];
  panels: readonly HudPanel[];
  goal: { text: string; metric: "models" | "revenue" | "team" | "arena"; target: number; vibes?: number };
}
/** Identified rows support FLT-15 add/override/remove sections; thresholds and unlocks are data. */
export const PROGRESSION: readonly ProgressionLevel[] = [
  { id: "garage", level: 1, name: "Garage", buildings: ["hall", "cluster"], staff: [], systems: [], panels: [], goal: { text: "Ship your first model", metric: "models", target: 1 } },
  { id: "business", level: 2, name: "Open for business", buildings: ["gateway", "kombucha"], staff: [], systems: [], panels: ["revenue", "vibes"], goal: { text: "Earn $20K a day", metric: "revenue", target: 20_000 } },
  { id: "team", level: 3, name: "Growing team", buildings: ["nap", "snack"], staff: ["sre", "janitor"], systems: ["breakdowns", "slop"], panels: ["thoughts", "staff"], goal: { text: "8 researchers and Vibes ≥ 500", metric: "team", target: 8, vibes: 500 } },
  { id: "race", level: 4, name: "The Race", buildings: [], staff: [], systems: ["leapfrog", "arena", "rnd", "news"], panels: ["arena", "rnd", "news"], goal: { text: "Top 5 on the Arena", metric: "arena", target: 5 } },
  { id: "scrutiny", level: 5, name: "Scrutiny", buildings: ["demo", "security"], staff: ["security", "comms"], systems: ["protests", "events", "disasters", "papers", "collusion", "hearing", "yacht"], panels: ["events", "papers", "disasters"], goal: { text: "Ship model #3", metric: "models", target: 3 } },
];
export interface UnlockCard { id: string; title: string; body: string; items: string[] }
export interface ProgressView {
  level: Level;
  levelName: string;
  unlocked: { buildings: BuildingKind[]; staff: StaffJob[]; systems: SystemId[] };
  goal: { text: string; current: number; target: number };
  teasers: { label: string; hint: string }[];
}
