// The Circus packs' chart compiler (FLT-21 The Hearing, FLT-24 the yacht): one flat JSON statechart from a pack's
// `content.arcs`, compiled to an XState machine that hears two beats, DAY and CHOSE (the same beats as FLT-37's
// generic mod-arc runner, so moving onto it later is mechanical). Pure: guards read the beat's stats and the pre-rolled
// die, transitions walk the pack's edges, and every verb comes back as an emitted CALL for the driver to run in order.
// A mechanic may pass a `fold`: arithmetic on its own context before the edges are tried (the hearing's tallies).
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { AnyStateMachine } from "xstate";
import type { ArcNode, NamedCallData } from "../../mods/schema";
import { step } from "../machines/run";
import { checkCall, normalize, passes, statsIn } from "../verbs";
import type { Call, Json } from "../disasters/types";

type Node = typeof ArcNode.Type;
export interface Chart { readonly id: string; readonly initial: string; readonly states: Readonly<Record<string, Node>> }

/** One beat. `stats` are the lab's numbers the driver measured today; `choice` is the player's pick on a CHOSE. */
export interface Beat {
  type: "DAY" | "CHOSE";
  tick: number;
  day: number;
  /** A die the driver rolled for this beat, in [0, 1). */
  roll: number;
  stats: Record<string, number>;
  choice?: string;
  /** Extra facts the driver pre-computed (the hearing's docket). Only a `fold` reads them. */
  data?: Record<string, Json>;
}
export interface CallOut { verb: string; params: Record<string, Json> }
/** Every chart's context has `enteredTick` (the `after` guard counts from it); a mechanic adds its own fields. */
export interface ChartContext { enteredTick: number; [key: string]: Json }
export interface ChartStored<C extends ChartContext = ChartContext> { value: string; context: C }
/** A mechanic's arithmetic before the edges: its next context, extra calls, and stats its guards may read. */
export type Fold<C extends ChartContext> = (ctx: C, beat: Beat, stage: string) => { ctx: C; calls?: CallOut[]; stats?: Record<string, number> };

const BeatSchema = Schema.Struct({
  tick: Schema.Number, day: Schema.Number, roll: Schema.Number, stats: Schema.Record(Schema.String, Schema.Number),
  choice: Schema.optionalKey(Schema.String), data: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)),
});
const chassis = setupEffect({ schemas: {
  context: Schema.Record(Schema.String, Schema.Json), input: Schema.Record(Schema.String, Schema.Json),
  events: { DAY: BeatSchema, CHOSE: BeatSchema },
  emitted: { CALL: Schema.Struct({ verb: Schema.String, params: Schema.Record(Schema.String, Schema.Json) }) },
} });
type Enq = { emit: (event: { type: "CALL" } & CallOut) => void };
const emitAll = (enq: Enq, calls: readonly NamedCallData[] = []) => {
  for (const c of calls) {
    const { type, params } = normalize(c as Call);
    enq.emit({ type: "CALL", verb: type, params });
  }
};

/** Every guard and verb the chart names, checked against the Vocabulary (plus the stats the mechanic measures itself). */
export function checkChart(chart: Chart, localStats: readonly string[] = []): string[] {
  const local = new Set(localStats);
  const errors: string[] = [];
  if (!(chart.initial in chart.states)) errors.push(`${chart.id}.initial: no state "${chart.initial}"`);
  for (const [name, node] of Object.entries(chart.states)) {
    const at = `${chart.id}.states.${name}`;
    for (const c of node.entry ?? []) errors.push(...checkCall(c as Call, "verb", `${at}.entry`));
    for (const c of node.exit ?? []) errors.push(...checkCall(c as Call, "verb", `${at}.exit`));
    for (const [event, raw] of Object.entries(node.on ?? {})) {
      if (event !== "DAY" && event !== "CHOSE") errors.push(`${at}.on.${event}: a Circus chart hears DAY and CHOSE`);
      for (const t of Array.isArray(raw) ? raw : [raw]) {
        const edge = typeof t === "string" ? { target: t } : t;
        if (edge.target && !(edge.target in chart.states)) errors.push(`${at}.on.${event}: no state "${edge.target}"`);
        if (edge.guard) errors.push(...checkCall(edge.guard as Call, "guard", `${at}.on.${event}.guard`, local));
        for (const c of edge.actions ?? []) errors.push(...checkCall(c as Call, "verb", `${at}.on.${event}.actions`));
      }
    }
  }
  return errors;
}

export function compileChart<C extends ChartContext>(chart: Chart, fold?: Fold<C>) {
  const handler = (stage: string, node: Node) => ({ context, event }: { context: C; event: Beat }, enq: Enq) => {
    const folded = fold ? fold(context, event, stage) : { ctx: context };
    const ctx = { ...folded.ctx };
    for (const c of folded.calls ?? []) enq.emit({ type: "CALL", ...c });
    const env = { day: event.day, tick: event.tick, roll: event.roll, stats: { ...event.stats, ...folded.stats }, ctx: { enteredTick: ctx.enteredTick, progress: 0, hours: 0 }, choice: event.choice };
    const raw = node.on?.[event.type];
    let target = stage;
    for (const t of raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]) {
      const edge = typeof t === "string" ? { target: t } : t;
      if (!passes(edge.guard as Call | undefined, env)) continue;
      emitAll(enq, edge.actions);
      if (edge.target) {
        target = edge.target;
        emitAll(enq, node.exit);
        emitAll(enq, chart.states[target]?.entry);
        ctx.enteredTick = event.tick;
      }
      break;
    }
    return { target, context: ctx }; // the alpha only keeps enq.emit when the transition returns
  };
  const states = Object.fromEntries(Object.entries(chart.states).map(([name, node]) => [name,
    node.type === "final" ? { type: "final" } : { on: { DAY: handler(name, node), CHOSE: handler(name, node) } },
  ]));
  const machine = chassis.createMachine({ context: ({ input }: { input: C }) => input, initial: chart.initial, states } as never) as unknown as AnyStateMachine;
  return {
    machine,
    fresh: (context: C): ChartStored<C> => ({ value: chart.initial, context }),
    step(stored: ChartStored<C>, beat: Beat): { stored: ChartStored<C>; calls: CallOut[] } {
      const result = step(machine, stored as never, beat as never);
      return { stored: result.stored as unknown as ChartStored<C>, calls: (result.effects as unknown as ({ type: "CALL" } & CallOut)[]).map(({ verb, params }) => ({ verb, params })) };
    },
  };
}

/** The stats a chart's guards name, so a driver only measures what the pack reads. */
export function chartStats(chart: Chart): string[] {
  const names = new Set<string>();
  for (const node of Object.values(chart.states)) for (const raw of Object.values(node.on ?? {})) for (const t of Array.isArray(raw) ? raw : [raw]) if (typeof t === "object") statsIn(t.guard as Call | undefined, names);
  return [...names];
}

/** A chart with its guards dropped: one synthetic event per edge, for `xstate/graph` reachability tests. */
export function structural(chart: Chart) {
  return {
    initial: chart.initial,
    states: Object.fromEntries(Object.entries(chart.states).map(([name, node]) => [name, node.type === "final" ? { type: "final" as const } : {
      on: Object.fromEntries(Object.entries(node.on ?? {}).flatMap(([event, raw]) => (Array.isArray(raw) ? raw : [raw]).flatMap((t, i) => {
        const target = typeof t === "string" ? t : t.target;
        return target ? [[`${event}:${i}`, target]] : [];
      }))),
    }])),
  };
}
