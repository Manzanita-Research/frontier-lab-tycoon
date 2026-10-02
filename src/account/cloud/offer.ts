import type { SaveHead, SaveSummary } from "../contract";

/** What the decisions below need of a save on this computer (FLT-65's SaveMeta has all of it). */
export interface LocalSave {
  slot: string;
  savedAt: string;
  seed: number;
  lab: string;
  day: number;
}

const at = (savedAt: string) => {
  const t = Date.parse(savedAt);
  return Number.isFinite(t) ? t : -Infinity;
};

/** Two saves of the same lab (one may be further along than the other). */
export const sameLab = (a: Pick<SaveHead, "seed" | "lab">, b: Pick<SaveHead, "seed" | "lab">) => a.seed === b.seed && a.lab === b.lab;

/**
 * "Continue from the cloud": the cloud's newest save, when it is newer than this computer's newest and not already
 * here. Saves written since the player left to log on (`awayAt`) don't count: leaving the page autosaves the lab on
 * screen, and on a new computer that is a fresh garage, which must not hide the lab waiting in the cloud.
 */
export function cloudOffer(local: readonly LocalSave[], cloud: readonly SaveSummary[], awayAt: number | null = null): SaveSummary | null {
  let best: SaveSummary | null = null;
  for (const c of cloud) if (!best || at(c.head.savedAt) > at(best.head.savedAt)) best = c;
  if (!best) return null;
  const newest = best;
  if (local.some((l) => l.savedAt === newest.head.savedAt && sameLab(l, newest.head))) return null;
  const counted = local.filter((l) => awayAt === null || at(l.savedAt) < awayAt);
  const localAt = Math.max(-Infinity, ...counted.map((l) => at(l.savedAt)));
  return at(newest.head.savedAt) > localAt ? newest : null;
}

/**
 * The local saves to send up once a member's cloud is in reach: every slot newer here than there (a guest's labs go up
 * at their first log-on; a save that missed its upload as the tab closed goes up on the next visit).
 */
export function catchUp(local: readonly LocalSave[], cloud: readonly SaveSummary[]): string[] {
  return local.filter((l) => {
    const c = cloud.find((s) => s.slot === l.slot);
    return !c || at(l.savedAt) > at(c.head.savedAt);
  }).map((l) => l.slot);
}

/**
 * The cloud's autosave is kept when this computer's would replace it with a different lab that isn't as far along:
 * a fresh garage started on a new computer never writes over the lab you've been building. (Saving to a slot always
 * goes up; the autosave follows once the new lab passes the old one.)
 */
export const keepsCloudAuto = (cloud: SaveHead | null, mine: Pick<SaveHead, "seed" | "lab" | "day">) =>
  cloud !== null && !sameLab(cloud, mine) && cloud.day > mine.day;
