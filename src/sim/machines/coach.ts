import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "./run";

export const coachMachine = setupEffect({ schemas: {
  context: Schema.Struct({ index: Schema.Number, elapsed: Schema.Number }),
  events: {
    CHECK: Schema.Struct({ matches: Schema.Boolean, last: Schema.Boolean }),
    TICK: Schema.Struct({ timer: Schema.Boolean, last: Schema.Boolean }),
    CLICK: Schema.Struct({ timer: Schema.Boolean, last: Schema.Boolean }),
    SKIP: Schema.Struct({}), REPLAY: Schema.Struct({}),
  },
} }).createMachine({
  context: { index: 0, elapsed: 0 }, initial: "active",
  on: { SKIP: { target: ".skipped" }, REPLAY: { target: ".active", context: { index: 0, elapsed: 0 } } },
  states: {
    active: { on: {
      CHECK: ({ context, event }) => event.matches ? { target: event.last ? "done" : "active", context: { index: context.index + 1, elapsed: 0 } } : undefined,
      TICK: ({ context, event }) => !event.timer ? undefined : context.elapsed >= 19
        ? { target: event.last ? "done" : "active", context: { index: context.index + 1, elapsed: 0 } }
        : { context: { ...context, elapsed: context.elapsed + 1 } },
      CLICK: ({ context, event }) => event.timer ? { target: event.last ? "done" : "active", context: { index: context.index + 1, elapsed: 0 } } : undefined,
    } },
    done: {}, skipped: {},
  },
});
export type CoachStored = Stored<typeof coachMachine>;
