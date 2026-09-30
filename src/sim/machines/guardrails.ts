import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "./run";
import type { PendingConfirm } from "../guardrails";

const pending = Schema.declare<PendingConfirm>((v): v is PendingConfirm => typeof v === "object" && v !== null);
const context = Schema.Struct({ pendingConfirm: Schema.NullOr(pending), lowRunway: Schema.Boolean, gateDisconnected: Schema.Boolean });
export const guardrailsMachine = setupEffect({
  schemas: {
    context, input: context,
    events: {
      REQUEST: Schema.Struct({ pendingConfirm: pending }),
      CLEAR: Schema.Struct({}),
      OBSERVE: Schema.Struct({ lowRunway: Schema.Boolean, gateDisconnected: Schema.Boolean }),
      HALL: Schema.Struct({ redundant: Schema.Boolean }),
    },
    emitted: { NUDGE: Schema.Struct({}), REDUNDANT_HALL: Schema.Struct({}) },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "clear",
  on: {
    OBSERVE: ({ context, event }, enq) => {
      if (event.lowRunway && !context.lowRunway) enq.emit({ type: "NUDGE" });
      return { context: { ...context, lowRunway: event.lowRunway, gateDisconnected: event.gateDisconnected } };
    },
    HALL: ({ event }, enq) => { if (event.redundant) enq.emit({ type: "REDUNDANT_HALL" }); },
  },
  states: {
    clear: { on: { REQUEST: ({ context, event }) => ({ target: "confirming", context: { ...context, pendingConfirm: event.pendingConfirm } }) } },
    confirming: { on: {
      REQUEST: ({ context, event }) => ({ context: { ...context, pendingConfirm: event.pendingConfirm } }),
      CLEAR: ({ context }) => ({ target: "clear", context: { ...context, pendingConfirm: null } }),
    } },
  },
});
export type GuardrailsStored = Stored<typeof guardrailsMachine>;
