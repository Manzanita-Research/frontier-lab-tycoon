// What everyone is thinking. A walker's thought is not stored: it follows from their state, so the whole crowd can be
// read out at any moment (the Thoughts panel) and the inspector always agrees with it. Each walker has one cause at a
// time; everyone with the same cause thinks the same line (or one of `spread` lines), and the line rotates every
// couple of game days. Lines live in content/needThoughts.ts.
import { CAUSES, type Cause } from "../content/needThoughts";
import { RIVAL_SHORT } from "../content/names";
import { hourAt, isNight } from "./daylight";
import { fillTemplate } from "./format";
import { happinessOf, urgencyOf } from "./needs";
import type { GameState, Walker, WalkerKind } from "./types";

const ROTATE_DAYS = 2;

/** Loud causes are the ones worth a thought bubble: something is wrong, or someone is leaving. */
const QUIET = new Set<Cause>(["researcher.meh", "researcher.glowing", "researcher.night", "visitor.meh", "visitor.impressed", "visitor.night", "agent.aligned", "agent.night", "protester.chant"]);
export const isLoud = (cause: Cause) => !QUIET.has(cause);

/** Why this walker is thinking what they are thinking. After dark (`night`), a walker with nothing on their mind is still at it. */
export function causeOf(w: Walker, night = false): Cause {
  const phase = w.machine.value;
  switch (w.kind) {
    case "researcher": {
      if (phase === "quitting") return "researcher.boxing";
      if (phase === "queuing") return "researcher.queue";
      if (w.mess > 0) return "researcher.slop";
      if (w.lost === "energy" || w.lost === "focus" || w.lost === "fomo") return `researcher.lost.${w.lost}`;
      const tired = urgencyOf(w, "energy");
      const scattered = urgencyOf(w, "focus");
      const fomo = urgencyOf(w, "fomo");
      const worst = Math.max(tired / 0.6, scattered / 0.6, fomo / 0.4);
      if (worst >= 1) return tired / 0.6 === worst ? "researcher.tired" : scattered / 0.6 === worst ? "researcher.scattered" : "researcher.fomo";
      if (night) return "researcher.night";
      return happinessOf(w) > 0.75 ? "researcher.glowing" : "researcher.meh";
    }
    case "visitor":
      if (phase === "queuing") return "visitor.queue";
      if (w.mess > 0) return "visitor.slop";
      if (w.lost === "impressed") return "visitor.lost.impressed";
      if (w.patience < 0.3) return "visitor.bored";
      if (w.impressed > 0.7) return "visitor.impressed";
      if (w.impressed < 0.22) return "visitor.unimpressed";
      return night ? "visitor.night" : "visitor.meh";
    case "agent":
      return w.drift < 0.3 ? (night ? "agent.night" : "agent.aligned") : w.drift < 0.65 ? "agent.drifting" : "agent.drifted";
    default:
      return "protester.chant";
  }
}

const rivalName = (state: GameState) => RIVAL_SHORT[state.flags.rivalIndex ?? 0] ?? "A rival";

/** The line for a cause as this walker would say it right now. */
export function lineFor(state: GameState, cause: Cause, w: Walker): string {
  const { spread, lines } = CAUSES[cause];
  const epoch = Math.floor(state.day / ROTATE_DAYS);
  const text = lines[(epoch + (spread > 1 ? w.id % spread : 0)) % lines.length]!;
  return text.includes("{") ? fillTemplate(text, { lab: state.labName, rival: rivalName(state) }) : text;
}

/** It is dark on campus right now (the campus clock: sim/daylight.ts). */
export const isNightNow = (state: GameState): boolean => isNight(hourAt(state.tick));

export const thoughtOf = (state: GameState, w: Walker): string => lineFor(state, causeOf(w, isNightNow(state)), w);

export interface ThoughtRow {
  /** `kind|text`: what the panel highlights by. */
  key: string;
  kind: WalkerKind;
  text: string;
  count: number;
}

export const thoughtKey = (kind: WalkerKind, text: string) => `${kind}|${text}`;

/** Everyone's thoughts, counted and sorted by how many people share them. Walkers inside a building count too. */
export function thoughtBoard(state: GameState): ThoughtRow[] {
  const rows = new Map<string, ThoughtRow>();
  for (const w of state.walkers) {
    const text = thoughtOf(state, w);
    const key = thoughtKey(w.kind, text);
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { key, kind: w.kind, text, count: 1 });
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
}

/** Ids of the walkers thinking the thought behind `key`. */
export function walkersThinking(state: GameState, key: string): Set<number> {
  const ids = new Set<number>();
  for (const w of state.walkers) if (thoughtKey(w.kind, thoughtOf(state, w)) === key) ids.add(w.id);
  return ids;
}
