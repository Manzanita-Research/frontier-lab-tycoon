// The launch livestream: it starts when you release a model, and either goes flawlessly or something happens.
//
//   idle --GO--> live, emits AIRED {ok, kind}     (kind is a mishap id; empty when it went well)
//   live --DAY (a day later)--> idle
//
// Pure: no rng, no World. The driver rolls whether it works (by quality and readiness) and which mishap it is.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "../../machines/run";

export const LivestreamContext = Schema.Struct({
  /** The day of the current or last stream, or -1. */
  since: Schema.Number,
  streams: Schema.Number,
  mishaps: Schema.Number,
  /** The mishap on air (or the last one), or "". */
  kind: Schema.String,
});
export type LivestreamContext = typeof LivestreamContext.Type;

export const livestreamMachine = setupEffect({
  schemas: {
    context: LivestreamContext,
    input: LivestreamContext,
    events: {
      GO: Schema.Struct({ day: Schema.Number, ok: Schema.Boolean, kind: Schema.String }),
      DAY: Schema.Struct({ day: Schema.Number }),
    },
    emitted: {
      AIRED: Schema.Struct({ ok: Schema.Boolean, kind: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "idle",
  states: {
    idle: {
      on: {
        GO: ({ context, event }, enq) => {
          enq.emit({ type: "AIRED", ok: event.ok, kind: event.kind });
          return {
            target: "live",
            context: { since: event.day, streams: context.streams + 1, mishaps: context.mishaps + (event.ok ? 0 : 1), kind: event.ok ? "" : event.kind },
          };
        },
      },
    },
    /** On air; a second launch the same day has to wait its turn (the driver just skips the show). */
    live: {
      on: {
        DAY: ({ context, event }) => {
          if (event.day - context.since < 1) return;
          return { target: "idle", context };
        },
      },
    },
  },
});

export type LivestreamStored = Stored<typeof livestreamMachine>;
