// Toasts that come in bursts (FLT-54). Data only: the sim tags a toast with its group and who it names; the app's notice
// policy (`src/app/notices.ts`) folds a pile of one group into a single line. Parody names only.
import type { ToastGroup } from "../sim/types";

/**
 * A researcher reaching the gate with their box: `{name}`, `{their}`. Picked by walker id, not by the dice, so a new
 * line never moves the RNG stream.
 */
export const QUIT_LINES: readonly string[] = [
  "{name} handed in the box and left.",
  "{name} left. The desk plant stays; it has equity.",
  "{name} walked out with a box, a monitor and most of the snacks.",
  "{name} quit to 'explore what's next'. What's next is across the street.",
  "{name} left. Exit interview: one word, and the word was 'vibes'.",
  "{name} quit via a 40-slide deck. Slide 31 is about you.",
  "{name} has left the building, and the group chat, loudly.",
  "{name} handed in {their} badge and a list of demands, in that order.",
];

/** A pile of one group, as one toast: `{n}` of them, `{who}` ("A, B and C"). */
export const GROUP_LINES: Record<ToastGroup, string> = {
  quit: "{n} staff handed in the box: {who}.",
  poached: "{n} of your people got poached: {who}. The heart emojis keep coming.",
  record: "Rivals took {n} of your records: {who}.",
};
