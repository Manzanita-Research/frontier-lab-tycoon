import type { BuildingKind } from "./buildings";
import type { StaffJob } from "../sim/types";

export type Level = 1 | 2 | 3 | 4 | 5;
/** Every system a ladder row can unlock (the mod schema's list too). `factions` is FLT-33: the meters at Level 4. */
export const SYSTEM_IDS = ["breakdowns", "slop", "leapfrog", "arena", "rnd", "news", "events", "protests", "disasters", "papers", "collusion", "hearing", "yacht", "defection", "poaching", "auditors", "capture", "promises", "factions"] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];
export const HUD_PANELS = ["revenue", "vibes", "arena", "rnd", "thoughts", "news", "staff", "events", "papers", "disasters", "factions"] as const;
export type HudPanel = (typeof HUD_PANELS)[number];
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
  /**
   * FLT-54: systems of this rung that wake later, `after` game days after it opens, one at a time, each with its own small
   * New! card (`title`, `body`). `silent` wakes with no card (a system that is a secret until it is exposed). The rung's other
   * systems wake with it. A system listed here must also be in `systems`.
   */
  wakes?: readonly Wake[];
}
export interface Wake { id: SystemId; after: number; title: string; body: string; silent?: boolean }
/**
 * Scrutiny, one problem at a time (FLT-54): the protests and the event cards come with the rung, then roughly one pack every
 * ten game days, the loudest first. Collusion is a secret until the auditors or a leak expose it, so it wakes without a card.
 */
export const SCRUTINY_WAKES: readonly Wake[] = [
  { id: "disasters", after: 6, title: "New! Disasters", body: "Things can now go wrong on their own. The fire extinguishers are on back order." },
  { id: "hearing", after: 16, title: "New! The Hearing", body: "The Senate has learned your lab exists. Somebody find a tie." },
  { id: "yacht", after: 26, title: "New! The Safety Summit", body: "You're invited to a safety summit. It's on a yacht. The yacht has no lifeboats, for vibes." },
  { id: "defection", after: 36, title: "New! Defection", body: "Your researchers have noticed they could start their own lab. Using your researchers." },
  { id: "poaching", after: 46, title: "New! The Poaching War", body: "Rival labs now make offers to your people. The offers have a lot of zeros." },
  { id: "collusion", after: 52, title: "", body: "", silent: true },
  { id: "papers", after: 56, title: "New! Papers", body: "You can publish research now. Or not publish it. Both count as a strategy." },
  { id: "auditors", after: 66, title: "New! Evals Without Borders", body: "The auditors are coming. Tidy up. Hide nothing. Fine, hide a little." },
  { id: "promises", after: 76, title: "New! The Promise Tracker", body: "Somebody is writing down everything you ever said on a podcast." },
  { id: "capture", after: 86, title: "New! Regulatory Capture", body: "The Senate is writing the rules for AI. Somebody left a pen out." },
];
/** Identified rows support FLT-15 add/override/remove sections; thresholds and unlocks are data. */
export const PROGRESSION: readonly ProgressionLevel[] = [
  { id: "garage", level: 1, name: "Garage", buildings: ["hall", "cluster"], staff: [], systems: [], panels: [], goal: { text: "Ship your first model", metric: "models", target: 1 } },
  { id: "business", level: 2, name: "Open for business", buildings: ["gateway", "kombucha"], staff: [], systems: [], panels: ["revenue", "vibes"], goal: { text: "Earn $40K a day and give 12 visitors the tour", metric: "business", target: 40_000, visitors: 12 } },
  { id: "team", level: 3, name: "Growing team", buildings: ["nap", "snack"], staff: ["sre", "janitor"], systems: ["breakdowns", "slop"], panels: ["thoughts", "staff"], goal: { text: "Hire an SRE and a Janitor Bot: mop 20 puddles and fix what breaks", metric: "ops", target: 20 } },
  { id: "race", level: 4, name: "The Race", buildings: [], staff: [], systems: ["leapfrog", "arena", "rnd", "news", "factions"], panels: ["arena", "rnd", "news", "factions"], goal: { text: "Top 3 on the Arena", metric: "arena", target: 3 } },
  { id: "scrutiny", level: 5, name: "Scrutiny", buildings: ["demo", "security"], staff: ["security", "comms"], systems: ["protests", "events", "disasters", "papers", "collusion", "hearing", "yacht", "defection", "poaching", "auditors", "promises", "capture"], panels: ["events", "papers", "disasters"], goal: { text: "Ship 3 models", metric: "models", target: 3 }, wakes: SCRUTINY_WAKES },
];
export interface UnlockCard { id: string; title: string; body: string; items: string[] }
export interface ProgressView {
  level: Level;
  levelName: string;
  unlocked: { buildings: BuildingKind[]; staff: StaffJob[]; systems: SystemId[] };
  /** `status` is the goal's progress as the HUD says it ("$26K of $40K a day · 3 of 12 visitors"). */
  /** `lowerIsBetter` for a rank: #6 of a Top 3 goal is half way. */
  /** `objective` is set once the ladder is done: the goal is then that scenario objective (a GoalDef id). */
  goal: { text: string; current: number; target: number; status?: string; lowerIsBetter?: boolean; objective?: string };
  teasers: { label: string; hint: string }[];
}
