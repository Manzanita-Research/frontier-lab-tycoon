import { setupEffect } from "@xstate/effect";
import { Schema } from "effect";
import type { Stored } from "../../machines/run";
export const Policy = Schema.Literals(["Open", "Selective", "Closed"]);
export type PublicationPolicy = typeof Policy.Type;
const Context = Schema.Struct({ publishPressure: Schema.Number });
export const policyMachine = setupEffect({ schemas: {
  context: Context, input: Context,
  events: {
    DRAFT: Schema.Struct({ importance: Schema.Number, selectiveImportance: Schema.Number }),
    SET: Schema.Struct({ policy: Policy }),
    DAY: Schema.Struct({ hasResearch: Schema.Boolean, closedPressure: Schema.Number, recovery: Schema.Number, maxPressure: Schema.Number }),
  },
  emitted: { SUBMIT: Schema.Struct({ route: Schema.Literals(["preprint", "review"]) }) },
} }).createMachine({
  context: ({ input }) => input,
  initial: "Selective",
  on: {
    SET: ({ event }) => ({ target: `.${event.policy}` }),
    DAY: ({ context, event }) => ({ context: { publishPressure: Math.min(event.maxPressure, Math.max(0,
      context.publishPressure - event.recovery,
    )) } }),
  },
  states: {
    Open: { on: { DRAFT: ({ context }, enq) => {
      enq.emit({ type: "SUBMIT", route: "preprint" });
      return { target: "Open", context };
    } } },
    Selective: { on: { DRAFT: ({ context, event }, enq) => {
      if (event.importance >= event.selectiveImportance) enq.emit({ type: "SUBMIT", route: "review" });
      return { target: "Selective", context };
    } } },
    Closed: { on: { DAY: ({ context, event }) => ({ context: {
      publishPressure: Math.min(event.maxPressure, Math.max(0, context.publishPressure + (event.hasResearch ? event.closedPressure : -event.recovery))),
    } }) } },
  },
});
export type PolicyStored = Stored<typeof policyMachine>;
