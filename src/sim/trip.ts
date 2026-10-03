// FLT-105: the trip, and the researchers it leaves somewhere else for a while. Generic: ACID MOD(E) is the first mod to
// use it, through the `trip.start`, `trip.end`, `people.spell` and `capability.boost` verbs. The sim keeps only when a
// trip starts and ends and who is away; how it looks is the presentation's (ui/juice/trip.ts).
import { TICKS_PER_DAY } from "./constants";
import { defs } from "./defs";
import { fillTemplate } from "./format";
import { addNews, addToast } from "./news";
import { refreshBoard } from "./race/arena";
import type { Rng } from "./rng";
import type { GameState, SpellFate, Walker } from "./types";
import { resign } from "./walkers";

export const SPELL_FATES: readonly SpellFate[] = ["back", "bonus", "quit"];

export interface TripStart {
  owner: string;
  days: number;
  rise?: number;
  fade?: number;
  label?: string;
  lines?: string[];
}

/** Start a trip now (or restart the one under way). Days in, ticks on the World. */
export function startTrip(state: GameState, t: TripStart) {
  state.trip = {
    owner: t.owner,
    label: t.label ?? "",
    start: state.tick,
    end: state.tick + Math.round(Math.max(0, t.days) * TICKS_PER_DAY),
    rise: Math.max(1, Math.round((t.rise ?? 1) * TICKS_PER_DAY)),
    fade: Math.max(1, Math.round((t.fade ?? 1.5) * TICKS_PER_DAY)),
    lines: t.lines ?? [],
  };
}

/** It starts wearing off now. */
export function endTrip(state: GameState) {
  if (state.trip && state.trip.end > state.tick) state.trip.end = state.tick;
}

/** A breakthrough: `pct` per cent of today's capability, plus `amount`. The Arena hears at once. */
export function boostCapability(state: GameState, pct: number, amount: number) {
  state.capability = Math.max(0, state.capability * (1 + pct / 100) + amount);
  refreshBoard(state);
}

export interface SpellCast {
  owner: string;
  chance: number;
  days: number;
  minDays?: number;
  max?: number;
  lines: string[];
  fates: SpellFate[];
  afters?: string[];
  bonus?: number;
}

const away = (w: Walker) => w.kind === "researcher" && !w.spell && w.machine.value !== "quitting" && w.machine.value !== "leaving";

/** Each researcher rolls `chance` to go somewhere, up to `max`; each who does gets one of the lines, its fate and its after. */
export function castSpells(state: GameState, rng: Rng, c: SpellCast): number {
  if (c.lines.length === 0) return 0;
  const max = c.max ?? Infinity;
  const lo = Math.max(1, Math.min(c.minDays ?? Math.ceil(c.days / 2), c.days));
  let cast = 0;
  for (const w of state.walkers) {
    if (cast >= max) break;
    if (!away(w) || !rng.chance(c.chance)) continue;
    // Deal the lines round in order from a random start, so three people get three different ones.
    const i = (rng.int(0, c.lines.length - 1) + cast) % c.lines.length;
    w.spell = { line: c.lines[i]!, until: state.day + rng.int(lo, Math.max(lo, c.days)), fate: c.fates[i] ?? "back", owner: c.owner };
    const after = c.afters?.[i];
    if (after) w.spell.after = after;
    if (c.bonus) w.spell.bonus = c.bonus;
    cast++;
  }
  return cast;
}

const DEFAULT_AFTER: Record<SpellFate, string> = {
  back: "{name} is back at {their} desk. Doesn't want to talk about it.",
  bonus: "{name} is back, with an idea nobody can explain and everybody can use.",
  quit: "{name} did not come back. Sends {their} regards.",
};

/** Midnight: the trip wears off on schedule, and anyone whose days are up comes back (or doesn't). */
export function dailyTrip(state: GameState, rng: Rng) {
  const trip = state.trip;
  if (trip && state.tick >= trip.end + trip.fade) delete state.trip;
  for (const w of state.walkers) {
    const spell = w.spell;
    if (!spell || state.day < spell.until) continue;
    delete w.spell;
    const text = fillTemplate(spell.after || DEFAULT_AFTER[spell.fate], { name: w.name, their: defs().names.THEIR[w.pro] ?? "their", lab: state.labName });
    const source = `mod:${spell.owner}` as const;
    if (spell.fate === "quit") {
      if (w.machine.value === "quitting" || w.machine.value === "leaving") continue;
      state.flags[`quietExit:${w.id}`] = state.day;
      resign(state, w, rng);
      addNews(state, text, "joke");
    } else if (spell.fate === "bonus") {
      boostCapability(state, spell.bonus ?? 2, 0);
      w.energy = Math.min(1, w.energy + 0.3);
      w.focus = Math.min(1, w.focus + 0.3);
      addToast(state, text, "good", { source, importance: "you" });
    } else addToast(state, text, "neutral", { source, importance: "world" });
  }
}
