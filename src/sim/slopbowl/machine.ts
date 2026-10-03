// The lunch order (FLT-109): quiet -> late -> hangry -> worse -> meltdown -> arriving -> fed -> quiet. Pure: the driver
// (slopbowl/driver.ts) rolls the noon die and says when the courier is done, and runs each BEAT the machine emits.
// It hears TICK only on the ticks the driver has something to ask (a noon, a half-day mark, the courier leaving), so it
// costs nothing on the other ticks. Game time is ticks: a day is TICKS_PER_DAY.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { TICKS_PER_DAY } from "../constants";
import { SLOPBOWL, type SlopBeat } from "./pack";
import { step, type Stored } from "../machines/run";
import type { EventFromLogic } from "xstate";

const D = SLOPBOWL.rules.days;

export const SlopContext = Schema.Struct({
  /** The tick the order fell due (noon), so how late it is now is `(tick - due) / TICKS_PER_DAY` days. */
  due: Schema.Number,
  /** The tick the bowls were handed out. */
  fedAt: Schema.Number,
  /** What the player picked on the card: wait (also the default with no card), granola or backup. */
  pick: Schema.String,
});
export type SlopContext = typeof SlopContext.Type;

type Stage = "late" | "hangry" | "worse" | "meltdown" | "arriving";

export const slopBowlMachine = setupEffect({
  schemas: {
    context: SlopContext,
    input: SlopContext,
    events: {
      /** `late`: it is noon and the die (or a forcing flag) says the order is late. `delivered`: the courier has handed the bowls over. */
      TICK: Schema.Struct({ tick: Schema.Number, late: Schema.Boolean, delivered: Schema.Boolean }),
      /** The player's answer on the card. */
      CHOSE: Schema.Struct({ pick: Schema.String }),
    },
    emitted: {
      /** A beat for the driver to play: its lines, posts, Aura, the crowd, the courier, the research. */
      BEAT: Schema.Struct({ beat: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "quiet",
  states: {
    quiet: {
      on: {
        TICK: ({ context, event }, enq) => {
          if (!event.late) return;
          enq.emit({ type: "BEAT", beat: "late" });
          return { target: "late", context: { due: event.tick, fedAt: context.fedAt, pick: "wait" } };
        },
      },
    },
    /** Due, not here. The tracker says "nearby". */
    late: { on: { TICK: ({ context, event }, enq) => later(context, event, D.hangry, "hangry", enq), CHOSE: (a, enq) => chose(a, enq, "late") } },
    /** A day late: hangry, research going backwards, the card. */
    hangry: { on: { TICK: ({ context, event }, enq) => later(context, event, D.worse, "worse", enq), CHOSE: (a, enq) => chose(a, enq, "hangry") } },
    /** Two days late: the rival labs pile on. */
    worse: { on: { TICK: ({ context, event }, enq) => later(context, event, D.meltdown, "meltdown", enq), CHOSE: (a, enq) => chose(a, enq, "worse") } },
    /** Deep into day three: people lie down on the floor. */
    meltdown: { on: { TICK: ({ context, event }, enq) => later(context, event, D.arrive, "arriving", enq, "arrive"), CHOSE: (a, enq) => chose(a, enq, "meltdown") } },
    /** Three days late: the courier is walking in from the gate with the bowls. */
    arriving: {
      on: {
        TICK: ({ context, event }, enq) => {
          if (!event.delivered && event.tick - context.due < (D.arrive + D.courierWait) * TICKS_PER_DAY) return;
          enq.emit({ type: "BEAT", beat: "fed" });
          if (context.pick === "backup") enq.emit({ type: "BEAT", beat: "backup" });
          return { target: "fed", context: { ...context, fedAt: event.tick } };
        },
        CHOSE: (a, enq) => chose(a, enq, "arriving"),
      },
    },
    /** Lunch: everyone eating, then back to work, faster than before, until the research it cost is won back. */
    fed: {
      on: {
        TICK: ({ context, event }) => {
          if (event.tick - context.fedAt < D.fed * TICKS_PER_DAY) return;
          return { target: "quiet", context };
        },
      },
    },
  },
});

type Enq = { emit: (e: { type: "BEAT"; beat: string }) => void };
interface Tick { tick: number; late: boolean; delivered: boolean }

/** On to `next` once the order is `days` late, playing `beat` (the stage's own name unless given). */
function later(context: SlopContext, event: Tick, days: number, next: Stage, enq: Enq, beat: SlopBeat = next as SlopBeat): { target: Stage; context: SlopContext } | undefined {
  if (event.tick - context.due < days * TICKS_PER_DAY) return undefined;
  enq.emit({ type: "BEAT", beat });
  return { target: next, context };
}

/** The card's answer: remembered for the rest of the order (the granola halves the slide, the backup doubles the bowls). */
function chose({ context, event }: { context: SlopContext; event: { pick: string } }, enq: Enq, stage: Stage): { target: Stage; context: SlopContext } {
  if (event.pick === "granola") enq.emit({ type: "BEAT", beat: "granola" });
  return { target: stage, context: { ...context, pick: event.pick } };
}

export type SlopBowlStored = Stored<typeof slopBowlMachine>;
export const freshSlopBowl = (): SlopBowlStored => ({ value: "quiet", context: { due: 0, fedAt: 0, pick: "wait" } });
export const stepSlopBowl = (stored: SlopBowlStored, event: EventFromLogic<typeof slopBowlMachine>) => step(slopBowlMachine, stored, event);
