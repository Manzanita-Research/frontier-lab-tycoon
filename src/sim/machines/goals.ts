// The scenario: tracking -> won | lost. Milestones latch; the game is lost at the deadline or when the bank calls
// (the economy's bankrupt). Pure: the driver (sim/goals.ts) reads the metrics off the World and applies the effects.
//
// FLT-86: a goal with `hold` is only met after its metric stays at the target for that many days in a row (the Arena's
// top 3 for 30 days), so the last objective can't land by accident on the same day as the others. The machine says
// when each one is met (MET), when only one is left (STRETCH), and when a hold starts (HOLDING) or breaks (SLIPPED).
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { SCENARIO } from "../../content/goals";
import type { Stored } from "./run";

export const GoalProgress = Schema.Struct({
  id: Schema.String,
  /** Current value of the metric (latched at the target once met). */
  value: Schema.Number,
  target: Schema.Number,
  /** Milestones latch: once met, they stay met. */
  met: Schema.Boolean,
  /** Days in a row the metric must stay at the target (FLT-86). Absent: met the day it gets there. */
  hold: Schema.optional(Schema.Number),
  /** Days in a row it has been there so far (hold goals only). */
  held: Schema.optional(Schema.Number),
});
type Goal = typeof GoalProgress.Type;

export const GoalsContext = Schema.Struct({
  goals: Schema.Array(GoalProgress),
  /** The day the scenario ended, or null while it is still on. */
  outcomeDay: Schema.NullOr(Schema.Number),
});
export type GoalsContext = typeof GoalsContext.Type;

export const goalsMachine = setupEffect({
  schemas: {
    context: GoalsContext,
    input: GoalsContext,
    events: {
      /** The daily check. `values` maps goal id to the metric's current value; `broke` is the economy gone bankrupt. */
      DAY: Schema.Struct({ day: Schema.Number, broke: Schema.Boolean, values: Schema.Record(Schema.String, Schema.Number) }),
    },
    emitted: {
      /** Goal `id` is met today: `done` of `total` now. */
      MET: Schema.Struct({ id: Schema.String, done: Schema.Number, total: Schema.Number }),
      /** Every goal but `id` is met: the final stretch. */
      STRETCH: Schema.Struct({ id: Schema.String }),
      /** A hold goal reached its target today: day 1 of `hold`. */
      HOLDING: Schema.Struct({ id: Schema.String, hold: Schema.Number }),
      /** A hold goal fell off its target after `held` days: the count starts again. */
      SLIPPED: Schema.Struct({ id: Schema.String, held: Schema.Number }),
      WON: Schema.Struct({ day: Schema.Number }),
      LOST: Schema.Struct({ day: Schema.Number }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "tracking",
  states: {
    tracking: {
      on: {
        DAY: ({ context, event }, enq) => {
          const goals = context.goals.map((g) => advance(g, event.values[g.id] ?? 0, enq));
          const done = goals.filter((g) => g.met).length;
          const before = context.goals.filter((g) => g.met).length;
          goals.forEach((g, i) => {
            if (g.met && !context.goals[i]!.met) enq.emit({ type: "MET", id: g.id, done, total: goals.length });
          });
          if (done === goals.length - 1 && before < done) enq.emit({ type: "STRETCH", id: goals.find((g) => !g.met)!.id });
          if (goals.every((g) => g.met)) {
            enq.emit({ type: "WON", day: event.day });
            return { target: "won", context: { goals, outcomeDay: event.day } };
          }
          if (event.day >= SCENARIO.deadlineDay || event.broke) {
            enq.emit({ type: "LOST", day: event.day });
            return { target: "lost", context: { goals, outcomeDay: event.day } };
          }
          return { context: { ...context, goals } };
        },
      },
    },
    /** Every milestone met. Play can go on, but the scenario is settled. */
    won: { type: "final" },
    /** Deadline or broke. Time stops for good. */
    lost: { type: "final" },
  },
});

export type GoalsStored = Stored<typeof goalsMachine>;

/** One goal's day: latched goals stay met; a hold goal counts its days in a row at the target and starts again when it slips. */
function advance(
  g: Goal,
  now: number,
  enq: { emit: (e: { type: "HOLDING"; id: string; hold: number } | { type: "SLIPPED"; id: string; held: number }) => void },
): Goal {
  if (g.met) return { ...g, value: Math.max(g.value, g.target) };
  if (g.hold === undefined) return { ...g, value: now, met: now >= g.target };
  const was = g.held ?? 0;
  const held = now >= g.target ? was + 1 : 0;
  if (held === 1) enq.emit({ type: "HOLDING", id: g.id, hold: g.hold });
  if (held === 0 && was > 0) enq.emit({ type: "SLIPPED", id: g.id, held: was });
  return { ...g, value: now, held, met: held >= g.hold };
}
