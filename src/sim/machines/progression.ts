import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "./run";

export const progressionMachine = setupEffect({ schemas: {
  context: Schema.Struct({ level: Schema.Number }),
  events: { CHECK: Schema.Struct({ met: Schema.Boolean }) },
  emitted: { UNLOCKED: Schema.Struct({ level: Schema.Number }) },
} }).createMachine({ context: { level: 1 }, initial: "growing", states: {
  growing: { on: { CHECK: ({ context, event }, enq) => {
    if (!event.met || context.level >= 5) return;
    const level = context.level + 1;
    enq.emit({ type: "UNLOCKED", level });
    return { context: { level }, target: level === 5 ? "complete" : "growing" };
  } } }, complete: {},
} });
export type ProgressionStored = Stored<typeof progressionMachine>;
