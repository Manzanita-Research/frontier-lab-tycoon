// FLT-56: the neo labs as the map shows them: a tiny campus each beyond the fence, a sign and a valuation balloon.
import type { GameState } from "../types";
import { neoValuation, type NeoMood, type NeoOrigin } from "./state";

/** The map has lots for this many; later labs share (they are on the Arena all the same). */
export const NEO_CAMPUS_LOTS = 4;

export interface NeoCampusView {
  id: string;
  name: string;
  short: string;
  color: string;
  founder: string;
  /** How many walked out with the founder. */
  followers: number;
  origin: NeoOrigin;
  mood: NeoMood;
  nemesis: boolean;
  /** $B: the seed round times the hype (neoValuation). The balloon's size. */
  valuation: number;
}

export function neoCampusView(s: Pick<GameState, "neoLabs">): NeoCampusView[] {
  return (s.neoLabs?.labs ?? []).slice(0, NEO_CAMPUS_LOTS).map((l) => ({
    id: l.id,
    name: l.name,
    short: l.short,
    color: l.color,
    founder: l.founder,
    followers: l.followers.length,
    origin: l.origin,
    mood: l.mood,
    nemesis: l.nemesis,
    valuation: neoValuation(l),
  }));
}

/** Same campuses as last time? The snapshot keeps the old array then, so the scene doesn't re-render at 5 Hz. */
export const sameCampuses = (a: readonly NeoCampusView[], b: readonly NeoCampusView[]) =>
  a.length === b.length && a.every((x, i) => (Object.keys(x) as (keyof NeoCampusView)[]).every((k) => x[k] === b[i]![k]));
