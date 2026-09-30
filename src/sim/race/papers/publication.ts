// Pure publication lifecycle. Dice and content decisions arrive as events; time is whole game days.
import { setupEffect } from "@xstate/effect";
import { Schema } from "effect";
import type { Stored } from "../../machines/run";
const Context = Schema.Struct({
  importance: Schema.Number, value: Schema.Number, submittedDay: Schema.NullOr(Schema.Number),
  publishedDay: Schema.NullOr(Schema.Number), dueDay: Schema.NullOr(Schema.Number),
  scoopedBy: Schema.String, scoopedDay: Schema.NullOr(Schema.Number),
  award: Schema.String, citations: Schema.Number, critiqueDay: Schema.NullOr(Schema.Number),
});
const Submit = Schema.Struct({ day: Schema.Number, reviewDays: Schema.Number, critiqueDay: Schema.NullOr(Schema.Number) });
const Day = Schema.Struct({ day: Schema.Number, scoopRival: Schema.String, scoopValue: Schema.Number, award: Schema.String,
  citationGain: Schema.Number, critiqueValue: Schema.Number });
export const publicationMachine = setupEffect({ schemas: {
  context: Context, input: Context,
  events: { PREPRINT: Submit, REVIEW: Submit, DAY: Day },
  emitted: {
    PUBLISHED: Schema.Struct({ review: Schema.Boolean }),
    SCOOPED: Schema.Struct({ rival: Schema.String }),
    AWARDED: Schema.Struct({ award: Schema.String }),
    CRITIQUED: Schema.Struct({}),
  },
} }).createMachine({
  context: ({ input }) => input,
  initial: "draft",
  states: {
    draft: { on: {
      PREPRINT: ({ context, event }, enq) => {
        enq.emit({ type: "PUBLISHED", review: false });
        return { target: "published", context: { ...context, submittedDay: event.day, publishedDay: event.day, critiqueDay: event.critiqueDay } };
      },
      REVIEW: ({ context, event }) => ({ target: "review", context: { ...context, submittedDay: event.day, dueDay: event.day + event.reviewDays } }),
    } },
    review: { on: { DAY: ({ context, event }, enq) => {
      if (context.dueDay === null) return { target: "review", context };
      if (event.day === context.dueDay - 1 && event.scoopRival && !context.scoopedBy) {
        enq.emit({ type: "SCOOPED", rival: event.scoopRival });
        return { target: "review", context: { ...context, scoopedBy: event.scoopRival, scoopedDay: event.day, value: context.value * event.scoopValue } };
      }
      if (event.day < context.dueDay) return { target: "review", context };
      enq.emit({ type: "PUBLISHED", review: true });
      if (event.award && !context.scoopedBy) enq.emit({ type: "AWARDED", award: event.award });
      const award = context.scoopedBy ? "" : event.award;
      return { target: award ? "awarded" : "published", context: { ...context, award, publishedDay: event.day } };
    } } },
    published: { on: { DAY: ({ context, event }, enq) => {
      const next = { ...context, citations: context.citations + event.citationGain };
      if (context.critiqueDay === event.day) {
        enq.emit({ type: "CRITIQUED" });
        return { target: "criticized", context: { ...next, value: context.value * event.critiqueValue } };
      }
      return { target: "published", context: next };
    } } },
    criticized: { on: { DAY: ({ context, event }) => ({ target: "criticized", context: { ...context, citations: context.citations + event.citationGain } }) } },
    awarded: { on: { DAY: ({ context, event }) => ({ target: "awarded", context: { ...context, citations: context.citations + event.citationGain } }) } },
  },
});
export type PublicationStored = Stored<typeof publicationMachine>;
