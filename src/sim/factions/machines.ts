// The factions' two statecharts (FLT-33), stepped with the pure `transition()` once a game day by sim/factions/driver.ts.
//
// A faction's mood follows its meter (−100 to 100) with hysteresis, so a meter that wobbles round a line does not
// flicker between moods every day:
//
//   calm --≥50--> fan --<30--> calm
//   calm --≤−40--> upset --≥−25--> calm
//   upset --≤march--> protesting --≥march+20--> upset      (march: the faction's `protests` line; never if it has none)
//
// Two factions' relation (−100 to 100) is the same idea, plus a memory: a pair that was allied and falls to feuding is a
// schism, which is the headline everybody wants.
//
//   cordial --≥55--> allied --<35--> cordial
//   cordial --≤−55--> feuding --≥−35--> cordial              (allied --≤−55--> feuding directly is also a schism)
//
// Machines never touch the World and never roll dice: they emit what happened and the driver does the rest.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "../machines/run";

export const FAN_AT = 50;
export const FAN_UNTIL = 30;
export const UPSET_AT = -40;
export const UPSET_UNTIL = -25;
/** A protesting faction goes home once the meter is this far above its march line. */
export const MARCH_SLACK = 20;
export const ALLY_AT = 55;
export const ALLY_UNTIL = 35;
export const FEUD_AT = -55;
export const FEUD_UNTIL = -35;

const MoodContext = Schema.Struct({ meter: Schema.Number, since: Schema.Number });

export const factionMoodMachine = setupEffect({
  schemas: {
    context: MoodContext,
    input: MoodContext,
    events: {
      /** The day's meter, and the line at which this faction marches on the gate (null: it never does on its own). */
      DAY: Schema.Struct({ meter: Schema.Number, day: Schema.Number, march: Schema.NullOr(Schema.Number) }),
      /** You shipped a model: a fan faction hypes it, an unhappy one boycotts it. */
      RELEASE: Schema.Struct({}),
    },
    emitted: {
      MOOD: Schema.Struct({ from: Schema.String, to: Schema.String }),
      HYPE: Schema.Struct({}),
      BOYCOTT: Schema.Struct({}),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "calm",
  states: {
    calm: {
      on: {
        DAY: ({ event }, enq) => {
          const context = { meter: event.meter, since: event.day };
          if (event.meter >= FAN_AT) {
            enq.emit({ type: "MOOD", from: "calm", to: "fan" });
            return { target: "fan", context };
          }
          if (event.meter <= UPSET_AT) {
            enq.emit({ type: "MOOD", from: "calm", to: "upset" });
            return { target: "upset", context };
          }
          return { target: "calm", context: { meter: event.meter, since: -1 } };
        },
      },
    },
    fan: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.meter < FAN_UNTIL) {
            enq.emit({ type: "MOOD", from: "fan", to: "calm" });
            return { target: "calm", context: { meter: event.meter, since: event.day } };
          }
          return { target: "fan", context: { ...context, meter: event.meter } };
        },
        RELEASE: ({ context }, enq) => {
          enq.emit({ type: "HYPE" });
          return { target: "fan", context };
        },
      },
    },
    upset: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.march !== null && event.meter <= event.march) {
            enq.emit({ type: "MOOD", from: "upset", to: "protesting" });
            return { target: "protesting", context: { meter: event.meter, since: event.day } };
          }
          if (event.meter >= UPSET_UNTIL) {
            enq.emit({ type: "MOOD", from: "upset", to: "calm" });
            return { target: "calm", context: { meter: event.meter, since: event.day } };
          }
          return { target: "upset", context: { ...context, meter: event.meter } };
        },
        RELEASE: ({ context }, enq) => {
          enq.emit({ type: "BOYCOTT" });
          return { target: "upset", context };
        },
      },
    },
    protesting: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.march === null || event.meter >= event.march + MARCH_SLACK) {
            enq.emit({ type: "MOOD", from: "protesting", to: "upset" });
            return { target: "upset", context: { meter: event.meter, since: event.day } };
          }
          return { target: "protesting", context: { ...context, meter: event.meter } };
        },
        RELEASE: ({ context }, enq) => {
          enq.emit({ type: "BOYCOTT" });
          return { target: "protesting", context };
        },
      },
    },
  },
});
export type FactionMoodStored = Stored<typeof factionMoodMachine>;
export type FactionMood = FactionMoodStored["value"];

/**
 * A DAY that changes nothing but the meter, done without `transition()`: most days most factions stay put, and ten
 * machine steps a midnight are not free. Returns null when the day crosses a line, and then the driver steps the
 * machine. Mirrors each state's "stay" branch above exactly (a test checks it against the machine).
 */
export function quietMoodDay(stored: FactionMoodStored, meter: number, march: number | null): FactionMoodStored | null {
  const c = stored.context;
  switch (stored.value) {
    case "calm":
      return meter < FAN_AT && meter > UPSET_AT ? { ...stored, context: { meter, since: -1 } } : null;
    case "fan":
      return meter >= FAN_UNTIL ? { ...stored, context: { ...c, meter } } : null;
    case "upset":
      return (march === null || meter > march) && meter < UPSET_UNTIL ? { ...stored, context: { ...c, meter } } : null;
    case "protesting":
      return march !== null && meter < march + MARCH_SLACK ? { ...stored, context: { ...c, meter } } : null;
  }
  return null;
}

const RelationContext = Schema.Struct({ value: Schema.Number, wasAllied: Schema.Boolean });

export const relationMachine = setupEffect({
  schemas: {
    context: RelationContext,
    input: RelationContext,
    events: { DAY: Schema.Struct({ value: Schema.Number }) },
    emitted: {
      ALLIED: Schema.Struct({}),
      /** Feuding after having been allied: the split. */
      SCHISM: Schema.Struct({}),
      FEUD: Schema.Struct({}),
      /** Out of a feud (or an alliance), back to talking. */
      COOLED: Schema.Struct({ was: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "cordial",
  states: {
    cordial: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.value >= ALLY_AT) {
            enq.emit({ type: "ALLIED" });
            return { target: "allied", context: { value: event.value, wasAllied: true } };
          }
          if (event.value <= FEUD_AT) {
            enq.emit({ type: context.wasAllied ? "SCHISM" : "FEUD" });
            return { target: "feuding", context: { value: event.value, wasAllied: false } };
          }
          return { target: "cordial", context: { ...context, value: event.value } };
        },
      },
    },
    allied: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.value <= FEUD_AT) {
            enq.emit({ type: "SCHISM" });
            return { target: "feuding", context: { value: event.value, wasAllied: false } };
          }
          if (event.value < ALLY_UNTIL) {
            enq.emit({ type: "COOLED", was: "allied" });
            // Keeps the memory: a pair that drifts apart and then falls out is still a schism.
            return { target: "cordial", context: { value: event.value, wasAllied: true } };
          }
          return { target: "allied", context: { ...context, value: event.value } };
        },
      },
    },
    feuding: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.value >= FEUD_UNTIL) {
            enq.emit({ type: "COOLED", was: "feuding" });
            return { target: "cordial", context: { value: event.value, wasAllied: false } };
          }
          return { target: "feuding", context: { ...context, value: event.value } };
        },
      },
    },
  },
});
export type RelationStored = Stored<typeof relationMachine>;
export type Relation = RelationStored["value"];

/** The relation's "stay" branches without `transition()` (45 pairs a midnight); null when the value crosses a line. */
export function quietRelationDay(stored: RelationStored, value: number): RelationStored | null {
  const stay = { ...stored, context: { ...stored.context, value } };
  switch (stored.value) {
    case "cordial":
      return value < ALLY_AT && value > FEUD_AT ? stay : null;
    case "allied":
      return value > FEUD_AT && value >= ALLY_UNTIL ? stay : null;
    case "feuding":
      return value < FEUD_UNTIL ? stay : null;
  }
  return null;
}
