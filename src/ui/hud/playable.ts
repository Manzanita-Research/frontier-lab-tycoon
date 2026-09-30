// Playable v1's side of the snapshot, read defensively. The logic (FLT-49) puts `progress`, `coach`, `unlockCard` and `hud` on the
// Snapshot; a snapshot without them (an older save, a debug link, a fixture that predates the ladder) means "everything is
// earned and nobody is coaching", so the game plays as it always did. Pure: no atoms, no DOM.
import { BUILDINGS } from "../../content/buildings";
import { STAFF } from "../../content/staff";
import type { CoachVM, HudPanelId, UnlockCardVM, VisibleVM } from "./types";

export const HUD_PANELS: readonly HudPanelId[] = ["revenue", "vibes", "arena", "rnd", "thoughts", "news", "staff", "events", "papers", "disasters"];

/** The contract, as the logic sends it. */
export interface PlayableSnapshot {
  progress?: {
    level: number;
    levelName: string;
    unlocked: { buildings: readonly string[]; staff: readonly string[]; systems: readonly string[] };
    goal: { text: string; current: number; target: number };
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
  goal: { text: string; current: number; target: number };
  teasers: readonly { label: string; hint: string }[];
  visible: VisibleVM;
  coach: CoachVM | null;
  unlock: UnlockCardVM | null;
  /** False when the snapshot carried no ladder at all (everything is earned). */
  laddered: boolean;
}

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
    buildings: new Set(progress ? progress.unlocked.buildings : [...Object.keys(BUILDINGS), "path"]),
    staff: new Set(progress ? progress.unlocked.staff : Object.keys(STAFF)),
    systems: progress?.unlocked.systems ?? [],
    goal: progress?.goal ?? { text: "", current: 0, target: 1 },
    teasers: progress?.teasers ?? [],
    visible,
    coach: coach && { id: coach.id, step: coach.step, of: coach.of, text: coach.text, target: coach.target, waitFor: coach.waitFor, canSkip: coach.canSkip },
    unlock: p.unlockCard ?? null,
    laddered: progress !== undefined,
  };
}
