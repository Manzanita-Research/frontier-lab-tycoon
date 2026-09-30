// The release calendar: the heartbeat of Release Leapfrog. One lab launches every eight to twelve days and, often, another
// answers the next day.
//
//   quiet --DAY (countdown over)--> answering  (DROP lead, and a pair was rolled)
//   quiet --DAY (countdown over)--> quiet      (DROP lead, no pair: a new countdown starts)
//   answering --DAY--> quiet                   (DROP answer)
//
// Pure: no rng, no World. The driver (leapfrog/driver.ts) pre-rolls the two dice every day (so the stream never depends on
// whether anything dropped) and picks the lab that ships when the machine emits DROP.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "../../machines/run";

export const CalendarContext = Schema.Struct({
  /** Days until the next lead drop; the countdown runs at midnight. */
  daysLeft: Schema.Number,
  /** Gap between lead drops, in days, before the era's pace: `gapMin` to `gapMax`. */
  gapMin: Schema.Number,
  gapMax: Schema.Number,
  /** Never sooner than this, whatever the era. */
  minGap: Schema.Number,
  /** Lead drops, answers, and the total, so far. */
  leads: Schema.Number,
  answers: Schema.Number,
});
export type CalendarContext = typeof CalendarContext.Type;

const Day = Schema.Struct({
  /** Uniform draws in [0, 1): the length of the next gap, and whether this drop is answered. */
  gapRoll: Schema.Number,
  pairRoll: Schema.Number,
  /** The era: multiplies the gap (under 1: faster), and the chance of an answer. */
  pace: Schema.Number,
  pairChance: Schema.Number,
});
type DayEvent = typeof Day.Type;

export const calendarMachine = setupEffect({
  schemas: {
    context: CalendarContext,
    input: CalendarContext,
    events: {
      /** Midnight. */
      DAY: Day,
    },
    emitted: {
      /** A lab launches today. `lead` opens a launch window; `answer` is the day-after counter-launch. */
      DROP: Schema.Struct({ slot: Schema.Literals(["lead", "answer"]) }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "quiet",
  states: {
    /** Counting down to the next launch. */
    quiet: {
      on: {
        DAY: ({ context, event }, enq) => {
          const daysLeft = context.daysLeft - 1;
          if (daysLeft > 0) return { target: "quiet", context: { ...context, daysLeft } };
          enq.emit({ type: "DROP", slot: "lead" });
          const next = { ...context, leads: context.leads + 1 };
          // A pair: the answer is due tomorrow, and the next countdown starts after it.
          if (event.pairRoll < event.pairChance) return { target: "answering", context: { ...next, daysLeft: 0 } };
          return { target: "quiet", context: { ...next, daysLeft: nextGap(context, event) } };
        },
      },
    },
    /** A lab launched yesterday and another is about to answer. */
    answering: {
      on: {
        DAY: ({ context, event }, enq) => {
          enq.emit({ type: "DROP", slot: "answer" });
          return { target: "quiet", context: { ...context, answers: context.answers + 1, daysLeft: nextGap(context, event) } };
        },
      },
    },
  },
});

export type CalendarStored = Stored<typeof calendarMachine>;

/** Days to the next lead drop: `gapMin` to `gapMax`, scaled by the era, never under `minGap`. */
export function nextGap(context: CalendarContext, event: Pick<DayEvent, "gapRoll" | "pace">): number {
  const base = context.gapMin + (context.gapMax - context.gapMin) * event.gapRoll;
  return Math.max(context.minGap, Math.round(base * event.pace));
}
