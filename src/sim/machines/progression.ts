import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "./run";

const Wake = Schema.Struct({ id: Schema.String, day: Schema.Number });

/**
 * The ladder: `growing` one rung at a time, then (FLT-54) `waking` while the top rung's packs come on one by one, then
 * `complete`. `pending` is the wake-ups still to come, each on its game day; a save from before FLT-54 has none.
 */
export const progressionMachine = setupEffect({ schemas: {
  context: Schema.Struct({ level: Schema.Number, pending: Schema.optionalKey(Schema.Array(Wake)) }),
  events: {
    /**
     * Every tick. `met`: the rung's goal holds. `day`: today. `wakes`: the systems the top rung wakes later, and how many days
     * after it opens (the driver reads them from the ladder's content).
     */
    CHECK: Schema.Struct({ met: Schema.Boolean, day: Schema.Number, wakes: Schema.Array(Schema.Struct({ id: Schema.String, after: Schema.Number })) }),
  },
  emitted: {
    UNLOCKED: Schema.Struct({ level: Schema.Number }),
    /** A staggered system is due: the driver switches its pack on and puts up its own small New! card. */
    WOKE: Schema.Struct({ id: Schema.String }),
  },
} }).createMachine({ context: { level: 1 }, initial: "growing", states: {
  growing: { on: { CHECK: ({ context, event }, enq) => {
    if (!event.met || context.level >= 5) return;
    const level = context.level + 1;
    enq.emit({ type: "UNLOCKED", level });
    if (level < 5) return { context: { level }, target: "growing" };
    const pending = event.wakes.map((w) => ({ id: w.id, day: event.day + w.after })).sort((a, b) => a.day - b.day);
    return { context: { level, pending }, target: pending.length > 0 ? "waking" : "complete" };
  } } },
  waking: { on: { CHECK: ({ context, event }, enq) => {
    const pending = context.pending ?? [];
    const due = pending.filter((w) => w.day <= event.day);
    if (due.length === 0) return;
    // One a day at most: two due together (a long pause, a save from a slower build) still get a day each.
    enq.emit({ type: "WOKE", id: due[0]!.id });
    const rest = pending.filter((w) => w !== due[0]).map((w) => (w.day <= event.day ? { id: w.id, day: event.day + 1 } : w));
    return { context: { level: context.level, pending: rest }, target: rest.length > 0 ? "waking" : "complete" };
  } } },
  complete: {},
} });
export type ProgressionStored = Stored<typeof progressionMachine>;
