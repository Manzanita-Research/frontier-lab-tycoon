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
import { BUILDINGS, type BuildingKind } from "../content/buildings";
import { RIVAL_BY_ID, type RivalId } from "../content/rivals";
import { cardId, offerFlag } from "./disasters/names";
import type { Call, Cue, DisasterRun, Json, TimedEffect } from "./disasters/types";
import { TICKS_PER_DAY } from "./constants";
import { breakBuilding } from "./breakdowns";
import { placeBuilding } from "./commands";
import { dailyEvents } from "./events";
import { fillTemplate } from "./format";
import { step } from "./machines/run";
import { addNews, addToast, templateVars } from "./news";
import { clampDiscourse } from "./protest";
import { findSpot } from "./race/actions";
import { rivalMachine } from "./race/rival";
import type { Rng } from "./rng";
import { atDivert, divertStaff, releaseStaff, staffOf } from "./staff";
import { callMeeting } from "./meetings";
import { resign } from "./walkers";
import type { Building, GameState, StaffJob, Tone } from "./types";

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
  heat: (s) => s.disasters.heat,
  /** This disaster's fires (or outages) still going. */
  burning: (s, run) => (run ? run.fires.filter((id) => s.buildings.some((b) => b.id === id && b.broken)).length : 0),
  /** How many other working buildings of the target's kind a fire could spread to. */
  adjacent: (s, run) => {
    const t = run ? s.buildings.find((b) => b.id === run.target) : undefined;
    return t ? s.buildings.filter((b) => b.kind === t.kind && b.id !== t.id && alive(b)).length : 0;
  },
};
export const STAT_NAMES = Object.keys(STATS);

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
  choice: { doc: "The player picked this choice key on the card the disaster opened.", spec: { is: "string" }, test: (env, p) => env.choice === p.is },
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
  /** Extra template variables for this beat's words (`{defName}`). */
  vars?: Record<string, string>;
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
  if (on === "gate") return [env.state.gate.x + env.state.gate.w / 2, env.state.gate.z + env.state.gate.d / 2];
  const b = buildingRef(env, on);
  return b ? [b.x + b.w / 2, b.z + b.d / 2] : null;
}

function say(env: VerbEnv, text: string): string {
  const { state, run } = env;
  const target = run ? state.buildings.find((b) => b.id === run.target) : undefined;
  const vars: Record<string, string> = { ...templateVars(state, {}, env.rng), ...(run?.vars ?? {}), ...(env.vars ?? {}) };
  if (target) vars.target = BUILDINGS[target.kind].name;
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
  for (const d of run.diverts) {
    const crewOf = staffOf(state, d.job).filter((s) => s.machine.value !== "leaving");
    const want = Math.ceil(crewOf.length * d.fraction - 1e-9);
    let have = crewOf.filter((s) => s.divert?.owner === run.id && s.divert.to === d.to).length;
    for (const s of crewOf) {
      if (have >= want) break;
      if (s.divert) continue;
      divertStaff(s, run.id, d.to, d.jog);
      have++;
    }
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
    doc: "Pull `fraction` of a job off their posts and jog them to `to` (a building kind, `$target`, `$office` or `gate`) with a red \"!\". Their posts go unstaffed until `staff.release`, and new hires of the job are drawn in too.",
    spec: { job: "string", to: "string", fraction: "number?", jog: "number?" },
    verify: (p) => (["janitor", "sre", "comms", "security"].includes(p.job as string) ? null : "`job` is janitor, sre, comms or security"),
    run: (env, p) => {
      const { state, run } = env;
      const b = p.to === "gate" ? null : buildingRef(env, p.to as string);
      const to = b ? b.id : 0;
      const d = { job: p.job as StaffJob, to, fraction: num(p.fraction, 1), jog: num(p.jog, 1.8) };
      if (run) run.diverts = [...run.diverts.filter((o) => o.job !== d.job), d];
      if (run) enforceDiverts(state, run);
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
  "effects.end": {
    doc: "End this disaster's open-ended effects (the ones with no `days`: drain, spike, revenue, auditor), all of them or one `kind`. Effects with a `days` run their course.",
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
    doc: "Take a building offline (a flood, an outage): broken like a fire, with a toast instead of a headline.",
    spec: BUILDING({ text: "string?" }),
    run: (env, p) => {
      const b = buildingRef(env, p.building as string);
      if (!b || b.broken) return;
      wreck(env, b);
      addToast(env.state, say(env, typeof p.text === "string" ? p.text : "{target} is offline."), "bad");
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
    spec: { kind: "string", text: "string?" },
    verify: (p) => (p.kind as string) in BUILDINGS ? null : `unknown building "${p.kind as string}"`,
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
      if (!at) return void addToast(state, `No room for a ${BUILDINGS[kind].name}. The incident room is the gate.`, "neutral");
      if (typeof p.text === "string") addToast(state, say(env, p.text), "neutral");
    },
  },
  "hype.delta": { doc: "Add to hype (0 to 100).", spec: { amount: "number" }, run: (env, p) => void (env.state.hype = clamp100(env.state.hype + (p.amount as number))) },
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
      if (run) {
        run.vars.leapRival = RIVAL_BY_ID[rival.context.id as RivalId]?.name ?? rival.context.id;
        run.vars.leapModel = rival.context.model || "a model that is suspiciously familiar";
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
  shake: { doc: "Shake the screen, `strength` 0 to 1.", spec: { strength: "number" }, run: (env, p) => pushCue(env.state, { type: "shake", strength: Math.max(0, Math.min(1, p.strength as number)) }) },
  "sound.cue": {
    doc: "Play a sound cue: `alarm` (FLT-7's breakdown alarm), `card`, `era` or `release`.",
    spec: { cue: "string" },
    verify: (p) => (["alarm", "card", "era", "release"].includes(p.cue as string) ? null : "`cue` is alarm, card, era or release"),
    run: (env, p) => pushCue(env.state, { type: "sound", cue: p.cue === "alarm" ? "breakdown" : (p.cue as string) }),
  },
  news: {
    doc: "A ticker headline. `{lab}`, `{model}`, `{rival}`, `{cash}` and `{target}` are filled in, plus whatever the disaster's verbs set (`{leapRival}`).",
    spec: { text: "string", tone: "string?" },
    run: (env, p) => addNews(env.state, say(env, p.text as string), toneOf(p.tone)),
  },
  toast: { doc: "A toast over the map (same template variables as `news`).", spec: { text: "string", tone: "string?" }, run: (env, p) => addToast(env.state, say(env, p.text as string), toneOf(p.tone)) },
  card: {
    doc: "Open one of the disaster's event cards (`cards[].id`). The machine hears the player's pick as a CHOSE beat with the choice's `key`.",
    spec: { id: "string" },
    run: (env, p) => {
      const { state, run } = env;
      if (!run) return;
      const id = cardId(run.id, p.id as string);
      state.flags[offerFlag(id)] = state.day;
      run.card = id;
      // Cards are checked once a day; a disaster does not want to wait for midnight.
      dailyEvents(state);
    },
  },
  "people.meet": {
    doc: "A visitor with `role` walks in from the gate to meet the beat's first person by the first `at` building (a kind) and they talk for `hours`, in view. `lines` is what they say, visitor first, alternating.",
    spec: { role: "string", at: "string", hours: "number", lines: "strings?" },
    verify: (p) => ((p.at as string) in BUILDINGS ? null : `unknown building "${p.at as string}"`),
    run: (env, p) => {
      const host = env.people?.[0];
      if (host === undefined) return;
      callMeeting(env.state, env.rng, { owner: ownerOf(env), hostId: host, role: p.role as string, at: p.at as string, hours: p.hours as number, lines: ((p.lines as string[] | undefined) ?? []).map((l) => say(env, l)) });
    },
  },
  "people.quit": {
    doc: "Everyone the beat is about hands in the box and walks out through the gate. With `quiet`, the calling pack writes the exit headline instead of the usual one.",
    spec: { quiet: "boolean?" },
    run: (env, p) => {
      const { state, rng } = env;
      for (const id of env.people ?? []) {
        const w = state.walkers.find((o) => o.id === id);
        if (!w || w.machine.value === "quitting" || w.machine.value === "leaving") continue;
        if (p.quiet) state.flags[`quietExit:${w.id}`] = state.day;
        resign(state, w, rng);
      }
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
export function checkCall(call: Call, kind: "verb" | "guard", path: string): string[] {
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
    for (const key of ["guard"] as const) if (isCall(params[key])) errors.push(...checkCall(params[key] as Call, "guard", `${path}.params.${key}`));
    if (Array.isArray(params.guards)) (params.guards as Call[]).forEach((g, i) => errors.push(...checkCall(g, "guard", `${path}.params.guards[${i}]`)));
    if (type.startsWith("stat.") && typeof params.stat === "string" && !(params.stat in STATS)) {
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
  if (isCall(params.guard)) statsIn(params.guard as Call, into);
  if (Array.isArray(params.guards)) statsIn(params.guards as Call[], into);
  return into;
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
