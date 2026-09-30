import type { BuildingKind } from "./buildings";
import type { StaffJob } from "../sim/types";

export type Level = 1 | 2 | 3 | 4 | 5;
export type SystemId = "breakdowns" | "slop" | "leapfrog" | "arena" | "rnd" | "news" | "events" | "protests" | "disasters" | "papers" | "collusion";
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
  /**
   * `business` is revenue a day (`target`) and `visitors` shown round (any building they went into); `ops` is `target`
   * puddles mopped, with an SRE and a Janitor Bot on the payroll and every breakdown fixed. The others count one number.
   */
  goal: { text: string; metric: "models" | "revenue" | "team" | "arena" | "business" | "ops"; target: number; vibes?: number; visitors?: number };
}
/** Identified rows support FLT-15 add/override/remove sections; thresholds and unlocks are data. */
export const PROGRESSION: readonly ProgressionLevel[] = [
  { id: "garage", level: 1, name: "Garage", buildings: ["hall", "cluster"], staff: [], systems: [], panels: [], goal: { text: "Ship your first model", metric: "models", target: 1 } },
  { id: "business", level: 2, name: "Open for business", buildings: ["gateway", "kombucha"], staff: [], systems: [], panels: ["revenue", "vibes"], goal: { text: "Earn $40K a day and give 12 visitors the tour", metric: "business", target: 40_000, visitors: 12 } },
  { id: "team", level: 3, name: "Growing team", buildings: ["nap", "snack"], staff: ["sre", "janitor"], systems: ["breakdowns", "slop"], panels: ["thoughts", "staff"], goal: { text: "Hire an SRE and a Janitor Bot: mop 20 puddles and fix what breaks", metric: "ops", target: 20 } },
  { id: "race", level: 4, name: "The Race", buildings: [], staff: [], systems: ["leapfrog", "arena", "rnd", "news"], panels: ["arena", "rnd", "news"], goal: { text: "Top 3 on the Arena", metric: "arena", target: 3 } },
  { id: "scrutiny", level: 5, name: "Scrutiny", buildings: ["demo"], staff: ["security", "comms"], systems: ["protests", "events", "disasters", "papers", "collusion"], panels: ["events", "papers", "disasters"], goal: { text: "Ship 3 models", metric: "models", target: 3 } },
];
export interface UnlockCard { id: string; title: string; body: string; items: string[] }
export interface ProgressView {
  level: Level;
  levelName: string;
  unlocked: { buildings: BuildingKind[]; staff: StaffJob[]; systems: SystemId[] };
  /** `status` is the goal's progress as the HUD says it ("$26K of $40K a day · 3 of 12 visitors"). */
  /** `lowerIsBetter` for a rank: #6 of a Top 3 goal is half way. */
  goal: { text: string; current: number; target: number; status?: string; lowerIsBetter?: boolean };
  teasers: { label: string; hint: string }[];
}
