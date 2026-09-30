import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "./run";

export const tutorialMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ acknowledged: Schema.Boolean }),
    events: {
      FACTS: Schema.Struct({ path: Schema.Boolean, hall: Schema.Boolean, revenue: Schema.Boolean, hired: Schema.Boolean, released: Schema.Boolean }),
      CONTINUE: Schema.Struct({}),
      SKIP: Schema.Struct({}),
    },
    emitted: { FINISHED: Schema.Struct({}) },
  },
}).createMachine({
  context: { acknowledged: false },
  initial: "path",
  on: {
    CONTINUE: ({ context }) => ({ context: { ...context, acknowledged: true } }),
    SKIP: { target: ".skipped" },
  },
  states: {
    path: { on: { FACTS: ({ event }) => event.path ? { target: "hall", context: { acknowledged: false } } : undefined } },
    hall: { on: { FACTS: ({ event }) => event.hall ? { target: "gateway", context: { acknowledged: false } } : undefined } },
    gateway: { on: { FACTS: ({ event }) => event.revenue ? { target: "hire", context: { acknowledged: false } } : undefined } },
    hire: { on: { FACTS: ({ event }) => event.hired ? { target: "release", context: { acknowledged: false } } : undefined } },
    release: { on: { FACTS: ({ event }, enq) => {
      if (!event.released) return;
      enq.emit({ type: "FINISHED" });
      return { target: "done" };
    } } },
    done: { type: "final" },
    skipped: { type: "final" },
  },
});

export type TutorialStored = Stored<typeof tutorialMachine>;
