// Found a new lab (FLT-57): New Game+ lite. The endings that stop time (Acqui-hired, The Pivot) end on this button.
// The next lab is a fresh World on a fresh seed, with the old lab's name and a sequel subtitle ("Reward Hacking
// Holdings 2: This Time It's Aligned"), no coach (you've done this before), and one perk carried over: a famous
// founder (hype), a loyal researcher (training, while they stay) or a second-time founder premium (cash).
import { THOUGHT_TICKS } from "../constants";
import { fillTemplate, formatMoney } from "../format";
import { addNews } from "../news";
import { continueTutorial } from "../tutorial";
import type { GameState, Walker } from "../types";
import { memoPace } from "./memo";
import { ENDING_RULES, type PerkDef, type PerkId } from "./pack";

/** What a refounded World remembers of the labs before it. Absent on Lab #1. */
export interface Lineage {
  /** 2 for the first sequel. */
  lab: number;
  /** The first lab's name, which every sequel keeps. */
  founder: string;
  perk: PerkId;
  /** The loyal researcher (perk "loyal"): the walker who followed you, while they stay. */
  loyal: { id: number; name: string } | null;
  /** How the last lab went. */
  from: { lab: string; ending: string | null; day: number };
}

const RULES = ENDING_RULES.newLab;
export const PERKS: readonly PerkDef[] = RULES.perks;
export const perkById = (id: string): PerkDef | undefined => PERKS.find((p) => p.id === id);

/** "2: This Time It's Aligned", then "3: Return Of The Founder", ... and past the list, "9: We Mean It This Time". */
export function sequelSuffix(n: number): string {
  return RULES.sequels[n - 2] ?? fillTemplate(RULES.sequel, { n: String(n) });
}

export const labNumberOf = (s: GameState): number => s.lineage?.lab ?? 1;

/** The name the next lab would get. */
export function nextLabName(s: GameState): string {
  return `${s.lineage?.founder ?? s.labName} ${sequelSuffix(labNumberOf(s) + 1)}`;
}

/** The researcher who follows you out: the happiest one (most energy and focus, least FOMO; the oldest on a tie). */
export function loyalCandidate(s: GameState): Walker | null {
  let best: Walker | null = null;
  let bestScore = -Infinity;
  for (const w of s.walkers) {
    if (w.kind !== "researcher") continue;
    const score = w.energy + w.focus - w.fomo;
    if (score > bestScore) {
      best = w;
      bestScore = score;
    }
  }
  return best;
}

const amountOf = (p: PerkDef) => (p.id === "seed" ? formatMoney(p.amount) : String(p.amount));

export interface RefoundView {
  /** The next lab's name, and its number (Lab #2). */
  name: string;
  labNumber: number;
  perks: { id: PerkId; label: string; blurb: string }[];
}

/** The "Found a new lab" choices, for the end screen. */
export function refoundView(s: GameState): RefoundView {
  const loyal = loyalCandidate(s)?.name ?? RULES.loyal.fallback;
  return {
    name: nextLabName(s),
    labNumber: labNumberOf(s) + 1,
    perks: PERKS.map((p) => ({ id: p.id, label: p.label, blurb: fillTemplate(p.blurb, { amount: amountOf(p), name: loyal }) })),
  };
}

/**
 * Turn a fresh World (`next`, just created on a new seed) into the sequel to `prev`. Pure on the two Worlds: no dice,
 * so the new seed's RNG stream is exactly what a first lab on that seed would draw.
 */
export function applyLineage(next: GameState, prev: GameState, perkId: PerkId) {
  const perk = perkById(perkId) ?? PERKS[0]!;
  const lab = labNumberOf(prev) + 1;
  const founder = prev.lineage?.founder ?? prev.labName;
  next.labName = `${founder} ${sequelSuffix(lab)}`;
  let loyal: Lineage["loyal"] = null;
  if (perk.id === "founder") next.hype = Math.min(100, next.hype + perk.amount);
  else if (perk.id === "seed") next.cash += perk.amount;
  else {
    const name = loyalCandidate(prev)?.name ?? RULES.loyal.fallback;
    const who = next.walkers.find((w) => w.kind === "researcher");
    if (who) {
      who.name = name;
      who.role = RULES.loyal.role;
      next.thoughts = next.thoughts.filter((t) => t.walkerId !== who.id);
      next.thoughts.push({ id: next.nextId++, walkerId: who.id, kind: who.kind, text: RULES.loyal.thought, expiresTick: next.tick + THOUGHT_TICKS });
      loyal = { id: who.id, name };
    }
  }
  next.lineage = { lab, founder, perk: perk.id, loyal, from: { lab: prev.labName, ending: prev.endings?.id ?? null, day: prev.endings?.endedDay ?? prev.day } };
  // A second-time founder skips the coach.
  continueTutorial(next, true);
  addNews(next, fillTemplate(RULES.opening, { lab: next.labName }), "good");
}

/** The loyal researcher's pull on training, while they're still on campus. */
export function lineagePace(s: GameState): number {
  const loyal = s.lineage?.loyal;
  if (!loyal || !s.walkers.some((w) => w.id === loyal.id)) return 1;
  return 1 + (perkById("loyal")?.amount ?? 0) / 100;
}

/** Everything FLT-57 does to training speed: 1 in a first lab that hasn't answered the Memo (and in every golden). */
export const trainingPace = (s: GameState): number => memoPace(s) * lineagePace(s);
