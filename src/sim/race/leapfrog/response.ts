// The forced response: a rival drops while your run is cooking, and you have to decide.
//
//   idle --DROP (eligible)--> offered, emits OFFER     (the "Ship now at 94% ready" card)
//   offered --PICK ship--> idle, emits SHIPPED          (early release, penalty, news-cycle bump)
//   offered --PICK hold--> holding, emits HELD          (lose today, counter-launch later)
//   offered --PICK leak--> idle, emits LEAKED           (hype up, trust down)
//   holding --RELEASED--> idle, emits COUNTER {strong}  (your next launch is the answer)
//   holding --DAY (window over)--> idle, emits EXPIRED
//
// Pure: no rng, no World. The driver decides who is eligible (a run in progress, ready enough) and applies the emits.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "../../machines/run";

export const ResponseContext = Schema.Struct({
  /** The day of the last offer, or -999, so cards are spaced out. */
  lastOffer: Schema.Number,
  /** The day a hold runs out. */
  holdUntil: Schema.Number,
  offers: Schema.Number,
  ships: Schema.Number,
  holds: Schema.Number,
  leaks: Schema.Number,
  counters: Schema.Number,
});
export type ResponseContext = typeof ResponseContext.Type;

export const responseMachine = setupEffect({
  schemas: {
    context: ResponseContext,
    input: ResponseContext,
    events: {
      /** A rival has launched. `eligible`: you are mid-run and far enough along for the card to make sense. */
      DROP: Schema.Struct({ day: Schema.Number, eligible: Schema.Boolean, gapDays: Schema.Number }),
      PICK: Schema.Struct({ pick: Schema.Literals(["ship", "hold", "leak"]), day: Schema.Number, holdDays: Schema.Number }),
      /** You launched a model. `strong`: it beats everyone's capability. */
      RELEASED: Schema.Struct({ day: Schema.Number, strong: Schema.Boolean }),
      DAY: Schema.Struct({ day: Schema.Number }),
    },
    emitted: {
      OFFER: Schema.Struct({}),
      SHIPPED: Schema.Struct({}),
      HELD: Schema.Struct({ until: Schema.Number }),
      LEAKED: Schema.Struct({}),
      COUNTER: Schema.Struct({ strong: Schema.Boolean }),
      EXPIRED: Schema.Struct({}),
      /** The run finished before the card was answered: the offer is off. */
      WITHDRAWN: Schema.Struct({}),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "idle",
  states: {
    idle: {
      on: {
        DROP: ({ context, event }, enq) => {
          if (!event.eligible || event.day - context.lastOffer < event.gapDays) return;
          enq.emit({ type: "OFFER" });
          return { target: "offered", context: { ...context, lastOffer: event.day, offers: context.offers + 1 } };
        },
      },
    },
    /** The card is up (or waiting for the screen). */
    offered: {
      on: {
        PICK: ({ context, event }, enq) => {
          switch (event.pick) {
            case "ship":
              enq.emit({ type: "SHIPPED" });
              return { target: "idle", context: { ...context, ships: context.ships + 1 } };
            case "leak":
              enq.emit({ type: "LEAKED" });
              return { target: "idle", context: { ...context, leaks: context.leaks + 1 } };
            case "hold": {
              const until = event.day + event.holdDays;
              enq.emit({ type: "HELD", until });
              return { target: "holding", context: { ...context, holds: context.holds + 1, holdUntil: until } };
            }
          }
        },
        RELEASED: (_args, enq) => {
          enq.emit({ type: "WITHDRAWN" });
          return { target: "idle" };
        },
      },
    },
    /** Waiting for your own launch, to answer. */
    holding: {
      on: {
        RELEASED: ({ context, event }, enq) => {
          enq.emit({ type: "COUNTER", strong: event.strong });
          return { target: "idle", context: { ...context, counters: context.counters + 1 } };
        },
        DAY: ({ context, event }, enq) => {
          if (event.day < context.holdUntil) return;
          enq.emit({ type: "EXPIRED" });
          return { target: "idle" };
        },
      },
    },
  },
});

export type ResponseStored = Stored<typeof responseMachine>;
