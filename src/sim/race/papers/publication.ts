// Pure publication lifecycle. Dice and content decisions arrive as events; time is whole game days.
import { setupEffect } from "@xstate/effect";
import { Schema } from "effect";
import { step, type Stored } from "../../machines/run";
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
type PaperDay = typeof Day.Type;

/**
 * A DAY with nothing to announce, done without `transition()` (FLT-39): a paper under review that is not due, or a
 * finished one collecting citations. Null when the machine has something to say (a scoop, the verdict, a critique).
 * Mirrors the branches above exactly (a test checks it against the machine).
 */
export function quietPaperDay(stored: PublicationStored, event: PaperDay): PublicationStored | null {
  const c = stored.context;
  switch (stored.value) {
    case "review":
      if (c.dueDay === null) return { value: "review", context: c };
      if (event.day === c.dueDay - 1 && event.scoopRival && !c.scoopedBy) return null;
      return event.day < c.dueDay ? { value: "review", context: c } : null;
    case "published":
      return c.critiqueDay === event.day ? null : { value: "published", context: { ...c, citations: c.citations + event.citationGain } };
    case "criticized":
    case "awarded":
      return { value: stored.value, context: { ...c, citations: c.citations + event.citationGain } };
  }
  return null;
}

/** The daily step for one paper: the quiet day when it is one, the machine otherwise. */
export const dayPaper = (stored: PublicationStored, event: PaperDay) => {
  const quiet = quietPaperDay(stored, event);
  return quiet ? { stored: quiet, effects: [] } : step(publicationMachine, stored, { type: "DAY", ...event });
};
