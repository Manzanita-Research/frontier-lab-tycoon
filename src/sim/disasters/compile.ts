// A disaster's JSON statechart, compiled to an XState machine (FLT-17). The World keeps `{ value, context }` and
// steps it with the pure `transition()` from machines/run.ts, like every other sim machine.
//
//   warning --TICK [after]--> active --CHOSE | TICK--> cleanup --TICK [progress.gte]--> aftermath --> done (final)
//
// The machine hears two events, both plain data: TICK (once a tick while the disaster runs: the tick, the day, a die
// the driver pre-rolled, the staff-hours done this tick, and the stats the chart's guards read) and CHOSE (the player
// answered a card the disaster opened). It draws no random numbers and touches no World: each verb a transition
// calls comes out as an emitted CALL, and the driver runs them in order. Like XState, the first enabled transition
// of a state wins: put the ones that leave the state first, and effects that repeat (`every`) after them.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { AnyStateMachine } from "xstate";
import { passes, normalize, type GuardEnv } from "../verbs";
import { step, type Stepped } from "../machines/run";
import type { Call, DisasterContext, DisasterDef, DisasterStored, Json, StateNode, TransitionDef } from "./types";

const Stats = Schema.Record(Schema.String, Schema.Number);
const beat = { tick: Schema.Number, day: Schema.Number, roll: Schema.Number, work: Schema.Number, stats: Stats };

const Context = Schema.Struct({
  id: Schema.String,
  startedDay: Schema.Number,
  enteredTick: Schema.Number,
  progress: Schema.Number,
  hours: Schema.Number,
});

const chassis = setupEffect({
  schemas: {
    context: Context,
    input: Context,
    events: {
      TICK: Schema.Struct(beat),
      CHOSE: Schema.Struct({ ...beat, choice: Schema.String }),
    },
    emitted: {
      /** Run this verb (sim/verbs.ts). */
      CALL: Schema.Struct({ verb: Schema.String, params: Schema.Record(Schema.String, Schema.Json) }),
    },
  },
});

export interface Beat {
  type: "TICK";
  tick: number;
  day: number;
  roll: number;
  /** Staff-hours of cleanup done this tick. */
  work: number;
  stats: Record<string, number>;
}
export interface Chose extends Omit<Beat, "type"> {
  type: "CHOSE";
  choice: string;
}
export type DisasterEvent = Beat | Chose;

export interface VerbCall {
  type: "CALL";
  verb: string;
  params: Record<string, Json>;
}

interface Enq {
  emit: (e: unknown) => void;
}

const asList = (t: TransitionDef | TransitionDef[] | undefined): TransitionDef[] => (t === undefined ? [] : Array.isArray(t) ? t : [t]);

function emitAll(enq: Enq, calls: readonly Call[] | undefined) {
  for (const call of calls ?? []) {
    const { type, params } = normalize(call);
    enq.emit({ type: "CALL", verb: type, params });
  }
}

/** The handler for one state and one beat: run the first transition whose guard holds. */
function handler(def: DisasterDef, node: StateNode, kind: "TICK" | "CHOSE") {
  const list = asList(node.on?.[kind]);
  return ({ context, event }: { context: DisasterContext; event: DisasterEvent }, enq: Enq) => {
    // Staff-hours come first, so `progress.gte` sees this tick's work.
    let ctx = context;
    if (node.work && kind === "TICK" && event.work > 0) {
      const hours = ctx.hours + event.work;
      ctx = { ...ctx, hours, progress: Math.min(1, hours / node.work.hours) };
    }
    const env: GuardEnv = { tick: event.tick, day: event.day, roll: event.roll, stats: event.stats, ctx, choice: event.type === "CHOSE" ? event.choice : undefined };
    for (const t of list) {
      if (!passes(t.guard, env)) continue;
      emitAll(enq, t.actions);
      if (t.target === undefined) return { context: ctx };
      emitAll(enq, node.exit);
      emitAll(enq, def.states[t.target]?.entry);
      return { target: t.target, context: { ...ctx, enteredTick: event.tick, progress: 0, hours: 0 } };
    }
    return ctx === context ? undefined : { context: ctx };
  };
}

export type DisasterMachine = AnyStateMachine;

const cache = new WeakMap<DisasterDef, DisasterMachine>();

/** The machine for a definition (built once per definition object). */
export function machineOf(def: DisasterDef): DisasterMachine {
  const hit = cache.get(def);
  if (hit) return hit;
  const states: Record<string, unknown> = {};
  for (const [name, node] of Object.entries(def.states)) {
    states[name] = node.type === "final" ? { type: "final" } : { on: { TICK: handler(def, node, "TICK"), CHOSE: handler(def, node, "CHOSE") } };
  }
  const machine = chassis.createMachine({ context: ({ input }: { input: DisasterContext }) => input, initial: def.initial, states } as never) as unknown as DisasterMachine;
  cache.set(def, machine);
  return machine;
}

/** A disaster at the moment it starts (its `entry` calls are the driver's to run). */
export const startStored = (def: DisasterDef, day: number, tick: number): DisasterStored => ({
  value: def.initial,
  context: { id: def.id, startedDay: day, enteredTick: tick, progress: 0, hours: 0 },
});

/** One beat: the next stored state and the verbs to run, in order. */
export function stepDisaster(def: DisasterDef, stored: DisasterStored, event: DisasterEvent): { stored: DisasterStored; calls: { verb: string; params: Record<string, Json> }[] } {
  const r = step(machineOf(def), stored as never, event as never) as Stepped<DisasterMachine>;
  return {
    stored: r.stored as unknown as DisasterStored,
    calls: (r.effects as unknown as VerbCall[]).filter((e) => e.type === "CALL").map((e) => ({ verb: e.verb, params: e.params })),
  };
}

export const isFinal = (def: DisasterDef, value: string): boolean => def.states[value]?.type === "final";
