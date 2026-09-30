// Pure XState compiler for the pack's single DAY/CHOSE chart. Arithmetic stays small; dice arrive in the event.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { AnyStateMachine } from "xstate";
import type { ArcNode, NamedCallData } from "../../mods/schema";
import { step } from "../machines/run";
import { normalize, passes } from "../verbs";
import type { Call, Json } from "../disasters/types";
import { COLLUSION } from "./pack";
import type { SwarmStage } from "./state";

type ArcNodeData = typeof ArcNode.Type;
const R = COLLUSION.rules;
export const SwarmContext = Schema.Struct({
  score: Schema.Number, seededDay: Schema.Number, enteredTick: Schema.Number,
  progress: Schema.Number, hours: Schema.Number, noticed: Schema.Boolean,
  investigationUntil: Schema.Number, investigationDays: Schema.Number, staffDays: Schema.Number,
  attempts: Schema.Number, retryDay: Schema.Number,
});
export interface SwarmContext extends Schema.Schema.Type<typeof SwarmContext> {}
const Day = Schema.Struct({
  day: Schema.Number, tick: Schema.Number, seedRoll: Schema.Number, catchRoll: Schema.Number,
  agents: Schema.Number, capability: Schema.Number, pressure: Schema.Number,
  reliability: Schema.Number, security: Schema.Number, arrived: Schema.Number,
});
export interface SwarmDay extends Schema.Schema.Type<typeof Day> { type: "DAY" }
export type SwarmEvent = SwarmDay | { type: "CHOSE"; choice: string; day: number; tick: number };
export interface SwarmStored { value: SwarmStage; context: SwarmContext }
export const freshSwarm = (): SwarmStored => ({ value: "dormant", context: {
  score: 0, seededDay: -1, enteredTick: 0, progress: 0, hours: 0, noticed: false,
  investigationUntil: -1, investigationDays: 0, staffDays: 0, attempts: 0, retryDay: 0,
} });

export function seedChance(e: Pick<SwarmDay, "day" | "agents" | "capability" | "pressure" | "reliability" | "security">): number {
  const r = R.seeding;
  if (e.day < r.minDay || e.agents < r.minAgents) return 0;
  return Math.min(r.maxChance, (r.base + e.agents * r.perAgent + e.capability * r.perCapability + e.pressure * r.perPressure + (1 - e.reliability) * r.perUnreliability) / (1 + e.security * r.securityReduction));
}
export function catchChance(staff: number, stage: SwarmStage): number {
  if (staff <= 0) return 0;
  const r = R.investigation;
  const penalty = stage === "organized" ? 2 : stage === "spreading" ? 1 : 0;
  return Math.max(0, Math.min(r.maxChance, r.base + staff * r.perStaff - penalty * r.stagePenalty));
}
const chassis = setupEffect({ schemas: {
  context: SwarmContext, input: SwarmContext,
  events: { DAY: Day, CHOSE: Schema.Struct({ choice: Schema.String, day: Schema.Number, tick: Schema.Number }) },
  emitted: { CALL: Schema.Struct({ verb: Schema.String, params: Schema.Record(Schema.String, Schema.Json) }) },
} });
type Enq = { emit: (event: { type: "CALL"; verb: string; params: Record<string, Json> }) => void };
const emitAll = (enq: Enq, calls: readonly NamedCallData[] = []) => {
  for (const c of calls) {
    const { type, params } = normalize(c as Call);
    enq.emit({ type: "CALL", verb: type, params });
  }
};
function handler(stage: SwarmStage, node: ArcNodeData) {
  return ({ context, event }: { context: SwarmContext; event: SwarmEvent }, enq: Enq) => {
    let ctx = { ...context };
    let caught = false;
    if (event.type === "DAY") {
      if (stage === "seeded" || stage === "spreading" || stage === "organized") ctx.score = Math.min(100, ctx.score + R.growth[stage]);
      if (ctx.investigationUntil >= 0) {
        ctx.staffDays += event.arrived;
        ctx.investigationDays++;
        if (event.day >= ctx.investigationUntil) {
          caught = event.catchRoll < catchChance(ctx.staffDays / ctx.investigationDays, stage);
          ctx.investigationUntil = -1;
          ctx.retryDay = event.day + R.investigation.retryDays;
          emitAll(enq, [{ type: "staff.release", params: { job: "security" } }]);
          if (!caught) emitAll(enq, [{ type: "news", params: { text: "Security inquiry finds bread, no answers. The backup page remains.", tone: "neutral" } }]);
        }
      }
    }
    const stats = {
      seedReady: event.type === "DAY" && event.seedRoll < seedChance(event) ? 1 : 0,
      caught: caught ? 1 : 0,
      spreadReady: event.day - ctx.seededDay >= R.growth.spreadDays ? 1 : 0,
      organizeReady: ctx.score >= R.growth.organizedScore ? 1 : 0,
      exposeReady: ctx.score >= R.growth.exposeScore && event.day - ctx.seededDay >= R.growth.exposeAge ? 1 : 0,
    };
    const raw = node.on?.[event.type];
    const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    let target = stage;
    for (const rawTransition of list) {
      const t = typeof rawTransition === "string" ? { target: rawTransition } : rawTransition;
      if (!passes(t.guard as Call | undefined, { day: event.day, tick: event.tick, roll: 0, stats, ctx, choice: event.type === "CHOSE" ? event.choice : undefined })) continue;
      // Duplicate inquiries are ignored, even if a stale choice flag is replayed.
      if (event.type === "CHOSE" && event.choice === "investigate") {
        if (ctx.investigationUntil >= 0) break;
        const inquiry = t.actions?.find((a) => typeof a !== "string" && a.type === "investigate.start");
        const days = typeof inquiry === "object" && typeof inquiry.params?.days === "number" ? inquiry.params.days : R.investigation.days;
        ctx = { ...ctx, investigationUntil: event.day + days, investigationDays: 0, staffDays: 0, attempts: ctx.attempts + 1 };
      }
      emitAll(enq, t.actions);
      if (t.target) {
        target = t.target as SwarmStage;
        emitAll(enq, node.exit);
        emitAll(enq, COLLUSION.chart.states[target]?.entry);
        ctx.enteredTick = event.tick;
        if (target === "seeded") { ctx.seededDay = event.day; ctx.score = R.growth.initialScore; }
      }
      break;
    }
    if (target !== "dormant" && !ctx.noticed && ctx.score >= R.growth.signScore) {
      ctx.noticed = true;
      emitAll(enq, [{ type: "flag.set", params: { name: "offer:collusion-sign" } }]);
    }
    if (event.type === "DAY" && !["contained", "partlyContained", "exposed"].includes(target) && ctx.attempts > 0 && ctx.investigationUntil < 0 && event.day >= ctx.retryDay) {
      emitAll(enq, [{ type: "flag.set", params: { name: "offer:collusion-sign" } }]);
      ctx.retryDay = event.day + R.investigation.retryDays;
    }
    return { target, context: ctx }; // alpha requires a return for enq.emit to take effect
  };
}
const states = Object.fromEntries(Object.entries(COLLUSION.chart.states).map(([name, node]) => [name,
  node.type === "final" ? { type: "final" } : { on: { DAY: handler(name as SwarmStage, node), CHOSE: handler(name as SwarmStage, node) } },
]));
export const swarmMachine = chassis.createMachine({ context: ({ input }: { input: SwarmContext }) => input, initial: COLLUSION.chart.initial, states } as never) as unknown as AnyStateMachine;
export function stepSwarm(stored: SwarmStored, event: SwarmEvent) {
  const result = step(swarmMachine, stored as never, event as never);
  return { stored: result.stored as unknown as SwarmStored, calls: result.effects as unknown as { type: "CALL"; verb: string; params: Record<string, Json> }[] };
}
