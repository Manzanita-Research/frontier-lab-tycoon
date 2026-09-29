// The scenario: tracking -> won | lost. Milestones latch; the game is lost at the deadline or when cash sinks
// below the floor. Pure: the driver (sim/goals.ts) reads the metrics off the World and applies WON/LOST.
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
});

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
      /** The daily check. `values` maps goal id to the metric's current value; `cash` feeds the loss floor. */
      DAY: Schema.Struct({ day: Schema.Number, cash: Schema.Number, values: Schema.Record(Schema.String, Schema.Number) }),
    },
    emitted: {
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
          const goals = context.goals.map((g) => {
            const value = g.met ? Math.max(g.value, g.target) : (event.values[g.id] ?? 0);
            return { ...g, value, met: value >= g.target };
          });
          if (goals.every((g) => g.met)) {
            enq.emit({ type: "WON", day: event.day });
            return { target: "won", context: { goals, outcomeDay: event.day } };
          }
          if (event.day >= SCENARIO.deadlineDay || event.cash < SCENARIO.brokeBelow) {
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
