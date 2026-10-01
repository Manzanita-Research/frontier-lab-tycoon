// The big box (FLT-70) as one statechart. A UI-level machine: it knows the story beats, not the animation. The scene
// animates toward the beat it is in and sends SETTLED when a scripted move (the pull, the unwrap, the boot) is done,
// so every transition here is pure and the whole flow is testable with `transition()`.
//
//   shelf -PICK-> pulling -SETTLED-> unwrapping -SETTLED-> open <-FOCUS/BACK-> focus
//   open|focus -INSERT-> boot.{disc -> warmup -> post -> splash -> dive} -SETTLED-> game
//   still (reduced motion) -PLAY-> game          and from anywhere: SKIP / PLAY -> game
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { ItemId } from "./content";

/** Where `?beat=` can start the intro (screenshots and review links). */
export const START_BEATS = ["shelf", "open", "manual", "coa", "eula", "inserts", "disc", "post", "splash"] as const;
export type StartBeat = (typeof START_BEATS)[number];

const opaque = <T>() => Schema.declare<T>((_value): _value is T => true);

export const IntroContext = Schema.Struct({
  /** Reduced motion: a still box and a Play button, no 3D. */
  still: Schema.Boolean,
  /** The shelf box that was picked up and read (not ours), or null. */
  peek: Schema.NullOr(Schema.String),
  /** The item held up close, or null. */
  item: opaque<ItemId | null>(),
  /** Manual sheets turned: 0 is closed on the cover, `sheets` is closed on the back. */
  page: Schema.Number,
  sheets: Schema.Number,
  start: opaque<StartBeat>(),
});
export type IntroContext = typeof IntroContext.Type;

export const IntroInput = Schema.Struct({ still: Schema.Boolean, sheets: Schema.Number, start: Schema.optional(opaque<StartBeat>()), page: Schema.optional(Schema.Number) });
export type IntroInput = typeof IntroInput.Type;

const clampPage = (c: IntroContext, page: number) => Math.max(0, Math.min(c.sheets, page));

export const introMachine = setupEffect({
  schemas: {
    context: IntroContext,
    input: IntroInput,
    events: {
      /** Take our box off the shelf. */
      PICK: Schema.Struct({}),
      /** Pick up someone else's box and read the back (null puts it back). */
      PEEK: Schema.Struct({ id: Schema.NullOr(Schema.String) }),
      /** The scripted move for this beat has finished. */
      SETTLED: Schema.Struct({}),
      /** Hold an item from the box up close. */
      FOCUS: Schema.Struct({ item: opaque<ItemId>() }),
      /** Put it down again. */
      BACK: Schema.Struct({}),
      /** Turn the manual's pages (+1 forward, -1 back). */
      PAGE: Schema.Struct({ delta: Schema.Number }),
      /** Put the disc in the demo kiosk. */
      INSERT: Schema.Struct({}),
      /** Skip intro → (the button, or any key where a key means nothing else). */
      SKIP: Schema.Struct({}),
      /** Play now (the still box's button). */
      PLAY: Schema.Struct({}),
    },
  },
}).createMachine({
  context: ({ input }) => ({
    still: input.still,
    peek: null,
    item: null,
    page: input.page ?? 0,
    sheets: input.sheets,
    start: input.still ? "shelf" : (input.start ?? "shelf"),
  }),
  initial: "start",
  states: {
    // A review link can open on any beat (`?beat=coa`); a real visit starts at the shelf.
    start: {
      always: ({ context }) => {
        if (context.still) return { target: "still" };
        switch (context.start) {
          case "open":
            return { target: "open" };
          case "manual":
          case "coa":
          case "eula":
          case "inserts":
            return { target: "focus", context: { ...context, item: context.start, page: context.start === "manual" ? Math.max(1, context.page) : 0 } };
          case "disc":
            return { target: "boot.disc" };
          case "post":
            return { target: "boot.post" };
          case "splash":
            return { target: "boot.splash" };
          default:
            return { target: "shelf" };
        }
      },
    },
    shelf: {
      on: {
        PICK: ({ context }) => ({ target: "pulling", context: { ...context, peek: null } }),
        PEEK: ({ context, event }) => ({ target: "shelf", context: { ...context, peek: event.id } }),
      },
    },
    pulling: { on: { SETTLED: { target: "unwrapping" } } },
    unwrapping: { on: { SETTLED: { target: "open" } } },
    open: {
      on: {
        FOCUS: ({ context, event }) => (event.item === "disc" ? { target: "boot" } : { target: "focus", context: { ...context, item: event.item, page: 0 } }),
        INSERT: { target: "boot" },
      },
    },
    focus: {
      on: {
        FOCUS: ({ context, event }) => (event.item === "disc" ? { target: "boot", context: { ...context, item: null } } : { target: "focus", context: { ...context, item: event.item, page: 0 } }),
        BACK: ({ context }) => ({ target: "open", context: { ...context, item: null } }),
        PAGE: ({ context, event }) => ({ target: "focus", context: { ...context, page: clampPage(context, context.page + event.delta) } }),
        INSERT: ({ context }) => ({ target: "boot", context: { ...context, item: null } }),
      },
    },
    boot: {
      initial: "disc",
      states: {
        disc: { on: { SETTLED: { target: "warmup" } } },
        warmup: { on: { SETTLED: { target: "post" } } },
        post: { on: { SETTLED: { target: "splash" } } },
        splash: { on: { SETTLED: { target: "dive" } } },
        dive: { on: { SETTLED: { target: "#intro.game" } } },
      },
    },
    // Reduced motion: the box, Play, and the manual as plain text.
    still: {
      on: {
        FOCUS: ({ context, event }) => ({ target: "still", context: { ...context, item: event.item === "manual" ? "manual" : null } }),
        BACK: ({ context }) => ({ target: "still", context: { ...context, item: null } }),
      },
    },
    game: { type: "final" },
  },
  id: "intro",
  on: {
    SKIP: { target: ".game" },
    PLAY: { target: ".game" },
  },
});

/** The beat as one word, for the scene and the captions: "shelf", "open", "focus", "disc", ..., "game". */
export function beatOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "boot" in value) return String((value as { boot: string }).boot);
  return "shelf";
}
