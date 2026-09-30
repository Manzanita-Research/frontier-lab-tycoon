// The training run lifecycle: idle (no Training Hall) <-> training -> releasing -> training.
// Pure: no rng, no World. The driver (sim/training.ts) does the arithmetic, pre-rolls the names and applies the
// emitted effects to the World in order.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { runCostGrowth } from "../constants";
import type { Stored } from "./run";

export const TrainingContext = Schema.Struct({
  run: Schema.Number,
  progress: Schema.Number,
  cost: Schema.Number,
  /** Name of the model this run will produce. */
  name: Schema.String,
});
export type TrainingContext = typeof TrainingContext.Type;

export const trainingMachine = setupEffect({
  schemas: {
    context: TrainingContext,
    input: TrainingContext,
    events: {
      /** Once a game day. `halls` = Training Halls standing; `gain` = compute turned into progress today. */
      DAY: Schema.Struct({ halls: Schema.Number, gain: Schema.Number }),
      /** The driver has picked the name for the run after a release. */
      NAMED: Schema.Struct({ name: Schema.String }),
      /** Release Leapfrog's "ship now" (FLT-27): a preview ships early, adding `scale` (0 to 1) of the release; the run carries on. */
      SHIP_NOW: Schema.Struct({ scale: Schema.Number }),
    },
    emitted: {
      /** A run finished: `run` shipped `model` and capability grows by `gain`. */
      RELEASED: Schema.Struct({ model: Schema.String, run: Schema.Number, gain: Schema.Number }),
      /** The next run kicked off under this name. */
      RUN_STARTED: Schema.Struct({ model: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "training",
  states: {
    idle: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.halls === 0) return;
          return advance(context, event.gain, enq);
        },
      },
    },
    training: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.halls === 0) return { target: "idle" };
          return advance(context, event.gain, enq);
        },
        // A preview: the release lands now (scaled), and the run carries on to the full one. The driver books what the
        // preview already paid out and takes it off the final release (see settlePreview in race/leapfrog/ops.ts).
        SHIP_NOW: ({ context, event }, enq) => {
          enq.emit({ type: "RELEASED", model: `${context.name}-preview`, run: context.run, gain: releaseGain(context.run) * event.scale });
        },
      },
    },
    /** A model just shipped; waiting for the driver to name the next run. */
    releasing: {
      on: {
        NAMED: ({ context, event }, enq) => {
          const next = { run: context.run + 1, progress: context.progress - context.cost, cost: Math.round(context.cost * runCostGrowth(context.run)), name: event.name };
          enq.emit({ type: "RUN_STARTED", model: next.name });
          if (next.progress >= next.cost) {
            enq.emit({ type: "RELEASED", model: next.name, run: next.run, gain: releaseGain(next.run) });
            return { target: "releasing", context: next, reenter: true };
          }
          return { target: "training", context: next };
        },
      },
    },
  },
});

export type TrainingStored = Stored<typeof trainingMachine>;

/** Capability a release adds. */
export const releaseGain = (run: number) => 12 + 4 * run;

type Enq = { emit: (e: { type: "RELEASED"; model: string; run: number; gain: number }) => void };

function advance(context: TrainingContext, gain: number, enq: Enq) {
  const next = { ...context, progress: context.progress + gain };
  if (next.progress < next.cost) return { target: "training", context: next };
  enq.emit({ type: "RELEASED", model: next.name, run: next.run, gain: releaseGain(next.run) });
  return { target: "releasing", context: next };
}
