// A mod's story arcs (FLT-37): the JSON statecharts in `content.arcs` (and arc-shaped `content.events`), compiled to
// XState machines and stepped with the pure `transition()`, like the disasters (disasters/compile.ts).
//
// An arc hears two events, both plain data: DAY (once a game day, at midnight) and CHOSE (the player answered a
// card; `card` is its id, `choice` its position as a string). The beat carries the day, the tick, a die the driver
// rolled (only for arcs that use `chance`), and the stats and flags the arc's guards name. Guards and actions are the
// Vocabulary (sim/verbs.ts): guards read the beat, actions come out as emitted CALLs that the driver runs in order.
//
// Nested states are flattened: the World keeps the leaf's path (`playing/waiting`). A leaf hears its own transitions
// first, then its parents' (deepest first, like XState); the first whose guard holds wins. Moving exits the states
// being left, deepest first, and enters the new ones, outermost first. Moving to where you already are runs no
// exit or entry. A top-level `final` state stops the arc.
//
// No arcs, no work: the World has no `modArcs` until a modded run's first beat, and no die is drawn for an arc
// that never rolls one, so an unmodded run is byte-identical.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { AnyStateMachine } from "xstate";
import type { ArcData, NamedCallData } from "../mods/schema";
import { TICKS_PER_DAY } from "./constants";
import { defs } from "./defs";
import type { Call, Json } from "./disasters/types";
import { step, type Stepped } from "./machines/run";
import { createRng, type Rng } from "./rng";
import type { GameState } from "./types";
import { flagsIn, normalize, passes, runVerb, statsIn, statValue, usesChance, type GuardEnv } from "./verbs";
import { systemUnlocked } from "./progression";

type ArcNode = ArcData["states"][string];
type Transition = { target?: string; guard?: Call | Call[]; actions?: readonly Call[] };

const Numbers = Schema.Record(Schema.String, Schema.Number);
const beat = { tick: Schema.Number, day: Schema.Number, roll: Schema.Number, stats: Numbers, flags: Numbers };
const Context = Schema.Struct({ enteredTick: Schema.Number });

const chassis = setupEffect({
  schemas: {
    context: Context,
    input: Context,
    events: {
      DAY: Schema.Struct(beat),
      CHOSE: Schema.Struct({ ...beat, card: Schema.String, choice: Schema.String }),
    },
    emitted: {
      /** Run this verb (sim/verbs.ts). */
      CALL: Schema.Struct({ verb: Schema.String, params: Schema.Record(Schema.String, Schema.Json) }),
    },
  },
});

/** What the World keeps for one arc: the leaf it is in and when it got there. */
export interface ModArcStored {
  value: string;
  context: { enteredTick: number };
}

interface ArcBeat {
  tick: number;
  day: number;
  roll: number;
  stats: Record<string, number>;
  flags: Record<string, number>;
}
type ArcEvent = (ArcBeat & { type: "DAY" }) | (ArcBeat & { type: "CHOSE"; card: string; choice: string });

interface Enq {
  emit: (e: unknown) => void;
}

interface Compiled {
  machine: AnyStateMachine;
  /** The leaf the arc starts in, and the entry calls of every state on the way down to it. */
  initial: string;
  entry: Call[];
  leaves: Set<string>;
  done: Set<string>;
  stats: string[];
  flags: string[];
  rolls: boolean;
  /**
   * No transition of the leaf or its parents holds for this beat, so the machine would stay put and emit nothing: the
   * driver can skip `transition()` (FLT-39; most arcs sit out most midnights). The same walk the handler does.
   */
  quiet: (stored: ModArcStored, event: ArcEvent) => boolean;
}

const asCall = (c: NamedCallData): Call => c as Call;
const flat = (path: string) => path.replaceAll(".", "/");
const parentOf = (path: string) => (path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : "");
/** The path and every ancestor, deepest first. */
const chainOf = (path: string): string[] => {
  const out = [path];
  for (let p = parentOf(path); p; p = parentOf(p)) out.push(p);
  return out;
};

function transitionsOf(node: ArcNode, kind: string): Transition[] {
  const raw = node.on?.[kind];
  if (raw === undefined) return [];
  const list = (Array.isArray(raw) ? raw : [raw]) as readonly (string | { target?: string; guard?: NamedCallData | readonly NamedCallData[]; actions?: readonly NamedCallData[] })[];
  const guardOf = (g: NamedCallData | readonly NamedCallData[] | undefined) => (g === undefined ? undefined : Array.isArray(g) ? g.map(asCall) : asCall(g as NamedCallData));
  return list.map((t) => (typeof t === "string" ? { target: t } : { target: t.target, guard: guardOf(t.guard), actions: t.actions?.map(asCall) }));
}

function emitAll(enq: Enq, calls: readonly (NamedCallData | Call)[] | undefined) {
  for (const call of calls ?? []) {
    const { type, params } = normalize(call as Call);
    enq.emit({ type: "CALL", verb: type, params });
  }
}

const cache = new WeakMap<ArcData, Compiled>();

/** An arc's machine and what the driver needs to feed it (exported for its tests). */
export function compile(arc: ArcData): Compiled {
  const hit = cache.get(arc);
  if (hit) return hit;
  const nodes = new Map<string, ArcNode>();
  const collect = (states: ArcData["states"], parent: string) => {
    for (const [key, node] of Object.entries(states)) {
      const path = parent ? `${parent}.${key}` : key;
      nodes.set(path, node);
      if (node.states) collect(node.states, path);
    }
  };
  collect(arc.states, "");
  // A compound state is entered through its `initial` child, all the way down.
  const leafOf = (path: string): string => {
    let p = path;
    for (let node = nodes.get(p); node?.states && node.initial; node = nodes.get(p)) p = `${p}.${node.initial}`;
    return p;
  };
  // Targets name a sibling, or (starting with ".") a child: the loader's validateArc uses the same rule.
  const resolve = (from: string, target: string) => (target.startsWith(".") ? `${from}${target}` : parentOf(from) ? `${parentOf(from)}.${target}` : target);

  const guards: Call[] = [];
  const states: Record<string, unknown> = {};
  const leaves = new Set<string>();
  const done = new Set<string>();
  // Each leaf's own state and its parents, deepest first, and every state's transitions by event: built once.
  const chains = new Map<string, string[]>();
  const on = new Map<string, Record<"DAY" | "CHOSE", Transition[]>>();
  for (const [path, node] of nodes) on.set(path, { DAY: transitionsOf(node, "DAY"), CHOSE: transitionsOf(node, "CHOSE") });
  const envOf = (context: ModArcStored["context"], event: ArcEvent): GuardEnv => ({
    tick: event.tick, day: event.day, roll: event.roll, stats: event.stats, flags: event.flags,
    // An arc only hears midnights and answers, so it counts `after`/`every` from the start of the day it began.
    ctx: { enteredTick: context.enteredTick - (context.enteredTick % TICKS_PER_DAY), progress: 0, hours: 0 },
    ...(event.type === "CHOSE" ? { card: event.card, choice: event.choice } : {}),
  });
  for (const [path, node] of nodes) {
    for (const kind of Object.keys(node.on ?? {})) for (const t of transitionsOf(node, kind)) if (t.guard) guards.push(...[t.guard].flat());
    if (node.states) continue;
    const key = flat(path);
    leaves.add(key);
    if (node.type === "final" && !path.includes(".")) {
      done.add(key);
      states[key] = { type: "final" };
      continue;
    }
    const chain = chainOf(path);
    chains.set(key, chain);
    const handler = (kind: "DAY" | "CHOSE") => ({ context, event }: { context: ModArcStored["context"]; event: ArcEvent }, enq: Enq) => {
      const env = envOf(context, event);
      for (const from of chain) {
        for (const t of on.get(from)![kind]) {
          if (!passes(t.guard, env)) continue;
          emitAll(enq, t.actions);
          if (t.target === undefined) return { context };
          const next = leafOf(resolve(from, t.target));
          const into = chainOf(next);
          for (const p of chain) if (!into.includes(p)) emitAll(enq, nodes.get(p)!.exit);
          for (const p of [...into].reverse()) if (!chain.includes(p)) emitAll(enq, nodes.get(p)!.entry);
          return { target: flat(next), context: next === path ? context : { enteredTick: event.tick } };
        }
      }
      return undefined;
    };
    states[key] = { on: { DAY: handler("DAY"), CHOSE: handler("CHOSE") } };
  }

  const start = leafOf(arc.initial);
  const machine = chassis.createMachine({ id: arc.id, context: ({ input }: { input: ModArcStored["context"] }) => input, initial: flat(start), states } as never) as unknown as AnyStateMachine;
  const compiled: Compiled = {
    machine,
    initial: flat(start),
    entry: [...chainOf(start)].reverse().flatMap((p) => (nodes.get(p)!.entry ?? []).map(asCall)),
    leaves,
    done,
    stats: [...statsIn(guards)],
    flags: [...flagsIn(guards)],
    rolls: usesChance(guards),
    quiet: (stored, event) => {
      const chain = chains.get(stored.value);
      if (!chain) return false;
      const env = envOf(stored.context, event);
      for (const from of chain) for (const t of on.get(from)![event.type]) if (passes(t.guard, env)) return false;
      return true;
    },
  };
  cache.set(arc, compiled);
  return compiled;
}

function runCalls(state: GameState, rng: Rng, owner: string, calls: readonly Call[]) {
  for (const call of calls) runVerb({ state, rng, run: null, owner }, call);
}

/**
 * An arc that `requires` systems sleeps until they are all unlocked (FLT-33): the factions' arcs until Level 4 turns
 * the factions on, the water escalation until the protests. It keeps its place while asleep. `flags["arcOff:<id>"]`
 * switches one off for the run (`?water=off` is the water escalation's).
 */
function awake(state: GameState, arc: ArcData): boolean {
  if (state.flags[`arcOff:${arc.id}`] !== undefined) return false;
  for (const system of arc.requires ?? []) {
    if (!systemUnlocked(state, system)) return false;
    if (system === "factions" && !state.factions) return false;
  }
  return true;
}

function hear(state: GameState, main: Rng, arc: ArcData, event: { type: "DAY" } | { type: "CHOSE"; card: string; choice: string }) {
  if (!awake(state, arc)) return;
  // A faction's arc rolls the factions' own dice, so the factions never move a draw in the main stream.
  const own = arc.requires?.includes("factions") && state.factions ? createRng(state.factions.rngState) : null;
  const rng = own ?? main;
  heard(state, rng, arc, event);
  if (own && state.factions) state.factions.rngState = own.state();
}

function heard(state: GameState, rng: Rng, arc: ArcData, event: { type: "DAY" } | { type: "CHOSE"; card: string; choice: string }) {
  const c = compile(arc);
  const all = (state.modArcs ??= {});
  let stored = all[arc.id];
  // First beat of the run (or the mod changed under a save): start at the top and run the entry calls.
  if (!stored || !c.leaves.has(stored.value)) {
    stored = all[arc.id] = { value: c.initial, context: { enteredTick: state.tick } };
    runCalls(state, rng, arc.id, c.entry);
  }
  if (c.done.has(stored.value)) return;
  const stats: Record<string, number> = {};
  for (const name of c.stats) stats[name] = statValue(state, name);
  const flags: Record<string, number> = {};
  for (const name of c.flags) if (state.flags[name] !== undefined) flags[name] = state.flags[name]!;
  const beat: ArcBeat = { tick: state.tick, day: state.day, roll: c.rolls ? rng.next() : 0, stats, flags };
  if (c.quiet(stored, { ...beat, ...event })) return;
  const r = step(c.machine, stored as never, { ...beat, ...event } as never) as Stepped<AnyStateMachine>;
  all[arc.id] = r.stored as unknown as ModArcStored;
  for (const e of r.effects as unknown as { type: string; verb: string; params: Record<string, Json> }[]) {
    if (e.type === "CALL") runVerb({ state, rng, run: null, owner: arc.id }, { type: e.verb, params: e.params });
  }
}

/** Midnight: every arc hears DAY, in content order. The tick only calls this when the run has arcs. */
export function dailyModArcs(state: GameState, rng: Rng) {
  for (const arc of defs().arcs) hear(state, rng, arc, { type: "DAY" });
}

/** The player answered a card: every arc hears CHOSE with the card's id and the choice's position. */
export function modArcsHeard(state: GameState, rng: Rng, card: string, choiceIndex: number) {
  for (const arc of defs().arcs) hear(state, rng, arc, { type: "CHOSE", card, choice: String(choiceIndex) });
}
