// A pack's JSON statechart as a pure XState machine (FLT-26, FLT-20). The chart owns the edges, guards and verbs;
// the driver computes the stats a guard reads (and pre-rolls any dice into them) and sends DAY and CHOSE beats.
// Every beat returns `{ target, context }`: the v6 alpha drops enq.emit from a transition that returns nothing.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { AnyStateMachine } from "xstate";
import type { ArcNode, NamedCallData } from "../../mods/schema";
import type { Call, Json } from "../disasters/types";
import { normalize, passes } from "../verbs";
import { step } from "./run";

type Node = typeof ArcNode.Type;
export interface ChartData {
  readonly id: string;
  readonly initial: string;
  readonly states: Readonly<Record<string, Node>>;
}
export const ChartContext = Schema.Struct({ enteredTick: Schema.Number, enteredDay: Schema.Number });
export interface ChartContext extends Schema.Schema.Type<typeof ChartContext> {}
const Beat = { day: Schema.Number, tick: Schema.Number, stats: Schema.Record(Schema.String, Schema.Number) };
export type ChartEvent =
  | { type: "DAY"; day: number; tick: number; stats: Record<string, number> }
  | { type: "CHOSE"; choice: string; day: number; tick: number; stats: Record<string, number> };
export interface ChartStored<S extends string = string> { value: S; context: ChartContext }
export interface ChartCall { type: "CALL"; verb: string; params: Record<string, Json> }

type Enq = { emit: (event: ChartCall) => void };
const emitAll = (enq: Enq, calls: readonly NamedCallData[] = []) => {
  for (const c of calls) {
    const { type, params } = normalize(c as Call);
    enq.emit({ type: "CALL", verb: type, params });
  }
};

/** Compile a flat chart (no nested states). Transitions are tried in order; the first whose guard passes wins. */
export function compileChart(chart: ChartData): AnyStateMachine {
  const chassis = setupEffect({ schemas: {
    context: ChartContext, input: ChartContext,
    events: { DAY: Schema.Struct(Beat), CHOSE: Schema.Struct({ ...Beat, choice: Schema.String }) },
    emitted: { CALL: Schema.Struct({ verb: Schema.String, params: Schema.Record(Schema.String, Schema.Json) }) },
  } });
  const handler = (stage: string, node: Node) => ({ context, event }: { context: ChartContext; event: ChartEvent }, enq: Enq) => {
    const raw = node.on?.[event.type];
    const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    let target = stage;
    const ctx = { ...context };
    for (const rawTransition of list) {
      const t = typeof rawTransition === "string" ? { target: rawTransition } : rawTransition;
      const env = { day: event.day, tick: event.tick, roll: event.stats.roll ?? 0, stats: event.stats, ctx: { enteredTick: ctx.enteredTick, progress: 0, hours: 0 }, choice: event.type === "CHOSE" ? event.choice : undefined };
      if (!passes(t.guard as Call | undefined, env)) continue;
      emitAll(enq, t.actions);
      if (t.target) {
        target = t.target;
        emitAll(enq, node.exit);
        emitAll(enq, chart.states[target]?.entry);
        ctx.enteredTick = event.tick;
        ctx.enteredDay = event.day;
      }
      break;
    }
    return { target, context: ctx };
  };
  const states = Object.fromEntries(Object.entries(chart.states).map(([name, node]) => [name,
    node.type === "final" ? { type: "final" } : { on: { DAY: handler(name, node), CHOSE: handler(name, node) } },
  ]));
  return chassis.createMachine({ context: ({ input }: { input: ChartContext }) => input, initial: chart.initial, states } as never) as unknown as AnyStateMachine;
}

export function stepChart<S extends string>(machine: AnyStateMachine, stored: ChartStored<S>, event: ChartEvent) {
  const result = step(machine, stored as never, event as never);
  return { stored: result.stored as unknown as ChartStored<S>, calls: result.effects as unknown as ChartCall[] };
}

/** The chart with guards dropped, one synthetic event per edge: what `xstate/graph` walks to prove every state is reachable. */
export function structuralChart(chart: ChartData) {
  return {
    initial: chart.initial,
    states: Object.fromEntries(Object.entries(chart.states).map(([name, node]) => [name,
      node.type === "final" ? { type: "final" as const } : {
        on: Object.fromEntries(Object.entries(node.on ?? {}).flatMap(([event, raw]) =>
          (Array.isArray(raw) ? raw : [raw]).flatMap((t, i) => {
            const target = typeof t === "string" ? t : t?.target;
            return target ? [[`${event}:${i}`, target]] : [];
          }),
        )),
      },
    ])),
  };
}
