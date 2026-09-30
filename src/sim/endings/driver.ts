// Endings (FLT-11): the driver. Once a day it keeps the run summary's peaks, puts The Memo on the table in Era 4, and
// checks each ending's trigger in pack order; the first that holds starts. From then on, only that ending's chart is
// stepped, once a tick, with the pure `transition()` (the disaster compiler builds it: the same statechart format and
// the same Vocabulary), until it reaches its final state: the front page.
//
// The endings own how a game finishes: Acqui-hired comes before the goals' bankruptcy loss and The Pivot before the
// deadline, and while an ending runs (or once the Memo is answered) the goals machine is not asked any more.
import { SCENARIO } from "../../content/goals";
import { startStored, stepDisaster, isFinal } from "../disasters/compile";
import type { DisasterDef, DisasterRun, Json, StateNode } from "../disasters/types";
import { fillTemplate } from "../format";
import { templateVars } from "../news";
import { protesterCount } from "../protest";
import { eraOfState } from "../race/race";
import type { Rng } from "../rng";
import type { GameState } from "../types";
import { checkCall, passes, runVerb, STATS, type VerbEnv } from "../verbs";
import { updateAutopilot } from "./autopilot";
import { ENDING_RULES, ENDINGS, MEMO_OFFER, MEMO_RACE, MEMO_SLOW, endingById, type EndingDef } from "./pack";
import type { EndingsState } from "./state";

// ---- Stats the triggers read ----------------------------------------------------------------------------------

const flagDay = (state: GameState, name: string) => state.flags[name];

/** The numbers an ending's trigger may name, on top of the Vocabulary's STATS. */
export const ENDING_STATS: Record<string, (state: GameState) => number> = {
  /** FLT-22's Capture meter, 0 to 100. Absent (that PR not merged, or an old save) reads as 0, so Captured never fires. */
  capture: (s) => (s as { capture?: number }).capture ?? 0,
  era: (s) => eraOfState(s),
  rank: (s) => s.race.rank,
  /** 1 while you're at the front of the Arena (`rules.takeover.aheadRank` or better). */
  ahead: (s) => (s.race.rank <= ENDING_RULES.takeover.aheadRank ? 1 : 0),
  memoRace: (s) => (flagDay(s, MEMO_RACE) !== undefined ? 1 : 0),
  memoSlow: (s) => (flagDay(s, MEMO_SLOW) !== undefined ? 1 : 0),
  /** Days since you ticked Race (0 if you didn't). */
  racedDays: (s) => (flagDay(s, MEMO_RACE) !== undefined ? s.day - flagDay(s, MEMO_RACE)! : 0),
  /** The goals' two losses, as 1 or 0: cash under the floor, and the deadline come without a win. */
  broke: (s) => (s.cash < SCENARIO.brokeBelow ? 1 : 0),
  deadline: (s) => (s.day >= SCENARIO.deadlineDay && s.goals.value !== "won" ? 1 : 0),
  won: (s) => (s.goals.value === "won" ? 1 : 0),
};
export const ENDING_STAT_NAMES = Object.keys(ENDING_STATS);

function statsOf(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, f] of Object.entries(ENDING_STATS)) out[name] = f(state);
  for (const name of TRIGGER_STATS) if (!(name in out)) out[name] = STATS[name]?.(state, null) ?? 0;
  return out;
}

/** Vocabulary stats the triggers name (cash, day, hype, ...), so they are computed only if asked for. */
const TRIGGER_STATS = new Set<string>();
for (const e of ENDINGS) for (const g of e.trigger) collectStats(g as never, TRIGGER_STATS);
function collectStats(call: { type?: string; params?: Record<string, Json> } | string, into: Set<string>) {
  if (typeof call === "string") return;
  const p = call.params ?? {};
  if (typeof p.stat === "string") into.add(p.stat);
  if (p.guard && typeof p.guard === "object") collectStats(p.guard as never, into);
  if (Array.isArray(p.guards)) for (const g of p.guards) collectStats(g as never, into);
}

// ---- The ending's own verbs -------------------------------------------------------------------------------------

type Params = Record<string, Json>;

function say(env: VerbEnv, text: string): string {
  return fillTemplate(text, { ...templateVars(env.state, {}, env.rng), ...(env.run?.vars ?? {}) });
}

/** Two generic verbs only an ending's chart has: set a presentation cue, and hand the controls to the autopilot. */
export const ENDING_VERBS: Record<string, { doc: string; run: (env: VerbEnv, e: EndingsState, p: Params) => void; check: (p: Params) => string | null }> = {
  "look.set": {
    doc: "Set a presentation cue the renderer and HUD read (`beige`, `stickers`, `acquired`, `managedBy`, `thanks`, `captured`, `officeMoved`, `pivot`). String values are templates.",
    check: (p) => (typeof p.key === "string" && ["string", "number", "boolean"].includes(typeof p.value) ? null : "needs `key` (string) and `value` (string, number or boolean)"),
    run: (env, e, p) => {
      e.look[p.key as string] = typeof p.value === "string" ? say(env, p.value) : (p.value as number | boolean);
    },
  },
  "autopilot.start": {
    doc: "The lab's newest model starts building for you: the cursor moves by itself, and your own build commands are declined.",
    check: () => null,
    run: (env, e) => {
      e.autopilot.on = true;
      e.autopilot.nextTick = env.state.tick;
    },
  },
  "autopilot.stop": {
    doc: "Hand the controls back.",
    check: () => null,
    run: (_env, e) => {
      e.autopilot.on = false;
      e.autopilot.target = null;
    },
  },
};

function runCall(env: VerbEnv, e: EndingsState, verb: string, params: Params) {
  const own = ENDING_VERBS[verb];
  if (own) own.run(env, e, params);
  else runVerb(env, { type: verb, params });
}

// ---- Charts -------------------------------------------------------------------------------------------------------

const charts = new Map<string, DisasterDef>();

/** The ending's chart in the shape the disaster compiler takes (it reads only `initial` and `states`). */
export function chartOf(def: EndingDef): DisasterDef {
  let c = charts.get(def.id);
  if (!c) {
    c = { id: def.id, name: def.title, blurb: def.text, odds: { weight: 0 }, initial: def.initial, states: def.states as unknown as Record<string, StateNode> };
    charts.set(def.id, c);
  }
  return c;
}

/** The model that takes over: one past your latest release ("Frontier-9"). */
export function managerName(state: GameState): string {
  const m = /^Frontier-(\d+)/.exec(state.models.at(-1) ?? "");
  return `Frontier-${m ? Number(m[1]) + ENDING_RULES.takeover.managerOffset : 9}`;
}

/** A die for the chart's `chance` guards that leaves the main stream alone (none of the shipped endings roll). */
const dieOf = (tick: number) => (((tick + 1) * 2654435761) >>> 0) / 2 ** 32;

function beat(state: GameState) {
  return { type: "TICK" as const, tick: state.tick, day: state.day, roll: dieOf(state.tick), work: 0, stats: statsOf(state) };
}

/** Start an ending now: the forced path the dev hooks and `?moment=` use, and the one the daily check takes. */
export function startEnding(state: GameState, rng: Rng, id: string) {
  const e = state.endings;
  const def = endingById(id);
  if (!e || !def || e.run) return;
  const chart = chartOf(def);
  const run: DisasterRun = {
    id: `ending:${def.id}`,
    startedDay: state.day,
    startedTick: state.tick,
    machine: startStored(chart, state.day, state.tick),
    target: 0,
    fires: [],
    card: null,
    diverts: [],
    vars: { manager: managerName(state), placed: "0", models: String(state.models.length), day: String(state.day) },
    forced: false,
  };
  e.run = run;
  e.id = def.id;
  // The Memo is moot once the game is ending.
  delete state.flags[MEMO_OFFER];
  const env: VerbEnv = { state, rng, run, owner: run.id };
  for (const call of chart.states[chart.initial]?.entry ?? []) {
    const c = typeof call === "string" ? { type: call, params: {} } : { type: call.type, params: call.params ?? {} };
    runCall(env, e, c.type, c.params);
  }
}

// ---- The loop -------------------------------------------------------------------------------------------------------

/** Once a day: the peaks, the Memo, and the triggers. */
export function dailyEndings(state: GameState, rng: Rng) {
  const e = state.endings;
  if (!e) return;
  e.peakVibes = Math.max(e.peakVibes, Math.round(state.vibes.value));
  e.peakProtesters = Math.max(e.peakProtesters, protesterCount(state));
  const swarm = state.disasters.lastByDef.rogueSwarm;
  if (swarm !== undefined && swarm !== e.swarmDay) {
    e.swarmDay = swarm;
    e.agentsEscaped += state.walkers.reduce((n, w) => n + (w.kind === "agent" ? 1 : 0), 0);
  }
  const era = eraOfState(state);
  while (e.eraDays.length < era) e.eraDays.push(state.day);
  if (e.run) return;
  if (era >= ENDING_RULES.memo.era && state.flags["memo:offered"] === undefined) {
    state.flags["memo:offered"] = state.day;
    state.flags[MEMO_OFFER] = state.day;
  }
  const env = { tick: state.tick, day: state.day, roll: dieOf(state.tick), stats: statsOf(state), ctx: { enteredTick: 0, progress: 0, hours: 0 } };
  for (const def of ENDINGS) {
    if (def.trigger.every((g) => passes(g as never, env))) {
      startEnding(state, rng, def.id);
      return;
    }
  }
}

/** Once a tick: the running ending's chart, and the autopilot. */
export function updateEndings(state: GameState, rng: Rng) {
  const e = state.endings;
  if (!e?.run) return;
  updateAutopilot(state, e, rng);
  if (e.endedDay !== null) return;
  const def = endingById(e.id!)!;
  const chart = chartOf(def);
  e.run.vars.models = String(state.models.length);
  e.run.vars.day = String(state.day);
  const { stored, calls } = stepDisaster(chart, e.run.machine, beat(state));
  e.run.machine = stored;
  const env: VerbEnv = { state, rng, run: e.run, owner: e.run.id };
  for (const c of calls) runCall(env, e, c.verb, c.params);
  if (isFinal(chart, stored.value)) e.endedDay = state.day;
}

/** The goals machine only decides the game while no ending has it (and nobody has answered the Memo). */
export const endingsOwnTheGame = (state: GameState): boolean => !!state.endings && (state.endings.run !== null || state.flags[MEMO_RACE] !== undefined || state.flags[MEMO_SLOW] !== undefined);

/** Time stops for good after an ending that doesn't let you carry on (Acqui-hired, The Pivot). */
export function endingHalts(state: GameState): boolean {
  const e = state.endings;
  if (!e || e.endedDay === null || !e.id) return false;
  return !(endingById(e.id)?.keepPlaying ?? false);
}

// ---- Checking the pack ----------------------------------------------------------------------------------------------

/** Every call in the endings, checked against the Vocabulary plus the ending's own verbs and stats. Empty when fine. */
export function validateEndings(defs: readonly EndingDef[] = ENDINGS): string[] {
  const errors: string[] = [];
  const guard = (g: unknown, path: string) => {
    for (const err of checkCall(g as never, "guard", path)) {
      const unknown = /unknown stat "(\w+)"/.exec(err);
      if (unknown && ENDING_STAT_NAMES.includes(unknown[1]!)) continue;
      errors.push(err);
    }
  };
  const verb = (v: unknown, path: string) => {
    const name = typeof v === "string" ? v : (v as { type?: string }).type ?? "";
    const own = ENDING_VERBS[name];
    if (own) {
      const why = own.check(typeof v === "string" ? {} : ((v as { params?: Params }).params ?? {}));
      if (why) errors.push(`${path}: ${why}`);
    } else errors.push(...checkCall(v as never, "verb", path));
  };
  defs.forEach((d) => {
    const at = `endings.${d.id}`;
    d.trigger.forEach((g, i) => guard(g, `${at}.trigger[${i}]`));
    for (const [name, node] of Object.entries(d.states)) {
      const p = `${at}.states.${name}`;
      (node.entry ?? []).forEach((v, i) => verb(v, `${p}.entry[${i}]`));
      (node.exit ?? []).forEach((v, i) => verb(v, `${p}.exit[${i}]`));
      for (const [ev, ts] of Object.entries(node.on ?? {})) {
        if (ev !== "TICK") errors.push(`${p}.on.${ev}: an ending only hears TICK`);
        const list = Array.isArray(ts) ? ts : [ts];
        list.forEach((t, i) => {
          if (typeof t === "string") return errors.push(`${p}.on.${ev}[${i}]: write { target } rather than a bare string`);
          if (t.target !== undefined && !(t.target in d.states)) errors.push(`${p}.on.${ev}[${i}].target: no state "${t.target}"`);
          if (t.guard) guard(t.guard, `${p}.on.${ev}[${i}].guard`);
          ((t.actions ?? []) as readonly unknown[]).forEach((v, j) => verb(v, `${p}.on.${ev}[${i}].actions[${j}]`));
        });
      }
    }
  });
  return errors;
}
