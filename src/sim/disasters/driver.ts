// The disaster driver (FLT-17): starts disasters (from the Disasters menu, the `?disaster=` hook, or the dice), steps each
// one's machine once a tick with the pure `transition()`, and applies what it emits, in order, to the World.
//
//   dice (dailyDisasters) --start--> run = { machine, target, fires, diverts, card } --TICK--> machine --CALL--> verbs
//   card answered (pick flag) -------------------------------------------------CHOSE----^
//
// A disaster draws from its own random stream (`state.disasters.rngState`), so a lab that never has one plays out
// exactly as it did before there were any. With no disaster running, `updateDisasters` is one length check.
import { createRng, type Rng } from "../rng";
import { TICKS_PER_DAY } from "../constants";
import { addToast } from "../news";
import { releaseStaff } from "../staff";
import { enforceDiverts, passes, runVerb, statsIn, STATS, workThisTick, type GuardEnv } from "../verbs";
import type { GameState } from "../types";
import { isFinal, startStored, stepDisaster, type DisasterEvent } from "./compile";
import { offerFlag, pickFlag } from "./names";
import { PACKS } from "./pack";
import { defs } from "../defs";
import { RISKS, type DisasterDef, type DisasterRun, type DisastersState, type Json, type Risk, type TimedEffect } from "./types";
import { validatePack } from "./validate";

/**
 * What a new game starts with. Tests start with disasters off (`createInitialState`), and the app sets this on a new lab.
 * The player sees and changes it in the Disasters menu (FLT-32), and the calm start below keeps the first months quiet.
 */
export const DEFAULT_RISK: Risk = "rare";

/** The calm start (FLT-32): no random disaster before the lab's first release, nor before this day. The menu still works. */
export const CALM_START_DAY = 60;
export const calmStart = (state: GameState): boolean => state.models.length === 0 || state.day < CALM_START_DAY;

/**
 * Odds per day that *something* goes wrong, for a lab of average risk (the mean weight of the disasters that could
 * happen today): about two a year on rare, five on normal, a couple a month on chaos. The odds do not depend on how many
 * disasters are installed: a mod that adds ten makes the mix richer, not the setting angrier. The weights only decide which.
 */
export const RATE: Record<Risk, number> = { off: 0, rare: 0.006, normal: 0.015, chaos: 0.06 };
/** Days between one random disaster and the next, and how many may be under way at once. */
const SPACING: Record<Risk, number> = { off: 0, rare: 14, normal: 8, chaos: 2 };
const MAX_RUNNING: Record<Risk, number> = { off: 0, rare: 1, normal: 2, chaos: 3 };
/** Chaos shrinks the quiet time before the first one, and between repeats of the same kind. */
const CHAOS_QUICKENING = 0.2;

export function createDisasters(seed: number): DisastersState {
  return {
    risk: "off",
    rngState: (Math.imul(seed, 2654435761) ^ 0x5bd1e995) >>> 0,
    runs: [],
    lastStart: -999,
    lastByDef: {},
    history: [],
    effects: [],
    cues: [],
    trust: 50,
    heat: 0,
    started: 0,
  };
}

let checked = false;
/** The definitions in play; the first call checks the shipped pack and throws with every complaint if it is broken. */
export function definitions(): readonly DisasterDef[] {
  if (!checked) {
    checked = true;
    for (const p of PACKS) {
      const errors = validatePack(p);
      if (errors.length > 0) throw new Error(`Disaster pack "${p.id}" is invalid:\n${errors.join("\n")}`);
    }
  }
  return defs().disasters;
}

// ---- Stats ----------------------------------------------------------------------------------------------------

const wanted = new WeakMap<DisasterDef, string[]>();

/** Every stat any guard of the chart reads. */
function statNames(def: DisasterDef): string[] {
  let names = wanted.get(def);
  if (!names) {
    const set = new Set<string>();
    for (const node of Object.values(def.states)) {
      for (const beat of ["TICK", "CHOSE"] as const) {
        const on = node.on?.[beat];
        for (const t of on === undefined ? [] : Array.isArray(on) ? on : [on]) statsIn(t.guard, set);
      }
    }
    names = [...set];
    wanted.set(def, names);
  }
  return names;
}

function statsFor(state: GameState, run: DisasterRun | null, names: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of names) out[n] = STATS[n]?.(state, run) ?? 0;
  return out;
}

// ---- Starting ------------------------------------------------------------------------------------------------

export type Refusal = { ok: false; reason: string };

/** Could `id` be triggered right now? (Ignores the dice and the quiet times: those only bind random disasters.) */
export function canTrigger(state: GameState, id: string): { ok: true } | Refusal {
  const def = definitions().find((d) => d.id === id);
  if (!def) return { ok: false, reason: `No such disaster: ${id}` };
  if (state.disasters.runs.some((r) => r.id === id)) return { ok: false, reason: `${def.name} is already under way.` };
  if (def.requires) {
    const stats = statsFor(state, null, [...statsIn(def.requires.guard)]);
    const env: GuardEnv = { tick: state.tick, day: state.day, roll: 0, stats, ctx: { enteredTick: state.tick, progress: 0, hours: 0 } };
    if (!passes(def.requires.guard, env)) return { ok: false, reason: def.requires.reason };
  }
  return { ok: true };
}

function pickTarget(state: GameState, rng: Rng, def: DisasterDef): number {
  if (!def.target) return 0;
  const of = state.buildings.filter((b) => b.kind === def.target!.kind);
  const pool = of.filter((b) => !b.broken);
  const from = pool.length > 0 ? pool : of;
  if (from.length === 0) return 0;
  switch (def.target.pick ?? "random") {
    case "first":
      return from[0]!.id;
    case "last":
      return from[from.length - 1]!.id;
    default:
      return rng.pick(from).id;
  }
}

/** Run the verbs a transition (or a start) called, in order. */
function apply(state: GameState, rng: Rng, run: DisasterRun, calls: readonly { verb: string; params: Record<string, Json> }[]) {
  for (const c of calls) runVerb({ state, rng, run }, { type: c.verb, params: c.params });
}

/**
 * Start a disaster: pick its target, run the first state's `entry` verbs, and put it in the World. `forced` means the
 * player (or a dev hook) asked for it; the dice always come through `dailyDisasters`.
 */
export function triggerDisaster(state: GameState, id: string, opts: { forced?: boolean } = {}): { ok: true; run: DisasterRun } | Refusal {
  const can = canTrigger(state, id);
  if (!can.ok) return can;
  const def = defs().disasterById(id)!;
  const d = state.disasters;
  const rng = createRng(d.rngState);
  const run: DisasterRun = {
    id,
    startedDay: state.day,
    startedTick: state.tick,
    machine: startStored(def, state.day, state.tick),
    target: pickTarget(state, rng, def),
    fires: [],
    card: null,
    diverts: [],
    vars: {},
    forced: opts.forced ?? true,
  };
  d.runs.push(run);
  d.lastStart = state.day;
  d.lastByDef[id] = state.day;
  d.started++;
  apply(state, rng, run, (def.states[def.initial]!.entry ?? []).map((c) => (typeof c === "string" ? { verb: c, params: {} } : { verb: c.type, params: c.params ?? {} })));
  d.rngState = rng.state();
  return { ok: true, run };
}

export function setRisk(state: GameState, risk: Risk) {
  if (RISKS.includes(risk)) state.disasters.risk = risk;
}

// ---- Each tick -------------------------------------------------------------------------------------------------

/** Did the player answer the card this disaster opened? Which choice? (Clears the pick flags.) */
function answered(state: GameState, def: DisasterDef, run: DisasterRun): string | null | undefined {
  const id = run.card;
  if (id === null) return undefined;
  if (state.arcs[id]?.value === "cardOpen" || state.flags[offerFlag(id)] !== undefined) return undefined;
  const card = def.cards?.find((c) => `dz:${def.id}:${c.id}` === id);
  let key: string | null = null;
  for (const ch of card?.choices ?? []) {
    if (state.flags[pickFlag(id, ch.key)] === undefined) continue;
    key ??= ch.key;
    delete state.flags[pickFlag(id, ch.key)];
  }
  run.card = null;
  return key;
}

/** Wrap up a disaster that reached its final state: everyone back to work, its open-ended effects over (the ones with a `days` outlive it), a line in the history. */
function end(state: GameState, def: DisasterDef, run: DisasterRun) {
  const d = state.disasters;
  releaseStaff(state, run.id);
  d.effects = d.effects.filter((e) => e.owner !== run.id || e.until >= 0);
  d.runs = d.runs.filter((r) => r !== run);
  d.history.push({ id: run.id, name: def.name, startedDay: run.startedDay, endedDay: state.day });
  if (d.history.length > 20) d.history.splice(0, d.history.length - 20);
}

/** Once a tick. Cheap when nothing is going on. */
export function updateDisasters(state: GameState) {
  const d = state.disasters;
  if (d.runs.length === 0) return;
  const rng = createRng(d.rngState);
  for (const run of d.runs.slice()) {
    const def = defs().disasterById(run.id);
    if (!def) continue;
    const names = statNames(def);
    const beat = (): Omit<DisasterEvent, "type"> => ({ tick: state.tick, day: state.day, roll: rng.next(), work: 0, stats: statsFor(state, run, names) });

    // The player answered a card: the machine hears which choice.
    const pick = answered(state, def, run);
    if (pick !== undefined) {
      const r = stepDisaster(def, run.machine, { type: "CHOSE", ...beat(), choice: pick ?? "" });
      run.machine = r.stored;
      apply(state, rng, run, r.calls);
    }

    if (run.diverts.length > 0) enforceDiverts(state, run);
    const node = def.states[run.machine.value];
    const work = node?.work ? workThisTick(state, run, node.work.job, node.work.at) : 0;
    const r = stepDisaster(def, run.machine, { type: "TICK", ...beat(), work } as DisasterEvent);
    run.machine = r.stored;
    apply(state, rng, run, r.calls);
    if (isFinal(def, run.machine.value)) end(state, def, run);
  }
  d.rngState = rng.state();
}

// ---- Each day: timed effects and the dice ------------------------------------------------------------------------

const live = (state: GameState, e: TimedEffect): boolean => e.until < 0 || state.tick < e.until;

/** The lab's compute output, times what a swarm has not stolen (1 when nothing is draining it). */
export function computeFactor(state: GameState): number {
  let f = 1;
  for (const e of state.disasters.effects) if (e.kind === "drain" && live(state, e)) f *= 1 - e.value;
  return f;
}

/** What a building's upkeep is multiplied by right now (API and compute bills tripled by a swarm; 1 when nothing is on). */
export function upkeepFactor(state: GameState, kind: string): number {
  let f = 1;
  for (const e of state.disasters.effects) if (e.kind === "spike" && live(state, e) && (e.kinds.length === 0 || e.kinds.includes(kind))) f *= e.value;
  return f;
}

/** What the API revenue is multiplied by right now. */
export function revenueEffect(state: GameState): number {
  let f = 1;
  for (const e of state.disasters.effects) if (e.kind === "revenue" && live(state, e)) f *= e.value;
  return f;
}

/** The odds of an auditor's visit, times this (FLT-19 reads it): 1 when nothing has raised them. */
export function auditorOdds(state: GameState): number {
  let f = 1;
  for (const e of state.disasters.effects) if (e.kind === "auditor" && live(state, e)) f *= e.value;
  return f;
}

/** The weight of a disaster today: its baseline plus what the lab's risk stats add, clamped. */
export function weightOf(state: GameState, def: DisasterDef): number {
  let w = def.odds.weight;
  for (const s of def.odds.scale ?? []) w += s.per * (STATS[s.stat]?.(state, null) ?? 0);
  return Math.max(def.odds.min ?? 0.2, Math.min(def.odds.max ?? 3, w));
}

/** Once a game day: the drain bites, spent effects go, and (unless the setting is off) the dice may start one. */
export function dailyDisasters(state: GameState) {
  const d = state.disasters;
  if (d.effects.length > 0) {
    for (const e of d.effects) if (e.kind === "drain" && live(state, e)) state.compute = Math.max(0, state.compute * (1 - e.value));
    d.effects = d.effects.filter((e) => live(state, e));
  }
  if (d.risk === "off" || calmStart(state) || d.runs.length >= MAX_RUNNING[d.risk] || state.day - d.lastStart < SPACING[d.risk] || state.goals.value === "lost") return;
  const quicken = d.risk === "chaos" ? CHAOS_QUICKENING : 1;
  const eligible = definitions().filter(
    (def) =>
      !d.runs.some((r) => r.id === def.id) &&
      state.day >= (def.odds.minDay ?? 0) * quicken &&
      state.day - (d.lastByDef[def.id] ?? -999) >= (def.odds.gapDays ?? 0) * quicken &&
      canTrigger(state, def.id).ok,
  );
  if (eligible.length === 0) return;
  const weights = eligible.map((def) => weightOf(state, def));
  const total = weights.reduce((a, b) => a + b, 0);
  const rng = createRng(d.rngState);
  // One roll for "does anything happen today", and only if it does, a second to say what.
  let chosen: DisasterDef | null = null;
  if (rng.next() < (RATE[d.risk] * total) / eligible.length) {
    let at = rng.next() * total;
    chosen = eligible.find((_, i) => (at -= weights[i]!) < 0) ?? eligible[eligible.length - 1]!;
  }
  d.rngState = rng.state();
  if (chosen) triggerDisaster(state, chosen.id, { forced: false });
}

// ---- For the UI (FLT-32) -----------------------------------------------------------------------------------------

export interface MenuRow {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  /** Under way right now. */
  active: boolean;
  /** Can be triggered right now; if not, `reason` says why. */
  available: boolean;
  reason?: string;
}

/** The Disasters menu: every disaster the content offers, and whether it can be triggered. */
export function disasterMenu(state: GameState): MenuRow[] {
  return definitions().map((def) => {
    const active = state.disasters.runs.some((r) => r.id === def.id);
    const can = canTrigger(state, def.id);
    return { id: def.id, name: def.name, blurb: def.blurb, tags: def.tags ?? [], active, available: can.ok, reason: can.ok ? undefined : can.reason };
  });
}

export interface RunView {
  id: string;
  name: string;
  /** The state the disaster is in: warning, active, cleanup, aftermath (the names are the content's). */
  phase: string;
  /** Cleanup progress, 0 to 1 (0 outside a state with staff-hours). */
  progress: number;
  /** The job putting in staff-hours in this state, or null if nobody is. */
  job: string | null;
  /** Game days since it began. */
  days: number;
}

export const disastersView = (state: GameState): RunView[] =>
  state.disasters.runs.map((r) => ({
    id: r.id,
    name: defs().disasterById(r.id)?.name ?? r.id,
    phase: r.machine.value,
    progress: r.machine.context.progress,
    job: defs().disasterById(r.id)?.states[r.machine.value]?.work?.job ?? null,
    days: Math.floor((state.tick - r.startedTick) / TICKS_PER_DAY),
  }));

/** A refusal as a toast (the Disasters menu and the dev hook use it). */
export function refuse(state: GameState, r: Refusal) {
  addToast(state, r.reason, "bad");
}
