// The Vocabulary (FLT-17): the named guards and verbs a JSON statechart may call. This is the engine side of
// "engine vs. content" (docs/MODDING.md §1, docs/DISASTERS.md): a verb is generic (`staff.divert`, `compute.drain`,
// `news`), never specific to a mechanic, and a pack decides what to call, with which words and numbers.
//
// * Guards are pure: they read the beat the driver sent (tick, day, a pre-rolled die, the lab's stats) and the
//   machine's own context. No World, no random numbers.
// * Verbs are the effects: the driver runs them, in order, after each transition. They may touch the World.
// * Every call is checked against the tables below when a pack loads, with the JSON path in the message
//   ("did you mean ...?"), so a typo fails loudly and early.
//
// FLT-30's `Vocabulary` service (src/mods/services/vocabulary.ts) is `{ guards: string[], effects: string[] }`:
// `vocabulary` at the bottom has exactly that shape, so wrapping it in the Layer is mechanical.
import type { BuildingKind } from "../content/buildings";
import type { RivalId } from "../content/rivals";
import { askFlag, cardId, offerFlag } from "./disasters/names";
import type { Call, Cue, DisasterRun, Json, TimedEffect } from "./disasters/types";
import { TICKS_PER_DAY } from "./constants";
import { breakBuilding } from "./breakdowns";
import { placeBuilding } from "./commands";
import { dailyEvents } from "./events";
import { fillTemplate } from "./format";
import { groupKind, sendGroupsHome, spawnGroup, visitorCount } from "./groups";
import { step } from "./machines/run";
import { addNews, addToast, templateVars, type ToastTag } from "./news";
import { clampDiscourse, syncProtesters } from "./protest";
import { SIGNALS } from "../content/factions";
import { signalFactions } from "./factions/driver";
import { factionStat, nudgeFaction, nudgeRelation, pairKey } from "./factions/state";
import { findSpot } from "./race/actions";
import { pushVoice } from "./race/leapfrog/ops";
import { YOU } from "../content/rivals";
import { refreshBoard } from "./race/arena";
import { rivalMachine } from "./race/rival";
import type { Rng } from "./rng";
import { atDivert, divertStaff, releaseStaff, staffOf } from "./staff";
import { callMeeting } from "./meetings";
import { congaLine } from "./conga";
import { resign } from "./walkers";
import type { Building, GameState, Importance, NoticeSource, StaffJob, Tone } from "./types";
import { startEscape } from "./escape/driver";
import { defs } from "./defs";
import { postNow } from "./birdapp/driver";
import { BIRD_OUTCOMES, type BirdOutcome } from "../content/birdapp";

/** A tick is 1.2 game hours (20 to a day). */
export const HOURS_PER_TICK = 24 / TICKS_PER_DAY;

type Params = Record<string, Json>;

// ---- Parameter checking --------------------------------------------------------------------------------------

type PType = "number" | "string" | "boolean" | "strings" | "call" | "calls";
type Spec = Record<string, PType | `${PType}?`>;

function closest(name: string, names: readonly string[]): string | null {
  let best: string | null = null;
  let bestD = 3;
  for (const n of names) {
    const d = distance(name, n);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

const isCall = (v: Json | undefined): v is Call => typeof v === "string" || (typeof v === "object" && v !== null && !Array.isArray(v) && typeof (v as { type?: Json }).type === "string");

function typeMatches(t: PType, v: Json): boolean {
  switch (t) {
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "string":
      return typeof v === "string";
    case "boolean":
      return typeof v === "boolean";
    case "strings":
      return Array.isArray(v) && v.every((x) => typeof x === "string");
    case "call":
      return isCall(v);
    case "calls":
      return Array.isArray(v) && v.every(isCall);
  }
}

function checkParams(spec: Spec, params: Params, path: string): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(params)) {
    if (!(key in spec)) {
      const hint = closest(key, Object.keys(spec));
      errors.push(`${path}.params.${key}: unknown parameter${hint ? ` (did you mean "${hint}"?)` : ""}`);
    }
  }
  for (const [key, raw] of Object.entries(spec)) {
    const optional = raw.endsWith("?");
    const t = (optional ? raw.slice(0, -1) : raw) as PType;
    const v = params[key];
    if (v === undefined) {
      if (!optional) errors.push(`${path}.params.${key}: required (${t})`);
    } else if (!typeMatches(t, v)) errors.push(`${path}.params.${key}: expected ${t}`);
  }
  return errors;
}

/** `{ type, params }` from a bare name or a full call. */
export function normalize(call: Call): { type: string; params: Params } {
  return typeof call === "string" ? { type: call, params: {} } : { type: call.type, params: call.params ?? {} };
}

// ---- Stats: what a guard (and the random-disaster odds) can read ---------------------------------------------

const alive = (b: Building) => !b.broken;
const crew = (state: GameState, job: StaffJob) => staffOf(state, job).filter((s) => s.machine.value !== "leaving").length;

/** The lab's numbers by name. The driver hands the ones a statechart mentions to it with every beat. */
export const STATS: Record<string, (state: GameState, run: DisasterRun | null) => number> = {
  day: (s) => s.day,
  capability: (s) => s.capability,
  hype: (s) => s.hype,
  cash: (s) => s.cash,
  compute: (s) => s.compute,
  discourse: (s) => s.waterDiscourse,
  models: (s) => s.models.length,
  agents: (s) => s.walkers.filter((w) => w.kind === "agent").length,
  clusters: (s) => s.buildings.filter((b) => b.kind === "cluster" && alive(b)).length,
  halls: (s) => s.buildings.filter((b) => b.kind === "hall" && alive(b)).length,
  gateways: (s) => s.buildings.filter((b) => b.kind === "gateway" && alive(b)).length,
  /** The power plants of the race (a compute auction unlocks them): what a brownout has to work with. */
  gas: (s) => s.buildings.filter((b) => b.kind === "gas" && alive(b)).length,
  solar: (s) => s.buildings.filter((b) => b.kind === "solar" && alive(b)).length,
  datacenters: (s) => s.buildings.filter((b) => b.kind === "datacenter" && alive(b)).length,
  broken: (s) => s.buildings.filter((b) => b.broken).length,
  security: (s) => crew(s, "security"),
  sre: (s) => crew(s, "sre"),
  comms: (s) => crew(s, "comms"),
  janitor: (s) => crew(s, "janitor"),
  /** The park rating, 0 to 999 (FLT-8): what a "Vibes check" reads. */
  vibes: (s) => s.vibes.value,
  /** SREs on their way to, or working on, a broken building. */
  sreAttending: (s) => staffOf(s, "sre").filter((o) => (o.machine.value === "going" || o.machine.value === "working") && s.buildings.some((b) => b.id === o.task && b.broken)).length,
  trust: (s) => s.disasters.trust,
  /** Members of visiting groups on campus (FLT-19). */
  visitors: (s) => visitorCount(s),
  heat: (s) => s.disasters.heat,
  /** Disasters begun, all time. */
  disasters: (s) => s.disasters.started,
  /** Regulatory capture, 0 to 100 (FLT-21's hearings move it; FLT-22 reads it). */
  capture: (s) => s.capture ?? 0,
  /** Senate hearings the lab has sat through, all time (FLT-21). FLT-22 and FLT-23 wake after the first. */
  hearings: (s) => s.hearing?.history.length ?? 0,
  /** This disaster's fires (or outages) still going. */
  burning: (s, run) => (run ? run.fires.filter((id) => s.buildings.some((b) => b.id === id && b.broken)).length : 0),
  /** How many other working buildings of the target's kind a fire could spread to. */
  adjacent: (s, run) => {
    const t = run ? s.buildings.find((b) => b.id === run.target) : undefined;
    return t ? s.buildings.filter((b) => b.kind === t.kind && b.id !== t.id && alive(b)).length : 0;
  },
};
export const STAT_NAMES = Object.keys(STATS);

/** A stat by name: the table above, or a faction's meter (`faction:<id>`) and a relation (`rel:<a>|<b>`) (FLT-33). */
export function statValue(state: GameState, name: string): number {
  return STATS[name]?.(state, null) ?? factionStat(state, name) ?? 0;
}

// ---- Guards --------------------------------------------------------------------------------------------------

/** What a guard sees. */
export interface GuardEnv {
  tick: number;
  day: number;
  /** A die the driver rolled for this beat, in [0, 1). */
  roll: number;
  stats: Record<string, number>;
  ctx: { enteredTick: number; progress: number; hours: number };
  /** The player's pick, on a CHOSE beat. */
  choice?: string;
  /** The card that was answered, on a mod arc's CHOSE beat (a disaster only hears its own cards). */
  card?: string;
  /** The flags the chart's guards name (mod arcs; set = the day it was set). */
  flags?: Record<string, number>;
}

interface GuardDef {
  doc: string;
  spec: Spec;
  test: (env: GuardEnv, p: Params) => boolean;
  verify?: (p: Params) => string | null;
}

const spanTicks = (p: Params): number => (typeof p.ticks === "number" ? p.ticks : 0) + (typeof p.hours === "number" ? p.hours / HOURS_PER_TICK : 0) + (typeof p.days === "number" ? p.days * TICKS_PER_DAY : 0);
const needsSpan = (p: Params) => (spanTicks(p) > 0 ? null : "give `ticks`, `hours` or `days`");
const SPAN: Spec = { ticks: "number?", hours: "number?", days: "number?" };

export const passes = (guard: Call | Call[] | undefined, env: GuardEnv): boolean => {
  if (guard === undefined) return true;
  if (Array.isArray(guard)) return guard.every((g) => passes(g, env));
  const { type, params } = normalize(guard);
  const def = GUARDS[type];
  return def ? def.test(env, params) : false;
};

export const GUARDS: Record<string, GuardDef> = {
  after: {
    doc: "The state has lasted at least this long (ticks, hours or days; a tick is 1.2 hours, a day 20 ticks).",
    spec: SPAN,
    verify: needsSpan,
    test: (env, p) => env.tick - env.ctx.enteredTick >= spanTicks(p),
  },
  every: {
    doc: "True on every Nth tick since the state began: effects over time (a daily drip is `{days: 1}`).",
    spec: SPAN,
    verify: needsSpan,
    test: (env, p) => {
      const n = Math.max(1, Math.round(spanTicks(p)));
      const t = env.tick - env.ctx.enteredTick;
      return t > 0 && t % n === 0;
    },
  },
  "progress.gte": {
    doc: "Cleanup progress (0 to 1, from the state's `work`) is at least `value`.",
    spec: { value: "number" },
    test: (env, p) => env.ctx.progress >= (p.value as number) - 1e-9,
  },
  "stat.gte": { doc: "A stat (see STAT_NAMES) is at least `value`.", spec: { stat: "string", value: "number" }, test: (env, p) => (env.stats[p.stat as string] ?? 0) >= (p.value as number) },
  "stat.lte": { doc: "A stat is at most `value`.", spec: { stat: "string", value: "number" }, test: (env, p) => (env.stats[p.stat as string] ?? 0) <= (p.value as number) },
  chance: { doc: "The die the driver rolled for this beat is under `p`. Ordered transitions with the same guard share one roll.", spec: { p: "number" }, test: (env, p) => env.roll < (p.p as number) },
  choice: {
    doc: "The player picked this choice: its `key` on a disaster's card, its position (\"0\", \"1\", ...) on a mod's. A mod arc hears every card, so name it with `card`.",
    spec: { is: "string", card: "string?" },
    test: (env, p) => env.choice === p.is && (p.card === undefined || env.card === p.card),
  },
  "day.after": { doc: "Today is later than day `day` (day 0 is the first).", spec: { day: "number" }, test: (env, p) => env.day > (p.day as number) },
  "flag.is": {
    doc: "The flag `flag` is set (or, with `set: false`, is not). Cards and `flag.set` set flags.",
    spec: { flag: "string", set: "boolean?" },
    test: (env, p) => (env.flags?.[p.flag as string] !== undefined) === (p.set ?? true),
  },
  "faction.gte": {
    doc: "A faction's meter (−100 fed up to 100 adoring; content.factions) is at least `value`. 0 while the factions are off.",
    spec: { faction: "string", value: "number" },
    test: (env, p) => (env.stats[`faction:${p.faction as string}`] ?? 0) >= (p.value as number),
  },
  "faction.lte": {
    doc: "A faction's meter is at most `value`.",
    spec: { faction: "string", value: "number" },
    test: (env, p) => (env.stats[`faction:${p.faction as string}`] ?? 0) <= (p.value as number),
  },
  "relation.gte": {
    doc: "How factions `a` and `b` feel about each other (−100 feud to 100 allies) is at least `value`.",
    spec: { a: "string", b: "string", value: "number" },
    test: (env, p) => (env.stats[`rel:${pairKey(p.a as string, p.b as string)}`] ?? 0) >= (p.value as number),
  },
  "relation.lte": {
    doc: "How factions `a` and `b` feel about each other is at most `value`.",
    spec: { a: "string", b: "string", value: "number" },
    test: (env, p) => (env.stats[`rel:${pairKey(p.a as string, p.b as string)}`] ?? 0) <= (p.value as number),
  },
  answered: { doc: "On a mod arc's CHOSE beat: the player answered the card `card` (any choice).", spec: { card: "string" }, test: (env, p) => env.card === p.card },
  not: { doc: "The other guard does not hold.", spec: { guard: "call" }, test: (env, p) => !passes(p.guard as Call, env) },
  any: { doc: "At least one of these guards holds (a plain list of guards means all of them).", spec: { guards: "calls" }, test: (env, p) => (p.guards as Call[]).some((g) => passes(g, env)) },
  all: { doc: "Every one of these guards holds (for a transition, whose `guard` is a single call).", spec: { guards: "calls" }, test: (env, p) => (p.guards as Call[]).every((g) => passes(g, env)) },
};
export const GUARD_NAMES = Object.keys(GUARDS);

// ---- Verbs ---------------------------------------------------------------------------------------------------

/** What a verb runs against. `run` is the disaster it belongs to (null for a verb called by hand: tests, dev hooks). */
export interface VerbEnv {
  state: GameState;
  rng: Rng;
  run: DisasterRun | null;
  /** A non-disaster machine can own effects and staff diversions too. */
  owner?: string;
  /** The people this beat is about, the main one first (a pack's driver names them): what `people.*` verbs act on. */
  people?: number[];
  /** Extra template variables for this beat's words (`{defName}`, `{act}` for FLT-22's bill). */
  vars?: Record<string, string>;
  /** Where this beat happens, when it is not a building (the auditors' huddle, FLT-56): the `here` place. */
  at?: [number, number];
}

interface VerbDef {
  doc: string;
  spec: Spec;
  run: (env: VerbEnv, p: Params) => void;
  verify?: (p: Params) => string | null;
}

const TONES = ["good", "bad", "neutral", "joke"] as const;
const toneOf = (v: Json | undefined): Tone => ((TONES as readonly Json[]).includes(v as Json) ? (v as Tone) : "neutral");
const num = (v: Json | undefined, fallback: number): number => (typeof v === "number" ? v : fallback);
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const ownerOf = (env: VerbEnv) => env.run?.id ?? env.owner ?? "";

/** The systems a verb's toast can say it is from (FLT-51), besides a mod's own `mod:<id>`. */
const SOURCES: readonly NoticeSource[] = ["leapfrog", "ops", "staff", "economy", "coach", "event", "disaster", "papers", "collusion", "hearing", "politics", "defection", "auditors", "factions", "race", "training", "crowd", "build", "endings", "escape"];
const isSource = (v: Json | undefined): v is NoticeSource => typeof v === "string" && ((SOURCES as readonly string[]).includes(v) || /^mod:[\w.-]+$/.test(v));
/** The base packs that call verbs, and whose notices they are. */
const PACK_SOURCE: Record<string, NoticeSource> = { collusion: "collusion", hearing: "hearing", yacht: "politics", auditors: "auditors", defection: "defection", poaching: "defection", capture: "politics", promises: "politics" };
/** A toast verb's `source` and `importance`, as given, or the owner's: a disaster, a base pack, or a mod arc (`mod:<arc id>`). */
function tagOf(env: VerbEnv, p: Params, importance: Importance = "world"): ToastTag {
  const source: NoticeSource = isSource(p.source) ? p.source : env.run ? "disaster" : env.owner ? (PACK_SOURCE[env.owner] ?? `mod:${env.owner}`) : "event";
  return { source, importance: p.importance === "you" || p.importance === "world" ? p.importance : importance };
}
const TAG_SPEC = { source: "string?", importance: "string?" } as const;
const verifyTag = (p: Params): string | null =>
  p.source !== undefined && !isSource(p.source) ? `\`source\` is ${SOURCES.join(", ")} or mod:<id>`
  : p.importance !== undefined && p.importance !== "you" && p.importance !== "world" ? "`importance` is you or world"
  : null;

/** A building named in a statechart: `$target`, `$adjacent`, `$office`, or a kind. Broken ones are last choice. */
export function buildingRef(env: VerbEnv, ref: string): Building | null {
  const { state, run } = env;
  const ofKind = (kind: string, not?: (b: Building) => boolean) => {
    const all = state.buildings.filter((b) => b.kind === kind && !(not?.(b) ?? false));
    return all.find(alive) ?? all[0] ?? null;
  };
  switch (ref) {
    case "$target":
      return run ? (state.buildings.find((b) => b.id === run.target) ?? null) : null;
    case "$adjacent": {
      const t = run ? state.buildings.find((b) => b.id === run.target) : undefined;
      if (!t) return null;
      // The nearest other working building of the target's kind that this fire has not touched yet.
      let best: Building | null = null;
      let bestD = Infinity;
      for (const b of state.buildings) {
        if (b.kind !== t.kind || b.id === t.id || b.broken || run!.fires.includes(b.id)) continue;
        const d = (b.x - t.x) ** 2 + (b.z - t.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      return best;
    }
    case "$office":
      return ofKind("security");
    default:
      return ofKind(ref);
  }
}

/** Where a place name points, in tile coordinates: the gate, or the middle of a building. */
function placeOf(env: VerbEnv, on: string): [number, number] | null {
  if (on === "here") return env.at ?? null;
  if (on === "gate") return [env.state.gate.x + env.state.gate.w / 2, env.state.gate.z + env.state.gate.d / 2];
  const b = buildingRef(env, on);
  return b ? [b.x + b.w / 2, b.z + b.d / 2] : null;
}

function say(env: VerbEnv, text: string): string {
  const { state, run } = env;
  const target = run ? state.buildings.find((b) => b.id === run.target) : undefined;
  const vars: Record<string, string> = { ...templateVars(state, {}, env.rng), ...(run?.vars ?? {}), ...(env.vars ?? {}) };
  if (target) vars.target = defs().buildings[target.kind].name;
  return fillTemplate(text, vars);
}

type CueBody = Cue extends infer C ? (C extends Cue ? Omit<C, "id" | "tick"> : never) : never;

/** Tell the renderer and the sound layer something happened (they poll `state.disasters.cues`). */
function pushCue(state: GameState, cue: CueBody) {
  const d = state.disasters;
  d.cues.push({ id: state.nextId++, tick: state.tick, ...cue } as Cue);
  if (d.cues.length > 12) d.cues.splice(0, d.cues.length - 12);
}

function addEffect(env: VerbEnv, kind: TimedEffect["kind"], value: number, days: number | undefined, kinds: string[] = []) {
  const { state } = env;
  const owner = ownerOf(env);
  // A verb with no disaster to own it must say how long it lasts.
  const until = days !== undefined ? state.tick + Math.round(days * TICKS_PER_DAY) : owner ? -1 : state.tick + 10 * TICKS_PER_DAY;
  state.disasters.effects.push({ id: state.nextId++, owner, kind, value, until, kinds });
}

/** Pull `fraction` of a job off their posts to a place, and keep pulling: new hires of the job are drawn in too. */
export function enforceDiverts(state: GameState, run: DisasterRun) {
  for (const d of run.diverts) divertSome(state, run.id, d);
}

function divertSome(state: GameState, owner: string, d: DisasterRun["diverts"][number]) {
  const crewOf = staffOf(state, d.job).filter((s) => s.machine.value !== "leaving");
  const want = Math.ceil(crewOf.length * d.fraction - 1e-9);
  let have = crewOf.filter((s) => s.divert?.owner === owner && s.divert.to === d.to).length;
  for (const s of crewOf) {
    if (have >= want) break;
    if (s.divert) continue;
    divertStaff(s, owner, d.to, d.jog);
    have++;
  }
}

/** Break a building for a disaster and remember it as this run's. */
function wreck(env: VerbEnv, b: Building) {
  if (b.broken) return;
  breakBuilding(env.state, b);
  b.reliability = Math.min(b.reliability, 0.5);
  env.run?.fires.push(b.id);
}

const BUILDING = (spec: Spec): Spec => ({ building: "string", ...spec });

export const VERBS: Record<string, VerbDef> = {
  "investigate.start": {
    doc: "Start an inquiry for `days`; divert free staff of `job` to `to`. The owning machine reads arrived staff and decides the result, then calls staff.release.",
    spec: { id: "string", days: "number", job: "string", to: "string" },
    verify: (p) => !(p.days as number > 0) ? "`days` must be positive" : ["security", "sre", "comms", "janitor"].includes(p.job as string) ? null : "unknown staff job",
    run: (env, p) => {
      const owner = ownerOf(env) || (p.id as string);
      const job = p.job as StaffJob;
      const to = buildingRef(env, p.to as string)?.id ?? 0;
      const inquiries = env.state.investigations ??= {};
      if (inquiries[owner]) return;
      inquiries[owner] = { startedDay: env.state.day, days: p.days as number, to, job };
      for (const s of staffOf(env.state, job)) if (!s.divert && s.machine.value !== "leaving") divertStaff(s, owner, to, 1.8);
    },
  },
  "staff.divert": {
    doc: "Pull `fraction` of a job off their posts and jog them to `to` (a building kind, `$target`, `$office` or `gate`) with a red \"!\". Their posts go unstaffed until `staff.release`; in a disaster, new hires of the job are drawn in too (a mod arc pulls whoever is on staff now).",
    spec: { job: "string", to: "string", fraction: "number?", jog: "number?" },
    verify: (p) => (["janitor", "sre", "comms", "security"].includes(p.job as string) ? null : "`job` is janitor, sre, comms or security"),
    run: (env, p) => {
      const { state, run } = env;
      const b = p.to === "gate" ? null : buildingRef(env, p.to as string);
      const to = b ? b.id : 0;
      const d = { job: p.job as StaffJob, to, fraction: num(p.fraction, 1), jog: num(p.jog, 1.8) };
      if (run) {
        run.diverts = [...run.diverts.filter((o) => o.job !== d.job), d];
        enforceDiverts(state, run);
      } else if (ownerOf(env)) divertSome(state, ownerOf(env), d);
    },
  },
  "staff.release": {
    doc: "End this disaster's diversions (of one job, or all of them): everyone strolls back to their post.",
    spec: { job: "string?" },
    run: (env, p) => {
      const job = p.job as StaffJob | undefined;
      if (env.run) env.run.diverts = env.run.diverts.filter((d) => job !== undefined && d.job !== job);
      releaseStaff(env.state, ownerOf(env), job);
    },
  },
  "compute.drain": {
    doc: "Lose `pct` percent of the compute stockpile and of the daily compute output, every day. Lasts `days`, or as long as the disaster (`effects.end` stops it early).",
    spec: { pct: "number", days: "number?" },
    run: (env, p) => addEffect(env, "drain", (p.pct as number) / 100, p.days as number | undefined),
  },
  "cost.spike": {
    doc: "Multiply the upkeep of `kinds` (default: every building) by `mult`. Lasts `days`, or as long as the disaster.",
    spec: { mult: "number", days: "number?", kinds: "strings?" },
    run: (env, p) => addEffect(env, "spike", p.mult as number, p.days as number | undefined, (p.kinds as string[] | undefined) ?? []),
  },
  "revenue.mult": {
    doc: "Multiply the API revenue by `mult` (0 turns the till off). Lasts `days`, or as long as the disaster.",
    spec: { mult: "number", days: "number?" },
    run: (env, p) => addEffect(env, "revenue", p.mult as number, p.days as number | undefined),
  },
  "auditor.odds": {
    doc: "Multiply the odds of an external auditor's visit (FLT-19 reads `auditorOdds(state)`) by `mult`. Lasts `days`, or as long as the disaster.",
    spec: { mult: "number", days: "number?" },
    run: (env, p) => addEffect(env, "auditor", p.mult as number, p.days as number | undefined),
  },
  "auditor.note": {
    doc: "Put a note on the lab's file for the auditors (FLT-19): a mark on one report-card `grade` (`honesty`, ...), `amount` grades up (+) or down (-), and a line of `text`. FLT-19's grades read `state.auditorNotes`.",
    spec: { grade: "string", amount: "number", text: "string" },
    run: (env, p) => {
      const { state } = env;
      state.auditorNotes ??= [];
      state.auditorNotes.push({ day: state.day, grade: p.grade as string, amount: p.amount as number, text: say(env, p.text as string), owner: ownerOf(env) });
      if (state.auditorNotes.length > 24) state.auditorNotes.splice(0, state.auditorNotes.length - 24);
    },
  },
  "rival.growth": {
    doc: "Multiply what a release adds for the rival labs in `who` (rival ids, `below` for the labs behind you, `above`, `open` for the open-weights labs, `!id` to leave one out; none means all). Lasts `days`, or as long as its owner.",
    spec: { mult: "number", who: "strings?", days: "number?" },
    run: (env, p) => addEffect(env, "rivalGrowth", p.mult as number, p.days as number | undefined, (p.who as string[] | undefined) ?? []),
  },
  "rival.pace": {
    doc: "Multiply how fast the rival labs in `who` train (0.5 is half speed: runs take twice as long). Same `who` and `days` as `rival.growth`.",
    spec: { mult: "number", who: "strings?", days: "number?" },
    run: (env, p) => addEffect(env, "rivalPace", p.mult as number, p.days as number | undefined, (p.who as string[] | undefined) ?? []),
  },
  "rival.closed": {
    doc: "The rival labs in `who` may not ship open weights (their releases go out closed, so no open drop eats your revenue). Same `who` and `days` as `rival.growth`.",
    spec: { who: "strings?", days: "number?" },
    run: (env, p) => addEffect(env, "rivalClosed", 1, p.days as number | undefined, (p.who as string[] | undefined) ?? []),
  },
  "effects.end": {
    doc: "End this owner's open-ended effects (the ones with no `days`: drain, spike, revenue, auditor, the rival rules), all of them or one `kind`. Effects with a `days` run their course.",
    spec: { kind: "string?" },
    run: (env, p) => {
      const owner = ownerOf(env);
      env.state.disasters.effects = env.state.disasters.effects.filter((e) => e.owner !== owner || e.until >= 0 || (p.kind !== undefined && e.kind !== p.kind));
    },
  },
  "building.fire": {
    doc: "Set a building on fire: it is broken (no work, nobody goes in) and burns until an SRE fixes it, as after any breakdown. `building` is `$target`, `$adjacent` or a kind.",
    spec: BUILDING({}),
    run: (env, p) => {
      const b = buildingRef(env, p.building as string);
      if (b) wreck(env, b);
    },
  },
  "building.offline": {
    doc: "Take a building offline (a flood, an outage): broken like a fire, with a toast instead of a headline (importance `you` unless given).",
    spec: BUILDING({ text: "string?", ...TAG_SPEC }),
    verify: verifyTag,
    run: (env, p) => {
      const b = buildingRef(env, p.building as string);
      if (!b || b.broken) return;
      wreck(env, b);
      addToast(env.state, say(env, typeof p.text === "string" ? p.text : "{target} is offline."), "bad", tagOf(env, p, "you"));
    },
  },
  "building.wear": {
    doc: "Cap a building's reliability at `to` (0 to 1): the scorched cluster is never quite the same.",
    spec: BUILDING({ to: "number" }),
    run: (env, p) => {
      const b = buildingRef(env, p.building as string);
      if (b) b.reliability = Math.max(0, Math.min(b.reliability, p.to as number));
    },
  },
  "building.ensure": {
    doc: "Make sure a building of `kind` exists: if the lab has none, one arrives free beside the gate (upkeep still applies).",
    spec: { kind: "string", text: "string?", ...TAG_SPEC },
    verify: (p) => ((p.kind as string) in defs().buildings ? verifyTag(p) : `unknown building "${p.kind as string}"`),
    run: (env, p) => {
      const { state, rng } = env;
      const kind = p.kind as BuildingKind;
      if (state.buildings.some((b) => b.kind === kind)) return;
      // Free: the voucher makes `canPlace` and `placeBuilding` charge nothing, and is spent (or dropped) right here.
      state.flags[`free:${kind}`] = 1;
      const at = findSpot(state, kind);
      // Granted by the incident, not asked for: no "the board will have questions" (FLT-16's spending check) on a free building.
      if (at) placeBuilding(state, rng, kind, at[0], at[1], true);
      delete state.flags[`free:${kind}`];
      if (!at) return void addToast(state, `No room for a ${defs().buildings[kind].name}. The incident room is the gate.`, "neutral", tagOf(env, p, "you"));
      if (typeof p.text === "string") addToast(state, say(env, p.text), "neutral", tagOf(env, p));
    },
  },
  "hype.delta": { doc: "Add to hype (0 to 100).", spec: { amount: "number" }, run: (env, p) => void (env.state.hype = clamp100(env.state.hype + (p.amount as number))) },
  "voice.push": {
    doc: "Put the lab in the news cycle (FLT-56): `amount` more of the share of voice the Leapfrog tracks (a rival's launch pushes 42 to 60). Nothing while the Leapfrog is off.",
    spec: { amount: "number" },
    run: (env, p) => pushVoice(env.state, YOU, p.amount as number),
  },
  "trust.delta": {
    doc: "Add to public trust (0 to 100, starts at 50).",
    spec: { amount: "number" },
    run: (env, p) => void (env.state.disasters.trust = clamp100(env.state.disasters.trust + (p.amount as number))),
  },
  "heat.delta": {
    doc: "Add to regulatory heat (0 to 100, starts at 0). FLT-19's auditors read it.",
    spec: { amount: "number" },
    run: (env, p) => void (env.state.disasters.heat = clamp100(env.state.disasters.heat + (p.amount as number))),
  },
  "capture.delta": {
    doc: "Add to regulatory capture (0 to 100, starts at 0): how much of the rulebook the lab wrote. FLT-22 reads it.",
    spec: { amount: "number" },
    run: (env, p) => void (env.state.capture = clamp100((env.state.capture ?? 0) + (p.amount as number))),
  },
  "discourse.delta": {
    doc: "Add to the water discourse (the stat behind the protesters at the gate; 4 points is one protester).",
    spec: { amount: "number" },
    run: (env, p) => void (env.state.waterDiscourse = clampDiscourse(env.state.waterDiscourse + (p.amount as number))),
  },
  "cash.delta": { doc: "Add to (or, negative, take from) the bank.", spec: { amount: "number" }, run: (env, p) => void (env.state.cash += p.amount as number) },
  "rival.leap": {
    doc: "The most open-weights lab jumps to `relative` times yours (-0.1 is 10% below your capability; it never goes down) and, with `open`, ships open weights. Sets `{leapRival}` and `{leapModel}` for the disaster's headlines.",
    spec: { relative: "number", open: "boolean?" },
    run: (env, p) => {
      const { state, run } = env;
      const race = state.race;
      let pick = -1;
      let most = -1;
      race.rivals.forEach((r, i) => {
        if (r.context.personality.openness > most) {
          most = r.context.personality.openness;
          pick = i;
        }
      });
      const rival = race.rivals[pick];
      if (!rival) return;
      const gain = Math.max(0, state.capability * (1 + (p.relative as number)) - rival.context.capability);
      const shocked = step(rivalMachine, rival, { type: "SHOCK", capability: gain, hype: 0, momentum: 0 }).stored;
      race.rivals[pick] = p.open ? { ...shocked, context: { ...shocked.context, open: true } } : shocked;
      // Out of cycle, like a collusion scandal: the jump shows on the Arena now, not at the weekly re-rank (FLT-32).
      refreshBoard(state);
      if (run) {
        run.vars.leapRival = defs().rivalById[rival.context.id as RivalId]?.name ?? rival.context.id;
        run.vars.leapModel = rival.context.model || "a model that is suspiciously familiar";
        run.vars.leapRivalId = rival.context.id;
      }
    },
  },
  "camera.focus": {
    doc: "Fly the camera to `on` (`gate`, `$target`, `$adjacent`, `$office` or a building kind), `zoom` times closer, for `hold` seconds. Unless the player is in photo mode.",
    spec: { on: "string", zoom: "number?", hold: "number?" },
    run: (env, p) => {
      const at = placeOf(env, p.on as string);
      if (at) pushCue(env.state, { type: "focus", x: at[0], z: at[1], zoom: num(p.zoom, 1.3), hold: num(p.hold, 2.4) });
    },
  },
  "camera.beat": {
    doc: "A camera beat (FLT-56): letterbox bars and a `caption` (with an optional `sub` line; templates, like `news`) while the camera eases to `on` for `hold` seconds. `on` is a place, as for `camera.focus`, `here` (wherever the pack's driver says the beat is, such as the auditors' huddle), or `people`: the beat's people, followed as they walk. `kind` tells the renderer which beat it is (`exit`, `huddle`, `viral`). Time keeps running, the player can skip it, and photo mode or reduced motion get the caption without the camera move.",
    spec: { kind: "string", caption: "string", sub: "string?", on: "string", zoom: "number?", hold: "number?" },
    run: (env, p) => {
      const people = p.on === "people" ? (env.people ?? []).filter((id) => env.state.walkers.some((w) => w.id === id)) : [];
      const lead = people.length ? env.state.walkers.find((w) => w.id === people[0]) : undefined;
      const at: [number, number] | null = lead ? [lead.x, lead.z] : placeOf(env, p.on as string);
      if (!at) return;
      pushCue(env.state, {
        type: "beat", beat: p.kind as string, caption: say(env, p.caption as string), sub: p.sub ? say(env, p.sub as string) : "",
        x: at[0], z: at[1], zoom: num(p.zoom, 1.5), hold: num(p.hold, 4), follow: people,
      });
    },
  },
  shake: { doc: "Shake the screen, `strength` 0 to 1.", spec: { strength: "number" }, run: (env, p) => pushCue(env.state, { type: "shake", strength: Math.max(0, Math.min(1, p.strength as number)) }) },
  "sound.cue": {
    doc: "Play a sound cue: `alarm` (FLT-7's breakdown alarm), `card`, `era`, `release`, any other base cue (`coin`, `protest.grow`, `ui.click`, ...), or one a mod's `audio.cues` adds (`gr.bark`). An unknown name plays nothing.",
    spec: { cue: "string" },
    // Mod cues live in the presentation, not the sim, so this checks the name's shape; `flt-mod check` checks it exists.
    verify: (p) => (/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(p.cue as string) ? null : "`cue` is a cue name like card, alarm or protest.grow"),
    run: (env, p) => pushCue(env.state, { type: "sound", cue: p.cue === "alarm" ? "breakdown" : (p.cue as string) }),
  },
  news: {
    doc: "A ticker headline. `{lab}`, `{model}`, `{rival}`, `{cash}` and `{target}` are filled in, plus whatever the disaster's verbs set (`{leapRival}`).",
    spec: { text: "string", tone: "string?" },
    run: (env, p) => addNews(env.state, say(env, p.text as string), toneOf(p.tone)),
  },
  toast: {
    doc: "A notice (same template variables as `news`). `importance: you` is a toast over the map; `world` (the default) goes to the ticker and the panel that owns `source` (defaults to the disaster, Collusion, or `mod:<arc id>`; any of leapfrog, ops, staff, economy, event, disaster, papers, collusion, hearing, politics, defection, auditors, factions, race, training, crowd, build, endings, or mod:<id>).",
    spec: { text: "string", tone: "string?", ...TAG_SPEC },
    verify: verifyTag,
    run: (env, p) => addToast(env.state, say(env, p.text as string), toneOf(p.tone), tagOf(env, p)),
  },
  card: {
    doc: "Open an event card: one of the disaster's (`cards[].id`), or from a mod arc any card in `content.events` by id, whatever its `when` says. It waits its turn if another card is open. The machine hears the player's pick as a CHOSE beat.",
    spec: { id: "string" },
    run: (env, p) => {
      const { state, run } = env;
      const id = run ? cardId(run.id, p.id as string) : (p.id as string);
      if (!run && !defs().eventById(id)) return;
      state.flags[run ? offerFlag(id) : askFlag(id)] = state.day;
      if (run) run.card = id;
      // Cards are checked once a day; a disaster does not want to wait for midnight.
      dailyEvents(state);
    },
  },
  "people.meet": {
    doc: "A visitor with `role` walks in from the gate to meet the beat's first person by the first `at` building (a kind) and they talk for `hours`, in view. `lines` is what they say, visitor first, alternating.",
    spec: { role: "string", at: "string", hours: "number", lines: "strings?" },
    verify: (p) => ((p.at as string) in defs().buildings ? null : `unknown building "${p.at as string}"`),
    run: (env, p) => {
      const host = env.people?.[0];
      if (host === undefined) return;
      callMeeting(env.state, env.rng, { owner: ownerOf(env), hostId: host, role: p.role as string, at: p.at as string, hours: p.hours as number, lines: ((p.lines as string[] | undefined) ?? []).map((l) => say(env, l)) });
    },
  },
  "people.quit": {
    doc: "Everyone the beat is about hands in the box and walks out through the gate. With `quiet`, the calling pack writes the exit headline instead of the usual one. With `conga`, they leave as a conga line behind the first of them (FLT-56).",
    spec: { quiet: "boolean?", conga: "boolean?" },
    run: (env, p) => {
      const { state, rng } = env;
      for (const id of env.people ?? []) {
        const w = state.walkers.find((o) => o.id === id);
        if (!w || w.machine.value === "quitting" || w.machine.value === "leaving") continue;
        if (p.quiet) state.flags[`quietExit:${w.id}`] = state.day;
        resign(state, w, rng);
      }
      if (p.conga) congaLine(state, env.people ?? []);
    },
  },
  "people.pay": {
    doc: "Take `each` from the bank for everyone the beat is about (a retention bonus, a matched offer).",
    spec: { each: "number" },
    run: (env, p) => void (env.state.cash -= (p.each as number) * (env.people?.filter((id) => env.state.walkers.some((w) => w.id === id)).length ?? 0)),
  },
  "people.cheer": {
    doc: "Lift the spirits of everyone the beat is about: `amount` (0 to 1) onto their energy and focus.",
    spec: { amount: "number" },
    run: (env, p) => {
      const a = p.amount as number;
      for (const id of env.people ?? []) {
        const w = env.state.walkers.find((o) => o.id === id);
        if (!w) continue;
        w.energy = Math.max(0, Math.min(1, w.energy + a));
        w.focus = Math.max(0, Math.min(1, w.focus + a));
      }
    },
  },
  "birdapp.post": {
    doc: "Someone at the lab posts `text` on the Bird App within the hour (FLT-69): the beat's first person if they post, else one of `archetype` (oracle, hype, duo, thread, leaderboard, doomer, anon), else anyone who posts. It lands at midnight: `outcome` (flop, banger, controversy, ratioed, cancelled) says how, or the odds for its `spice` (0 to 1, default 0.5) do. Nothing while the Bird App is asleep.",
    spec: { text: "string", spice: "number?", archetype: "string?", outcome: "string?" },
    verify: (p) => (p.outcome === undefined || (BIRD_OUTCOMES as readonly string[]).includes(p.outcome as string) ? null : `unknown outcome "${p.outcome as string}"; outcomes are ${BIRD_OUTCOMES.join(", ")}`),
    run: (env, p) => postNow(env.state, env.rng, { text: say(env, p.text as string), spice: p.spice as number | undefined, archetype: p.archetype as string | undefined, outcome: p.outcome as BirdOutcome | undefined, by: env.people?.[0] }),
  },
  "visitors.arrive": {
    doc: "A visiting group of a kind a pack registered (`content.groups`) comes in through the gate and tours the campus. Owned by the calling machine.",
    spec: { kind: "string" },
    run: (env, p) => {
      const kind = groupKind(p.kind as string);
      if (kind) spawnGroup(env.state, kind, ownerOf(env), env.rng);
    },
  },
  "visitors.leave": { doc: "The calling machine's visiting groups cut the tour short and head for the gate.", spec: {}, run: (env) => sendGroupsHome(env.state, ownerOf(env)) },
  "walkers.disguise": {
    doc: "Draw every walker of `kind` as `as` (the renderer knows `box`: a cardboard box). Presentation only; the sim is unchanged.",
    spec: { kind: "string", as: "string" },
    run: (env, p) => void ((env.state.disguises ??= {})[p.kind as string] = p.as as string),
  },
  "walkers.reveal": {
    doc: "Undo `walkers.disguise` for `kind`.",
    spec: { kind: "string" },
    run: (env, p) => {
      const d = env.state.disguises;
      if (!d) return;
      delete d[p.kind as string];
      if (Object.keys(d).length === 0) delete env.state.disguises;
    },
  },
  "spawn.escape": {
    doc: "The most drifted agent (with `count` above 1, a jailbreak: that many, each for a different fence) starts thinking about the fence; with `now`, it skips the brooding and goes straight to pacing. Needs the Sandbox Escape pack awake.",
    spec: { count: "number?", now: "boolean?" },
    run: (env, p) => void startEscape(env.state, { count: (p.count as number | undefined) ?? 1, pace: p.now === true }),
  },
  "faction.delta": {
    doc: "Nudge a faction's meter (−100 to 100) now; its mood catches up at midnight. Nothing while the factions are off.",
    spec: { faction: "string", amount: "number", text: "string?" },
    run: (env, p) => nudgeFaction(env.state, p.faction as string, p.amount as number, typeof p.text === "string" ? say(env, p.text) : undefined),
  },
  "relation.delta": {
    doc: "Nudge how factions `a` and `b` feel about each other (−100 feud to 100 allies). A pair that was allied and falls to −55 is a schism.",
    spec: { a: "string", b: "string", amount: "number" },
    run: (env, p) => nudgeRelation(env.state, p.a as string, p.b as string, p.amount as number),
  },
  "faction.signal": {
    doc: "Tell every faction something happened (`lobby`, `hearing`, `release`, ...: SIGNALS in content/factions.ts); their grievances and cheers react at midnight.",
    spec: { signal: "string" },
    verify: (p) => ((SIGNALS as readonly string[]).includes(p.signal as string) ? null : `unknown signal "${p.signal as string}"${closest(p.signal as string, SIGNALS) ? ` (did you mean "${closest(p.signal as string, SIGNALS)}"?)` : ""}`),
    run: (env, p) => signalFactions(env.state, p.signal as string),
  },
  "faction.rally": {
    doc: "A faction brings a crowd to the gate to shout at other crowds (`against`: faction ids; the water crowd always counts). Its size is `share` of the water crowd (default 0.5), at least `size` (default 3). The two sides take either side of the path. Works with the factions off: it only needs the faction's content.",
    spec: { faction: "string", against: "strings?", share: "number?", size: "number?" },
    run: (env, p) => {
      const { state } = env;
      const rallies = (state.rallies ??= []);
      const rally = { faction: p.faction as string, against: (p.against as string[] | undefined) ?? [], share: num(p.share, 0.5), min: num(p.size, 3), day: state.day };
      state.rallies = [...rallies.filter((r) => r.faction !== rally.faction), rally];
      syncProtesters(state, env.rng);
    },
  },
  "faction.disperse": {
    doc: "End a faction's rally: its crowd goes home.",
    spec: { faction: "string" },
    run: (env, p) => {
      const { state } = env;
      if (!state.rallies) return;
      state.rallies = state.rallies.filter((r) => r.faction !== p.faction);
      syncProtesters(state, env.rng);
    },
  },
  "flag.set": { doc: "Set a flag to today's day number.", spec: { name: "string" }, run: (env, p) => void (env.state.flags[p.name as string] = env.state.day) },
  "flag.clear": { doc: "Clear a flag.", spec: { name: "string" }, run: (env, p) => void delete env.state.flags[p.name as string] },
};
export const VERB_NAMES = Object.keys(VERBS);

// ---- Running and checking calls ---------------------------------------------------------------------------------

/** Run a verb by name. Unknown names are ignored (the loader has already refused them). */
export function runVerb(env: VerbEnv, call: Call) {
  const { type, params } = normalize(call);
  VERBS[type]?.run(env, params);
}

/** Errors for one call, each starting with the JSON path. Empty when it is fine. */
const NO_LOCAL: ReadonlySet<string> = new Set();
/** `local` names stats a mechanic measures itself and passes in its beat (the Circus charts' session tallies). */
export function checkCall(call: Call, kind: "verb" | "guard", path: string, local: ReadonlySet<string> = NO_LOCAL): string[] {
  if (!isCall(call as Json)) return [`${path}: expected a name or { type, params }`];
  const { type, params } = normalize(call);
  const table = kind === "verb" ? VERBS : GUARDS;
  const def = table[type];
  if (!def) {
    const hint = closest(type, Object.keys(table));
    return [`${path}: unknown ${kind === "verb" ? "action" : "guard"} "${type}"${hint ? ` (did you mean "${hint}"?)` : ""}`];
  }
  const errors = checkParams(def.spec, params, path);
  if (errors.length === 0) {
    const why = def.verify?.(params);
    if (why) errors.push(`${path}: ${why}`);
  }
  if (kind === "guard") {
    for (const key of ["guard"] as const) if (isCall(params[key])) errors.push(...checkCall(params[key] as Call, "guard", `${path}.params.${key}`, local));
    if (Array.isArray(params.guards)) (params.guards as Call[]).forEach((g, i) => errors.push(...checkCall(g, "guard", `${path}.params.guards[${i}]`, local)));
    if (type.startsWith("stat.") && typeof params.stat === "string" && !(params.stat in STATS) && !local.has(params.stat)) {
      const hint = closest(params.stat, STAT_NAMES);
      errors.push(`${path}.params.stat: unknown stat "${params.stat}"${hint ? ` (did you mean "${hint}"?)` : ""}`);
    }
  }
  return errors;
}

/** Stats a guard names, so the driver only computes what a statechart reads. */
export function statsIn(guard: Call | Call[] | undefined, into = new Set<string>()): Set<string> {
  if (guard === undefined) return into;
  if (Array.isArray(guard)) {
    for (const g of guard) statsIn(g, into);
    return into;
  }
  const { type, params } = normalize(guard);
  if (type.startsWith("stat.") && typeof params.stat === "string") into.add(params.stat);
  if (type.startsWith("faction.") && typeof params.faction === "string") into.add(`faction:${params.faction}`);
  if (type.startsWith("relation.") && typeof params.a === "string" && typeof params.b === "string") into.add(`rel:${pairKey(params.a, params.b)}`);
  if (isCall(params.guard)) statsIn(params.guard as Call, into);
  if (Array.isArray(params.guards)) statsIn(params.guards as Call[], into);
  return into;
}

/** Flags a guard names, so a mod arc's beat carries only those. */
export function flagsIn(guard: Call | Call[] | undefined, into = new Set<string>()): Set<string> {
  if (guard === undefined) return into;
  if (Array.isArray(guard)) {
    for (const g of guard) flagsIn(g, into);
    return into;
  }
  const { type, params } = normalize(guard);
  if (type === "flag.is" && typeof params.flag === "string") into.add(params.flag);
  if (isCall(params.guard)) flagsIn(params.guard as Call, into);
  if (Array.isArray(params.guards)) flagsIn(params.guards as Call[], into);
  return into;
}

/** Whether a guard rolls the die (so the driver only draws one for charts that use it). */
export function usesChance(guard: Call | Call[] | undefined): boolean {
  if (guard === undefined) return false;
  if (Array.isArray(guard)) return guard.some(usesChance);
  const { type, params } = normalize(guard);
  return type === "chance" || (isCall(params.guard) && usesChance(params.guard as Call)) || (Array.isArray(params.guards) && usesChance(params.guards as Call[]));
}

/** FLT-30's `VocabularyApi` shape: the names a mod's statecharts may use. */
export const vocabulary: { readonly guards: readonly string[]; readonly effects: readonly string[] } = { guards: GUARD_NAMES, effects: VERB_NAMES };

// ---- Cleanup arithmetic -----------------------------------------------------------------------------------------

/** Staff-hours added this tick: every staffer of `job` this disaster diverted to the building `at` who has arrived (1.2 hours each). */
export function workThisTick(state: GameState, run: DisasterRun, job: StaffJob, at: string): number {
  const b = at === "gate" ? null : buildingRef({ state, rng: null as never, run }, at);
  const to = b ? b.id : 0;
  let n = 0;
  for (const s of state.staff) if (s.job === job && s.divert?.owner === run.id && s.divert.to === to && atDivert(state, s)) n++;
  return n * HOURS_PER_TICK;
}
