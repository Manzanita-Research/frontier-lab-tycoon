// Slow down for bad news (FLT-76): at ▶▶ or ▶▶▶ the lab can fall six places on the Arena between two glances. When
// something sharp happens the game drops to 1× and pins a toast that says what it was:
//
//   the Arena    you are 2 or more places below your best since you sped up (only once the Arena is on your HUD)
//   trust        public trust is 10 or more points below its high since you sped up
//   a leak       a weights leak starts
//   a defection  someone you employed founds a lab across the fence
//
// "Since you sped up": the marks (best rank, highest trust) reset whenever the speed changes and whenever it slows you
// down, so a slide you already sat through at 1× is not news. A setting, on by default ("Slow down for bad news").
// Pure and clock-free like the notice policy; the app machine calls it on every published snapshot.
import type { Snapshot } from "./hud";
import { namesText } from "./notices";

/** Places below your best since you sped up. */
export const SHARP_RANK = 2;
/** Points of public trust below its high since you sped up. */
export const SHARP_TRUST = 10;

/** What it watches, read off the snapshot. */
export interface Look {
  /** Your Arena rank, or null while the Arena is not on your HUD. */
  rank: number | null;
  /** Public trust (0 to 100), or null while the Disasters are not on your HUD. */
  trust: number | null;
  /** Weights leaks under way, by run id. */
  leaks: readonly string[];
  /** Labs founded by people who left you: id, name and founder. */
  defections: readonly { id: string; name: string; founder: string }[];
}

export function lookOf(snap: Snapshot): Look {
  const visible = snap.hud?.visible;
  return {
    rank: visible && !visible.arena ? null : snap.race.rank,
    trust: visible && !visible.disasters ? null : snap.disasters.trust,
    leaks: snap.disasters.runs.filter((r) => r.id === "weightsLeak").map((r) => `${r.id}:${r.days}`),
    defections: (snap.neo ?? []).filter((n) => n.origin === "defection").map((n) => ({ id: n.id, name: n.name, founder: n.founder })),
  };
}

export interface Marks {
  /** The best rank since the marks were last set (1 is best). */
  rank: number | null;
  /** The highest trust since. */
  trust: number | null;
  /** The leaks and labs already known about. */
  leaks: readonly string[];
  defections: readonly string[];
}

export const marksOf = (look: Look): Marks => ({ rank: look.rank, trust: look.trust, leaks: look.leaks, defections: look.defections.map((d) => d.id) });

const lower = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));
const higher = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/**
 * What is sharp about this snapshot, as short lines ("you fell from #2 to #6 on the Arena"), and the marks to keep.
 * Nothing is sharp when `watching` is off (at 1× or paused, or the setting is off): the marks just follow along.
 */
export function sharpNews(marks: Marks, look: Look, watching: boolean): { lines: string[]; marks: Marks } {
  if (!watching) return { lines: [], marks: marksOf(look) };
  const lines: string[] = [];
  // A worse rank is a bigger number: you were #2 at best and are #4 now.
  if (marks.rank !== null && look.rank !== null && look.rank - marks.rank >= SHARP_RANK) lines.push(`you fell from #${marks.rank} to #${look.rank} on the Arena`);
  if (marks.trust !== null && look.trust !== null && marks.trust - look.trust >= SHARP_TRUST) lines.push(`public trust fell from ${Math.round(marks.trust)} to ${Math.round(look.trust)}`);
  if (look.leaks.some((l) => !marks.leaks.includes(l))) lines.push("your weights leaked");
  for (const d of look.defections) if (!marks.defections.includes(d.id)) lines.push(`${d.founder} left to found ${d.name}`);
  if (lines.length > 0) return { lines, marks: marksOf(look) };
  return {
    lines,
    marks: {
      rank: lower(marks.rank, look.rank),
      trust: higher(marks.trust, look.trust),
      // A leak that is over can come back as a new one.
      leaks: look.leaks,
      defections: [...new Set([...marks.defections, ...look.defections.map((d) => d.id)])],
    },
  };
}

/** "Slowed to 1× for bad news: you fell from #2 to #6 on the Arena and your weights leaked." */
export const slowText = (lines: readonly string[]) => `Slowed to 1× for bad news: ${namesText(lines)}.`;
