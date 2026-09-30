import { eraOfState } from "../sim/race/race";
import type { GameState } from "../sim/types";

/** The era the World is in (FLT-9's era machine): "1" to "4". The era sting and the key change of the music follow it. */
export function worldEra(w: GameState): string {
  return String(eraOfState(w));
}

/** Ids of the buildings that are out of order (FLT-10's breakdowns), for the breakdown alarm: a new id in the list is a new fire. */
export function breakdownSignature(w: GameState): string {
  return w.buildings.filter((b) => b.broken).map((b) => b.id).join(",");
}

export interface WorldSound {
  era: string;
  broken: string;
}

export const soundSnapshot = (w: GameState): WorldSound => ({ era: worldEra(w), broken: breakdownSignature(w) });

/**
 * Which one-shot cues the World's changes since `last` call for: the era sting when the era moves on, the breakdown
 * alarm when a building that was not broken is. A repair (an id leaving the list) is silent.
 */
export function soundCues(last: WorldSound, now: WorldSound): ("era" | "breakdown")[] {
  const cues: ("era" | "breakdown")[] = [];
  if (now.era !== last.era) cues.push("era");
  const before = new Set(last.broken.split(",").filter(Boolean));
  if (now.broken.split(",").some((id) => id && !before.has(id))) cues.push("breakdown");
  return cues;
}
