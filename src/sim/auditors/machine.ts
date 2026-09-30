// The audit arc, compiled from the pack's one chart: quiet → notice (the warning card) → countdown (7 days) → visit (the
// tour) → report (the report card) → quiet. Pure XState; the dice arrive in the events, and the few numbers the chart
// guards on (is a visit due, did they find the boxes, did they find the Swarm) are worked out here from the pack's rules.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { AnyStateMachine } from "xstate";
import type { ArcNode, NamedCallData } from "../../mods/schema";
import { step } from "../machines/run";
import { normalize, passes } from "../verbs";
import type { Call, Json } from "../disasters/types";
import { AUDITORS, PREP_CHOICES } from "./pack";
import type { AuditStage } from "./state";

type ArcNodeData = typeof ArcNode.Type;
const R = AUDITORS.rules;
export const AuditContext = Schema.Struct({
  /** "prep", "tidy", "usual", or "" before the card is answered. */
  prep: Schema.String,
  enteredTick: Schema.Number, progress: Schema.Number, hours: Schema.Number,
  /** Day the next regular visit is due, -1 until the lab reaches the era they start in. */
  nextDay: Schema.Number,
  /** Day of the last report, -1 before the first. */
  lastVisit: Schema.Number,
  visits: Schema.Number,
  visitDay: Schema.Number,
  inspected: Schema.Number,
  caught: Schema.Number, swarm: Schema.Number, evals: Schema.Number,
});
export interface AuditContext extends Schema.Schema.Type<typeof AuditContext> {}
const Day = Schema.Struct({
  day: Schema.Number, tick: Schema.Number, era: Schema.Number,
  /** Something happened since the last visit that makes an extra one likely (a disaster, collusion signs, a hearing). */
  incident: Schema.Number, heat: Schema.Number, odds: Schema.Number,
  incidentRoll: Schema.Number, jitterRoll: Schema.Number,
  /** None of the pack's visitor groups is on campus. */
  gone: Schema.Number,
});
const Inspected = Schema.Struct({
  day: Schema.Number, tick: Schema.Number, kind: Schema.String, evals: Schema.Boolean,
  /** The Swarm is at seeded or later. */
  swarmActive: Schema.Number,
  hideRoll: Schema.Number, swarmRoll: Schema.Number,
});
export interface AuditDay extends Schema.Schema.Type<typeof Day> { type: "DAY" }
export interface AuditInspected extends Schema.Schema.Type<typeof Inspected> { type: "INSPECTED" }
export type AuditEvent = AuditDay | AuditInspected | { type: "CHOSE"; choice: string; day: number; tick: number };
export interface AuditStored { value: AuditStage; context: AuditContext }
export const freshAudit = (): AuditStored => ({ value: "quiet", context: {
  prep: "", enteredTick: 0, progress: 0, hours: 0, nextDay: -1, lastVisit: -1, visits: 0, visitDay: -1, inspected: 0, caught: 0, swarm: 0, evals: 0,
} });

/** Today's odds of an extra visit after an incident (0 when there was none or the last visit was too recent). */
export function extraVisitChance(e: Pick<AuditDay, "day" | "incident" | "heat" | "odds">, lastVisit: number): number {
  const r = R.schedule;
  if (!e.incident || (lastVisit >= 0 && e.day - lastVisit < r.minGap)) return 0;
  return Math.min(1, (r.incidentChance + e.heat * r.perHeat) * e.odds);
}
/** The odds a stop finds the boxes (Tidy up only), and the Swarm (at the kinds where its traffic shows). */
export function hideChance(prep: string, evals: boolean): number {
  return prep === "tidy" ? (evals ? R.discovery.hideEvals : R.discovery.hide) : 0;
}
export function swarmChance(prep: string, kind: string): number {
  if (!R.swarmKinds.includes(kind)) return 0;
  return prep === "tidy" ? R.discovery.swarmTidy : prep === "prep" ? R.discovery.swarmPrep : R.discovery.swarmUsual;
}

const chassis = setupEffect({ schemas: {
  context: AuditContext, input: AuditContext,
  events: { DAY: Day, INSPECTED: Inspected, CHOSE: Schema.Struct({ choice: Schema.String, day: Schema.Number, tick: Schema.Number }) },
  emitted: { CALL: Schema.Struct({ verb: Schema.String, params: Schema.Record(Schema.String, Schema.Json) }) },
} });
type Enq = { emit: (event: { type: "CALL"; verb: string; params: Record<string, Json> }) => void };
const emitAll = (enq: Enq, calls: readonly NamedCallData[] = []) => {
  for (const c of calls) {
    const { type, params } = normalize(c as Call);
    enq.emit({ type: "CALL", verb: type, params });
  }
};

function handler(stage: AuditStage, node: ArcNodeData) {
  return ({ context, event }: { context: AuditContext; event: AuditEvent }, enq: Enq) => {
    const ctx = { ...context };
    const stats: Record<string, number> = { visitDue: 0, groupGone: 0, caughtHiding: 0, foundSwarm: 0, evalsDone: 0 };
    if (event.type === "DAY") {
      if (event.era >= R.schedule.minEra && ctx.nextDay < 0) ctx.nextDay = event.day + R.schedule.firstDelay;
      const regular = ctx.nextDay >= 0 && event.day >= ctx.nextDay;
      const extra = event.era >= R.schedule.minEra && event.incidentRoll < extraVisitChance(event, ctx.lastVisit);
      stats.visitDue = regular || extra ? 1 : 0;
      stats.groupGone = event.gone;
    } else if (event.type === "INSPECTED") {
      ctx.inspected++;
      if (!ctx.caught && event.hideRoll < hideChance(ctx.prep, event.evals)) stats.caughtHiding = ctx.caught = 1;
      // One finding per stop: the chart takes the first that holds, so a Swarm found under a box waits for the next one.
      if (!ctx.swarm && !stats.caughtHiding && event.swarmActive && event.swarmRoll < swarmChance(ctx.prep, event.kind)) stats.foundSwarm = ctx.swarm = 1;
      if (event.evals) stats.evalsDone = ctx.evals = 1;
    } else if (stage === "notice" && (PREP_CHOICES as readonly string[]).includes(event.choice)) ctx.prep = event.choice;
    const raw = node.on?.[event.type];
    const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    let target = stage;
    for (const rawTransition of list) {
      const t = typeof rawTransition === "string" ? { target: rawTransition } : rawTransition;
      if (!passes(t.guard as Call | undefined, { day: event.day, tick: event.tick, roll: 0, stats, ctx, choice: event.type === "CHOSE" ? event.choice : undefined })) continue;
      emitAll(enq, t.actions);
      if (t.target) {
        target = t.target as AuditStage;
        emitAll(enq, node.exit);
        ctx.enteredTick = event.tick;
        if (target === "visit") Object.assign(ctx, { visitDay: event.day, inspected: 0, caught: 0, swarm: 0, evals: 0 });
        if (target === "report" && event.type === "DAY") {
          ctx.visits++;
          ctx.lastVisit = event.day;
          ctx.nextDay = event.day + R.schedule.every + Math.round((event.jitterRoll * 2 - 1) * R.schedule.jitter);
        }
        if (target === "quiet") ctx.prep = "";
        emitAll(enq, AUDITORS.chart.states[target]?.entry);
      }
      break;
    }
    return { target, context: ctx }; // alpha requires a return for enq.emit to take effect
  };
}
const EVENTS = ["DAY", "INSPECTED", "CHOSE"] as const;
const states = Object.fromEntries(Object.entries(AUDITORS.chart.states).map(([name, node]) => [name,
  node.type === "final" ? { type: "final" } : { on: Object.fromEntries(EVENTS.map((e) => [e, handler(name as AuditStage, node)])) },
]));
export const auditMachine = chassis.createMachine({ context: ({ input }: { input: AuditContext }) => input, initial: AUDITORS.chart.initial, states } as never) as unknown as AnyStateMachine;
export function stepAudit(stored: AuditStored, event: AuditEvent) {
  const result = step(auditMachine, stored as never, event as never);
  return { stored: result.stored as unknown as AuditStored, calls: result.effects as unknown as { type: "CALL"; verb: string; params: Record<string, Json> }[] };
}
