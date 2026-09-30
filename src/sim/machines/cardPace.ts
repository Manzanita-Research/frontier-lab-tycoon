// The card budget (FLT-54): one card on screen at a time was never the problem, one card straight after another was.
// Remembers when the last card opened and when each story last had the screen; `pacerAllows` asks it. The driver
// (sim/events.ts) tells it when a card opens; the app tells it the speed through the `setPace` command, and the gap
// stretches with the speed so a card is never closer than about 20 real seconds to the last one. Game days only.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "./run";
import { CARD_GAP_DAYS, CARD_REAL_SECONDS, STORY_GAP_DAYS } from "../../content/cardPacing";

export const pacerMachine = setupEffect({ schemas: {
  context: Schema.Struct({
    /** The day the last card opened, or null before the first. */
    last: Schema.NullOr(Schema.Number),
    /** The day each story's last card opened. */
    stories: Schema.Record(Schema.String, Schema.Number),
    /** Game days between any two cards. */
    gap: Schema.Number,
    /** Game days between two cards of one story. */
    storyGap: Schema.Number,
    /** 10×: minor cards answer themselves even when the screen is free. */
    auto: Schema.Boolean,
    /**
     * The waiting line: cards whose moment came while the budget was spent, oldest first, and the day each last asked. The
     * daily check and the packs that open their own cards (a hearing's questions) share it; whoever stops asking drops out.
     */
    queue: Schema.Array(Schema.Struct({ id: Schema.String, asked: Schema.Number })),
    /** The card last seen on screen (`id@day`), so a card opened by a pack's own driver is counted once. */
    seen: Schema.NullOr(Schema.String),
  }),
  events: {
    /** A card took the screen (whoever opened it). */
    OPENED: Schema.Struct({ id: Schema.String, story: Schema.String, day: Schema.Number }),
    /** A pack's own card would like the screen today: it joins the back of the line (or keeps its place). */
    JOIN: Schema.Struct({ id: Schema.String, day: Schema.Number }),
    /** The daily check's brewing cards join too; then anyone who did not ask today leaves the line. */
    WAITING: Schema.Struct({ ids: Schema.Array(Schema.String), day: Schema.Number }),
    PACE: Schema.Struct({ gap: Schema.Number, storyGap: Schema.Number, auto: Schema.Boolean }),
  },
} }).createMachine({
  context: { last: null, stories: {}, gap: CARD_GAP_DAYS, storyGap: STORY_GAP_DAYS, auto: false, queue: [], seen: null },
  initial: "pacing",
  states: { pacing: { on: {
    OPENED: ({ context, event }) => ({ target: "pacing", context: {
      ...context, last: event.day, stories: { ...context.stories, [event.story]: event.day }, seen: `${event.id}@${event.day}`,
      queue: context.queue.filter((q) => q.id !== event.id),
    } }),
    JOIN: ({ context, event }) => ({ target: "pacing", context: { ...context, queue: asked(context.queue, [event.id], event.day) } }),
    WAITING: ({ context, event }) => {
      const queue = asked(context.queue, event.ids, event.day).filter((q) => q.asked >= event.day);
      if (queue.length === context.queue.length && queue.every((q, i) => q.id === context.queue[i]!.id && q.asked === context.queue[i]!.asked)) return;
      return { target: "pacing", context: { ...context, queue } };
    },
    PACE: ({ context, event }) => ({ target: "pacing", context: { ...context, gap: event.gap, storyGap: event.storyGap, auto: event.auto } }),
  } } },
});
export type PacerStored = Stored<typeof pacerMachine>;

type Waiting = readonly { id: string; asked: number }[];
function asked(queue: Waiting, ids: readonly string[], day: number): Waiting {
  const next = queue.map((q) => (ids.includes(q.id) ? { id: q.id, asked: day } : q));
  for (const id of ids) if (!queue.some((q) => q.id === id)) next.push({ id, asked: day });
  return next;
}
type PacerContext = PacerStored["context"];
export type Pacing = "urgent" | "priority" | "chain" | "normal";

/**
 * May card `id` of `story` open on `day`? Only the front of the line may (or anyone, when nobody waits). `urgent` (a
 * disaster) jumps the line and keeps only the 1× gap, however fast the game runs; `chain` (the next question of a sitting
 * already under way) keeps the gap but not its own story's; `priority` (an offer on a clock) keeps both but not the line.
 */
export function pacerAllows(c: PacerContext, id: string, story: string, day: number, how: Pacing = "normal"): boolean {
  if (c.last !== null && day - c.last < (how === "urgent" ? Math.min(c.gap, CARD_GAP_DAYS) : c.gap)) return false;
  if (how === "urgent") return true;
  if (how !== "priority" && c.queue.length > 0 && c.queue[0]!.id !== id) return false;
  if (how === "chain") return true;
  const own = c.stories[story];
  return own === undefined || day - own >= c.storyGap;
}

/** The gap for a speed: never under CARD_GAP_DAYS, and never closer than CARD_REAL_SECONDS of real time. */
export function paceFor(speed: number, ticksPerSecond: number, ticksPerDay: number) {
  const gap = Math.max(CARD_GAP_DAYS, Math.ceil((CARD_REAL_SECONDS * ticksPerSecond * speed) / ticksPerDay));
  return { gap, storyGap: Math.max(STORY_GAP_DAYS, gap), auto: speed >= 10 };
}
