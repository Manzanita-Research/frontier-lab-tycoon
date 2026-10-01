// The Bird App's two statecharts (FLT-69). Both are stepped by the daily driver (driver.ts) and only on a
// discrete change: a poster hears about a banger, a cancel, the end of a posting break or a resignation, never
// "another day"; the Comms desk hears the day's queue once a day. The driver pre-rolls every die.
//
// A poster's tier:
//
//   recluse (never posts)
//   occasional --BANGER, promote--> big (emits PROMOTED)
//   occasional | big --CANCELLED--> break (a 30-day posting break) | gone (they left) | a tier down (a poaching target)
//   break --DAY, day >= until--> the tier they had (emits BACK)
//   any --QUIT--> gone (final)
//
// The Comms desk: calm <-> busy <-> drowning (emits DROWNING on the way in, SURFACED on the way out).
//
// A rival lab's feed (FLT-92):
//
//   posting --DROP (fell on the Arena)--> quiet (emits SILENT) --DAY, day >= until--> posting (emits BACK)
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { remembered, step, type Stored } from "../machines/run";

const Tier = Schema.Literals(["recluse", "occasional", "big"]);
export const FATES = ["break", "leave", "target"] as const;

export const posterMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ until: Schema.Number, was: Tier }),
    input: Schema.Struct({}),
    events: {
      /** One of theirs went viral. `promote`: their followers are past the big-account line. */
      BANGER: Schema.Struct({ promote: Schema.Boolean }),
      /** Cancelled. The driver rolled the fate: a posting break until `until`, leaving, or staying on as a poaching target. */
      CANCELLED: Schema.Struct({ fate: Schema.Literals(FATES), until: Schema.Number }),
      /** A day ended during a posting break. */
      DAY: Schema.Struct({ day: Schema.Number }),
      /** They left the lab. */
      QUIT: Schema.Struct({}),
    },
    emitted: {
      PROMOTED: Schema.Struct({}),
      /** Their tier dropped (a cancel that did not end in a break or a resignation). */
      DEMOTED: Schema.Struct({}),
      BREAK: Schema.Struct({ until: Schema.Number }),
      BACK: Schema.Struct({}),
      /** A cancel that ends with them handing in the badge. */
      LEFT: Schema.Struct({}),
    },
  },
}).createMachine({
  context: { until: 0, was: "occasional" },
  initial: "occasional",
  on: { QUIT: { target: ".gone" } },
  states: {
    recluse: {},
    occasional: {
      on: {
        BANGER: ({ event }, enq) => {
          if (!event.promote) return undefined;
          enq.emit({ type: "PROMOTED" });
          return { target: "big" };
        },
        CANCELLED: ({ event }, enq) => {
          if (event.fate === "break") {
            enq.emit({ type: "BREAK", until: event.until });
            return { target: "break", context: { until: event.until, was: "occasional" as const } };
          }
          if (event.fate === "leave") {
            enq.emit({ type: "LEFT" });
            return { target: "gone" };
          }
          enq.emit({ type: "DEMOTED" });
          return { target: "recluse" };
        },
      },
    },
    big: {
      on: {
        CANCELLED: ({ event }, enq) => {
          // A cancel always costs a big account the tier: they come back from a break as an occasional poster.
          if (event.fate === "break") {
            enq.emit({ type: "BREAK", until: event.until });
            return { target: "break", context: { until: event.until, was: "occasional" as const } };
          }
          if (event.fate === "leave") {
            enq.emit({ type: "LEFT" });
            return { target: "gone" };
          }
          enq.emit({ type: "DEMOTED" });
          return { target: "occasional" };
        },
      },
    },
    break: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.day < context.until) return undefined;
          enq.emit({ type: "BACK" });
          return { target: context.was, context: { until: 0, was: context.was } };
        },
      },
    },
    gone: { type: "final" },
  },
});
export type PosterStored = Stored<typeof posterMachine>;
export type PosterTier = PosterStored["value"];
export const posterStored = (tier: "recluse" | "occasional" | "big"): PosterStored => ({ value: tier, context: { until: 0, was: tier } });
export const stepPoster = (stored: PosterStored, event: Parameters<typeof step<typeof posterMachine>>[2]) => step(posterMachine, stored, event);

export const commsMachine = setupEffect({
  schemas: {
    context: Schema.Struct({}),
    input: Schema.Struct({}),
    events: {
      /** The day's end: fires still in the queue after Comms did what it could, and how many it can have before it drowns. */
      DAY: Schema.Struct({ queue: Schema.Number, limit: Schema.Number }),
    },
    emitted: {
      DROWNING: Schema.Struct({}),
      SURFACED: Schema.Struct({}),
    },
  },
}).createMachine({
  context: {},
  initial: "calm",
  states: {
    calm: {
      on: {
        DAY: ({ event }, enq) => {
          if (event.queue > event.limit) {
            enq.emit({ type: "DROWNING" });
            return { target: "drowning" };
          }
          return event.queue > 0 ? { target: "busy" } : undefined;
        },
      },
    },
    busy: {
      on: {
        DAY: ({ event }, enq) => {
          if (event.queue > event.limit) {
            enq.emit({ type: "DROWNING" });
            return { target: "drowning" };
          }
          return event.queue === 0 ? { target: "calm" } : undefined;
        },
      },
    },
    drowning: {
      on: {
        DAY: ({ event }, enq) => {
          if (event.queue > event.limit) return undefined;
          enq.emit({ type: "SURFACED" });
          return { target: event.queue === 0 ? "calm" : "busy" };
        },
      },
    },
  },
});
export type CommsStored = Stored<typeof commsMachine>;
export type CommsDesk = CommsStored["value"];
/** One a day, and (queue, limit) are small numbers: remembered. */
export const stepComms = remembered(commsMachine);

export const labFeedMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ until: Schema.Number }),
    input: Schema.Struct({}),
    events: {
      /** It fell down the Arena: one last line, then nothing until `until`. */
      DROP: Schema.Struct({ until: Schema.Number }),
      /** A midnight while it is quiet. */
      DAY: Schema.Struct({ day: Schema.Number }),
    },
    emitted: {
      SILENT: Schema.Struct({ until: Schema.Number }),
      /** The silence is over: someone is so back. */
      BACK: Schema.Struct({}),
    },
  },
}).createMachine({
  context: { until: 0 },
  initial: "posting",
  states: {
    posting: {
      on: {
        DROP: ({ event }, enq) => {
          enq.emit({ type: "SILENT", until: event.until });
          return { target: "quiet", context: { until: event.until } };
        },
      },
    },
    quiet: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.day < context.until) return undefined;
          enq.emit({ type: "BACK" });
          return { target: "posting", context: { until: 0 } };
        },
      },
    },
  },
});
export type LabFeedStored = Stored<typeof labFeedMachine>;
/** A handful of labs, once a day: remembered. */
export const stepLabFeed = remembered(labFeedMachine);
