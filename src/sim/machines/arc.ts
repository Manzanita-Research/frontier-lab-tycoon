// One satire arc, one instance per event card (content/events.ts): calm -> brewing -> cardOpen -> cooldown -> calm.
// The Water Discourse arc is two of these: the water card, then the drum circle it sets up through a flag.
// Pure. The driver (sim/events.ts) evaluates the card's condition against the World and applies the picked
// choice's effects; this decides when a card opens, which picks count, and when it may come back.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { EventFromLogic } from "xstate";
import { step, type Stored } from "./run";

export const ArcContext = Schema.Struct({
  /** Choices on the card: a pick outside 0..choices-1 is ignored. */
  choices: Schema.Number,
  /** Days before the card may open again, counted from the day it opened. */
  cooldownDays: Schema.Number,
  /** The day the card last opened, or null if it never has. */
  openedDay: Schema.NullOr(Schema.Number),
});
export type ArcContext = typeof ArcContext.Type;

export const arcMachine = setupEffect({
  schemas: {
    context: ArcContext,
    input: ArcContext,
    events: {
      /**
       * The daily check. `ready` = the card's condition holds today; `slotFree` = no other card is open
       * (only one at a time, earlier arcs go first). `pace` scales the cooldown: the later eras run faster (1 = normal).
       */
      DAY: Schema.Struct({ day: Schema.Number, ready: Schema.Boolean, slotFree: Schema.Boolean, pace: Schema.Number }),
      /** The player picked a choice on the open card. */
      CHOOSE: Schema.Struct({ choiceIndex: Schema.Number }),
    },
    emitted: {
      /** A valid pick: the driver applies the choice's effects. */
      RESOLVED: Schema.Struct({ choiceIndex: Schema.Number }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "calm",
  states: {
    /** Armed and waiting for its condition. */
    calm: { on: { DAY: ({ context, event }) => evaluate(context, event) } },
    /** The condition holds but another card has the screen. Opens as soon as the slot frees. */
    brewing: { on: { DAY: ({ context, event }) => evaluate(context, event) } },
    /** On screen. Time stands still until the player answers. */
    cardOpen: {
      on: {
        CHOOSE: ({ context, event }, enq) => {
          if (!Number.isInteger(event.choiceIndex) || event.choiceIndex < 0 || event.choiceIndex >= context.choices) return;
          enq.emit({ type: "RESOLVED", choiceIndex: event.choiceIndex });
          return { target: "cooldown" };
        },
      },
    },
    /** Answered. Quiet until the cooldown is over, then it is re-armed the same day. */
    cooldown: {
      on: {
        DAY: ({ context, event }) => {
          if (context.openedDay !== null && event.day - context.openedDay < context.cooldownDays * event.pace) return;
          return evaluate(context, event);
        },
      },
    },
  },
});

export type ArcStored = Stored<typeof arcMachine>;

type ArcDay = Extract<EventFromLogic<typeof arcMachine>, { type: "DAY" }>;

/**
 * A DAY that leaves the card as it is, done without `transition()` (FLT-39): on the daily check nearly every card is calm
 * with its condition unmet, or still cooling down, and sixty machine steps a midnight are not free. Returns null when
 * the machine has something to decide. Mirrors the "stay" branches above exactly (a test checks it against the machine).
 */
export function quietArcDay(stored: ArcStored, event: ArcDay): ArcStored | null {
  const { openedDay, cooldownDays } = stored.context;
  switch (stored.value) {
    case "calm":
      return event.ready ? null : stored;
    case "cooldown":
      return openedDay !== null && event.day - openedDay < cooldownDays * event.pace ? stored : null;
  }
  return null;
}

/** The daily check for one card: the quiet day when it is one, the machine otherwise. */
export const dayArc = (stored: ArcStored, event: ArcDay): ArcStored => quietArcDay(stored, event) ?? step(arcMachine, stored, event).stored;

function evaluate(context: ArcContext, event: { day: number; ready: boolean; slotFree: boolean }) {
  if (!event.ready) return { target: "calm" };
  if (!event.slotFree) return { target: "brewing" };
  return { target: "cardOpen", context: { ...context, openedDay: event.day } };
}
