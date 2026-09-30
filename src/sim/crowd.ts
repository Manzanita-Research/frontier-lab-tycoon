// The daily pass over the crowd: rivals rattle the researchers, moods shift, resignations land, the Vibes update.
import { stepMood, type MoodLevel } from "./machines/mood";
import { moodFor, happinessOf, RIVAL_FOMO } from "./needs";
import type { Rng } from "./rng";
import { dailyVibes } from "./vibes";
import type { GameState, Walker } from "./types";
import { resign } from "./walkers";

/** Chance a given researcher got a call from the rival that just shipped (and said no thanks). */
const OFFER_CHANCE = 0.15;

const EVENT: Record<Exclude<MoodLevel, "resigned">, "LIFT" | "SLUMP" | "CRASH"> = { content: "LIFT", slumped: "SLUMP", miserable: "CRASH" };

/** A rival shipped today (dailyNews leaves a flag): everyone gets a bout of fomo, and some get a phone call. */
function rivalShock(state: GameState, rng: Rng) {
  if (state.flags.rivalShippedDay !== state.day) return;
  for (const w of state.walkers) {
    if (w.kind !== "researcher") continue;
    w.fomo = Math.min(1, w.fomo + RIVAL_FOMO);
    if (rng.chance(OFFER_CHANCE)) {
      w.stats.offers++;
      w.stats.rival = state.flags.rivalIndex ?? 0;
    }
  }
}

/** Move one walker's mood to where their happiness says it belongs; a researcher on day five of misery hands in the box. */
function settleMood(state: GameState, w: Walker, rng: Rng) {
  const now = w.mood.value;
  if (now === "resigned") return;
  const want = moodFor(happinessOf(w), now);
  if (want !== now) w.mood = stepMood(w.mood, { type: EVENT[want as Exclude<MoodLevel, "resigned">] }).stored;
  if (w.kind !== "researcher" || w.mood.value !== "miserable") return;
  const day = stepMood(w.mood, { type: "DAY" });
  w.mood = day.stored;
  if (day.effects.length > 0) resign(state, w, rng);
}

export function dailyCrowd(state: GameState, rng: Rng) {
  rivalShock(state, rng);
  for (const w of state.walkers) if (w.kind === "researcher" || w.kind === "visitor") settleMood(state, w, rng);
  dailyVibes(state);
}
