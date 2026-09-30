// What the World keeps for the factions (FLT-33). Plain JSON, absent until Level 4 turns the system on, so a run
// without it (and every older save) is byte-identical.
import { defs } from "../defs";
import { initialStored } from "../machines/run";
import type { GameState } from "../types";
import { factionMoodMachine, relationMachine, type FactionMoodStored, type RelationStored } from "./machines";
import type { Axis, FactionDef } from "../../content/factions";
import { arcMachine } from "../machines/arc";
import { EVENT_COOLDOWN_DAYS } from "../../content/events";

export interface FactionLogItem {
  id: number;
  day: number;
  text: string;
  tone: "good" | "bad" | "neutral" | "joke";
  /** The factions it is about, for the panel's colour dots. */
  factions: string[];
}

/** What the driver last saw of the rest of the World, so it can tell what changed today. */
export interface Seen {
  models: number;
  ships: number;
  holds: number;
  leaks: number;
  openModel: number;
  raisedSafety: number;
  ignoredWater: number;
  policy: string;
  /** How many buildings of each kind stood, so a new cluster (or fountain) is news. */
  built: Record<string, number>;
}

export interface FactionsState {
  /** The factions' own dice, so turning them on never shifts the main stream's draws. */
  rngState: number;
  /** The safety budget, 0 (none) to 3 (lavish): costs money every day and slows training, and the Safetyists notice. */
  safety: number;
  /** One mood machine per faction, by id; its context keeps the meter (−100 fed up, 100 adoring). */
  moods: Record<string, FactionMoodStored>;
  /** One relation machine per pair of factions, by `a|b` with a < b. */
  relations: Record<string, RelationStored>;
  seen: Seen;
  /** Incidents since the last midnight (sim/vibes.ts adds to it). */
  incidents: number;
  /** Signals waiting for midnight: `faction.signal`, the safety budget, a hearing. */
  pending: string[];
  /** The day each signal last happened. */
  signals: Record<string, number>;
  /** Each faction's latest reason to feel the way it does: what the panel quotes. */
  why: Record<string, { text: string; day: number; amount: number }>;
  /** The lab's stance on the five axes, −1 to 1 each, as of the last midnight (sim/factions/stance.ts). */
  stance: Record<Axis, number>;
  /** Slow memories behind the stance: how fast you have been shipping, how open, how many incidents. */
  pace: number;
  openness: number;
  trouble: number;
  /** The last dozen things that happened in the discourse, newest last. */
  log: FactionLogItem[];
  /** Day of the last dueling op-eds, and of the last argument on the paths. */
  lastOpEd: number;
  lastArgue: number;
  /** Tallies for the headless report and the tests. */
  counts: { alliances: number; schisms: number; feuds: number; arguments: number; opEds: number; shouts: number; marches: number; hype: number; boycotts: number };
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Where a faction starts with another: the larger-magnitude of the two factions' own opinions of each other. */
function baseRelation(a: FactionDef, b: FactionDef): number {
  const ab = a.relations?.[b.id] ?? 0;
  const ba = b.relations?.[a.id] ?? 0;
  return Math.abs(ab) >= Math.abs(ba) ? ab : ba;
}

export function baseRelationOf(a: string, b: string): number {
  const fa = defs().factionById(a);
  const fb = defs().factionById(b);
  return fa && fb ? baseRelation(fa, fb) : 0;
}

export function seenNow(state: GameState): Seen {
  const r = state.leapfrog.response.context;
  const built: Record<string, number> = {};
  for (const b of state.buildings) built[b.kind] = (built[b.kind] ?? 0) + 1;
  return {
    models: state.models.length, ships: r.ships, holds: r.holds, leaks: r.leaks,
    openModel: state.flags.openModel ?? -1, raisedSafety: state.flags.raisedSafety ?? -1, ignoredWater: state.flags.ignoredWater ?? -1,
    policy: String(state.papers?.policy.value ?? "Selective"), built,
  };
}

export function createFactions(state: GameState): FactionsState {
  const all = defs().factions;
  const moods: Record<string, FactionMoodStored> = {};
  for (const f of all) moods[f.id] = initialStored(factionMoodMachine, { meter: 0, since: -1 });
  const relations: Record<string, RelationStored> = {};
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const v = baseRelation(all[i]!, all[j]!);
      relations[pairKey(all[i]!.id, all[j]!.id)] = { ...initialStored(relationMachine, { value: v, wasAllied: false }), context: { value: v, wasAllied: false } };
    }
  }
  return {
    // Its own stream, from the seed: a run's factions do the same things whatever else the main stream was asked for.
    rngState: (Math.imul(state.seed ^ 0x5eed, 0x9e3779b1) >>> 0) || 1,
    safety: 0,
    moods,
    relations,
    seen: seenNow(state),
    incidents: 0,
    pending: [],
    signals: {},
    why: {},
    stance: { speed: 0, safety: 0, openness: 0, fairness: 0, profit: 0 },
    pace: 0,
    openness: 0,
    trouble: 0,
    log: [],
    lastOpEd: -999,
    lastArgue: -999,
    counts: { alliances: 0, schisms: 0, feuds: 0, arguments: 0, opEds: 0, shouts: 0, marches: 0, hype: 0, boycotts: 0 },
  };
}

/**
 * Level 4 turns the factions on (sim/progression.ts), unless the run said no (`flags.factionsOff`, `?factions=off`).
 * Also gives old saves the card machines for the factions' events. Safe to call twice.
 */
export function enableFactions(state: GameState) {
  if (state.flags.factionsOff) return;
  state.factions ??= createFactions(state);
  syncFactionDefs(state);
}

/** A save from before a mod added a faction (or a card): give the newcomers their machines. */
export function syncFactionDefs(state: GameState) {
  const f = state.factions;
  if (!f) return;
  const all = defs().factions;
  for (const def of all) f.moods[def.id] ??= initialStored(factionMoodMachine, { meter: 0, since: -1 });
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const key = pairKey(all[i]!.id, all[j]!.id);
      if (f.relations[key]) continue;
      const v = baseRelation(all[i]!, all[j]!);
      f.relations[key] = { ...initialStored(relationMachine, { value: v, wasAllied: false }), context: { value: v, wasAllied: false } };
    }
  }
  for (const def of defs().events) state.arcs[def.id] ??= initialStored(arcMachine, { choices: def.choices.length, cooldownDays: def.cooldown ?? EVENT_COOLDOWN_DAYS, openedDay: null });
}

export const meterOf = (state: GameState, id: string): number => state.factions?.moods[id]?.context.meter ?? 0;
export const moodOf = (state: GameState, id: string) => state.factions?.moods[id]?.value ?? "calm";
export const relationOf = (state: GameState, a: string, b: string): number => state.factions?.relations[pairKey(a, b)]?.context.value ?? 0;
export const relationStateOf = (state: GameState, a: string, b: string) => state.factions?.relations[pairKey(a, b)]?.value ?? "cordial";

const clampMeter = (n: number) => Math.max(-100, Math.min(100, n));

/** Nudge a faction's meter now (a card, the `faction.delta` verb); its mood catches up at midnight. */
export function nudgeFaction(state: GameState, id: string, amount: number, why?: string) {
  const f = state.factions;
  const m = f?.moods[id];
  if (!f || !m) return;
  f.moods[id] = { ...m, context: { ...m.context, meter: clampMeter(m.context.meter + amount) } };
  if (why) f.why[id] = { text: why, day: state.day, amount };
}

/** Nudge how two factions feel about each other (a card, the `relation.delta` verb). */
export function nudgeRelation(state: GameState, a: string, b: string, amount: number) {
  const f = state.factions;
  const key = pairKey(a, b);
  const r = f?.relations[key];
  if (!f || !r || a === b) return;
  f.relations[key] = { ...r, context: { ...r.context, value: clampMeter(r.context.value + amount) } };
}

/** A stat a mod's guard can name beyond the Vocabulary's table: `faction:<id>` (a meter) and `rel:<a>|<b>` (a relation). */
export function factionStat(state: GameState, name: string): number | undefined {
  if (name.startsWith("faction:")) return meterOf(state, name.slice(8));
  if (name.startsWith("rel:")) {
    const [a = "", b = ""] = name.slice(4).split("|");
    return relationOf(state, a, b);
  }
  return undefined;
}
