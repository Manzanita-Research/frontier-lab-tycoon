// How a walker feels, as a statechart of its own next to the walker machine (where it is and what it is doing).
// The driver (sim/crowd.ts) works out a walker's happiness once a game day and sends the event for the mood it
// belongs in, but only when that differs from the mood it is in: a handful of events a day, not one per walker.
//
//   content <--> slumped <--> miserable --DAY x5--> resigned (final, emits RESIGNED)
//
// `slumped` is the slump walk; `miserable` (happiness under 0.2) starts the countdown: five days of it and a
// researcher walks out with a box. A day that is not miserable resets the count (leaving `miserable` clears it).
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { remembered, type Stored } from "./run";

/** Days of misery before a researcher hands in the box. */
export const QUIT_DAYS = 5;

export const moodMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ days: Schema.Number }),
    input: Schema.Struct({}),
    events: {
      /** Happiness is fine again. */
      LIFT: Schema.Struct({}),
      /** Happiness is low: the slump walk. */
      SLUMP: Schema.Struct({}),
      /** Happiness is below the misery line. */
      CRASH: Schema.Struct({}),
      /** Another day has ended while miserable. */
      DAY: Schema.Struct({}),
    },
    emitted: {
      /** The fifth miserable day: time to walk out. */
      RESIGNED: Schema.Struct({}),
    },
  },
}).createMachine({
  context: { days: 0 },
  initial: "content",
  states: {
    content: { on: { SLUMP: { target: "slumped" }, CRASH: { target: "miserable" } } },
    slumped: { on: { LIFT: { target: "content" }, CRASH: { target: "miserable" } } },
    miserable: {
      // Leaving misery clears the count: the five days have to be in a row.
      on: {
        LIFT: { target: "content", context: { days: 0 } },
        SLUMP: { target: "slumped", context: { days: 0 } },
        DAY: ({ context }, enq) => {
          const days = context.days + 1;
          if (days < QUIT_DAYS) return { context: { days } };
          enq.emit({ type: "RESIGNED" });
          return { target: "resigned", context: { days } };
        },
      },
    },
    resigned: { type: "final" },
  },
});

export type MoodStored = Stored<typeof moodMachine>;
export type MoodLevel = MoodStored["value"];

export const CONTENT: MoodStored = { value: "content", context: { days: 0 } };

/** `step(moodMachine, ...)`, remembered: there are only a few dozen (mood, days, event) triples (FLT-39). */
export const stepMood = remembered(moodMachine);
