// Friend links (FLT-57): the share URL carries a run's result and its seed, so a friend plays the same lab and sees
// "Your friend's lab was Captured on day 212. Beat it?". It encodes game results only: the ending, the day it came,
// peak Vibes and models released, plus the seed (or Today's lab's date). Never the lab's name, the streak, or anything
// about the person. `?seed=…&vs=captured.212.88.7`; the seed part is what `readDebugParams` already understands.
import { ENDINGS } from "../../sim/endings/pack";

export interface RunResult {
  ending: string;
  day: number;
  vibes: number;
  models: number;
}

export interface Challenge extends RunResult {
  seed: number;
  /** Today's lab's date key ("2026-09-30"), or null for an ordinary seed. */
  daily: string | null;
}

export type Verdict = "win" | "lose" | "tie";

const MAX = 1_000_000;
const DATE = /^\d{4}-\d\d-\d\d$/;
const whole = (s: string | undefined) => (s !== undefined && /^\d{1,7}$/.test(s) ? Number(s) : null);
const seedNum = (s: string | null) => (s !== null && /^\d{1,10}$/.test(s) && Number(s) >= 1 && Number(s) < 2 ** 32 ? Number(s) : null);
const endingOf = (id: string) => ENDINGS.find((e) => e.id === id);

/** The query string: `seed=daily&date=2026-09-30&vs=…` for Today's lab, `seed=123&vs=…` otherwise. */
export function challengeQuery(c: Challenge): string {
  const q = new URLSearchParams();
  if (c.daily) {
    q.set("seed", "daily");
    q.set("date", c.daily);
  } else q.set("seed", String(c.seed));
  q.set("vs", [c.ending, c.day, c.vibes, c.models].map((x) => (typeof x === "number" ? Math.max(0, Math.min(MAX, Math.round(x))) : x)).join("."));
  return q.toString();
}

/** The link itself, on this page's address (`base` is origin + path, no query). */
export const challengeUrl = (base: string, c: Challenge) => `${base}?${challengeQuery(c)}`;

/**
 * Read a challenge from a query string, or null if there isn't a sound one. `seedOf` turns a date key into its seed
 * (src/sim/daily.ts), so a pinned date replays that day's lab.
 */
export function parseChallenge(search: string, seedOf: (daily: string) => number): Challenge | null {
  const q = new URLSearchParams(search);
  const parts = q.get("vs")?.split(".") ?? [];
  if (parts.length !== 4) return null;
  const [ending, dayS, vibesS, modelsS] = parts;
  const day = whole(dayS);
  const vibes = whole(vibesS);
  const models = whole(modelsS);
  if (!ending || !endingOf(ending) || day === null || vibes === null || models === null) return null;
  const daily = q.get("seed") === "daily" && DATE.test(q.get("date") ?? "") ? q.get("date")! : null;
  const seed = daily ? seedOf(daily) : seedNum(q.get("seed"));
  if (seed === null) return null;
  return { ending, day, vibes, models, seed, daily };
}

const TONE_RANK: Record<string, number> = { good: 2, neutral: 1, bad: 0 };

/**
 * Who did better. A better ending wins (The Takeover over Regulated over Acqui-hired). Between the same kind of
 * ending: a good or neutral one got there sooner, a bad one held out longer. Then peak Vibes, then models.
 */
export function compareRuns(mine: RunResult, theirs: RunResult): Verdict {
  const tone = (r: RunResult) => TONE_RANK[endingOf(r.ending)?.tone ?? "bad"] ?? 0;
  const by = [
    tone(mine) - tone(theirs),
    (tone(mine) === 0 ? 1 : -1) * (mine.day - theirs.day),
    mine.vibes - theirs.vibes,
    mine.models - theirs.models,
  ].find((d) => d !== 0);
  return by === undefined ? "tie" : by > 0 ? "win" : "lose";
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  win: "You beat your friend's lab.",
  lose: "Your friend's lab wins. Rematch?",
  tie: "A dead heat. Suspicious.",
};

/** "Your friend's lab was Captured on day 212." */
export function challengeLine(c: RunResult): string {
  const e = endingOf(c.ending);
  return `Your friend's lab ${e?.brag ?? "ended"} on day ${c.day.toLocaleString("en-US")}.`;
}
