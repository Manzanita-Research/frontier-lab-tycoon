// Playable v1's side of the snapshot, read defensively. The logic (FLT-49) puts `progress`, `coach`, `unlockCard` and `hud` on the
// Snapshot; a snapshot without them (an older save, a debug link, a fixture that predates the ladder) means "everything is
// earned and nobody is coaching", so the game plays as it always did. Pure: no atoms, no DOM.
import { STAFF } from "../../content/staff";
import type { CoachVM, HudPanelId, UnlockCardVM, VisibleVM } from "./types";
import { defs } from "../../sim/defs";

export const HUD_PANELS: readonly HudPanelId[] = ["revenue", "vibes", "arena", "rnd", "thoughts", "news", "staff", "events", "papers", "disasters", "factions", "birdapp"];

/** The contract, as the logic sends it. */
export interface PlayableSnapshot {
  progress?: {
    level: number;
    levelName: string;
    unlocked: { buildings: readonly string[]; staff: readonly string[]; systems: readonly string[] };
    goal: { text: string; current: number; target: number; status?: string; lowerIsBetter?: boolean; objective?: string };
    teasers: readonly { label: string; hint: string }[];
  };
  coach?: (CoachVM & { suggest?: unknown }) | null;
  unlockCard?: UnlockCardVM | null;
  hud?: { visible: Partial<Record<HudPanelId, boolean>> };
}

export interface PlayableInput {
  level: number;
  levelName: string;
  buildings: ReadonlySet<string>;
  staff: ReadonlySet<string>;
  systems: readonly string[];
  goal: { text: string; current: number; target: number; status?: string; lowerIsBetter?: boolean; objective?: string };
  teasers: readonly { label: string; hint: string }[];
  visible: VisibleVM;
  coach: CoachVM | null;
  unlock: UnlockCardVM | null;
  /** False when the snapshot carried no ladder at all (everything is earned). */
  laddered: boolean;
}

/**
 * The "New!" card lists what a level brings, and the logic sends systems as ids. Name them for people; `null` is a secret the
 * card must not spoil (collusion is only ever seen through its signs).
 */
const SYSTEM_NAMES: Record<string, string | null> = {
  breakdowns: "Breakdowns", slop: "Slop", leapfrog: "Benchmark leaderboard", arena: "The Arena", rnd: "R&D multiplier", news: "The Frontier Times",
  events: "Event cards", protests: "Protests", disasters: "Disasters", papers: "Papers: publish or perish", collusion: null,
  hearing: "The Hearing", yacht: "The yacht summit", defection: "Defection", poaching: "The Poaching War", auditors: "Evals Without Borders",
  promises: "The Promise Tracker", capture: "Regulatory Capture", factions: "Factions", birdapp: "The Bird App",
};
const unlockOf = (card: UnlockCardVM): UnlockCardVM => ({
  ...card,
  items: card.items.flatMap((item) => (item in SYSTEM_NAMES ? (SYSTEM_NAMES[item] === null ? [] : [SYSTEM_NAMES[item]!]) : [item])),
});

const everything = (on: boolean): VisibleVM => Object.fromEntries(HUD_PANELS.map((p) => [p, on])) as VisibleVM;

export function playableOf(snap: object): PlayableInput {
  const p = snap as PlayableSnapshot;
  const progress = p.progress;
  const visible = everything(!progress);
  if (p.hud?.visible) for (const id of HUD_PANELS) visible[id] = p.hud.visible[id] ?? false;
  const coach = p.coach ?? null;
  return {
    level: progress?.level ?? 5,
    levelName: progress?.levelName ?? "",
    buildings: new Set(progress ? progress.unlocked.buildings : [...Object.keys(defs().buildings), "path"]),
    staff: new Set(progress ? progress.unlocked.staff : Object.keys(STAFF)),
    systems: progress?.unlocked.systems ?? [],
    goal: progress?.goal ?? { text: "", current: 0, target: 1 },
    teasers: progress?.teasers ?? [],
    visible,
    coach: coach && { id: coach.id, step: coach.step, of: coach.of, text: coach.text, target: coach.target, waitFor: coach.waitFor, canSkip: coach.canSkip, ...(coach.dim ? { dim: true } : {}) },
    unlock: p.unlockCard ? unlockOf(p.unlockCard) : null,
    laddered: progress !== undefined,
  };
}
