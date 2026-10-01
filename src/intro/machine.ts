// The big box (FLT-70) as one statechart. A UI-level machine: it knows the story beats, not the animation. The scene
// animates toward the beat it is in and sends SETTLED when a scripted move (the pull, the unwrap, the boot) is done,
// so every transition here is pure and the whole flow is testable with `transition()`.
//
//   shelf -PICK-> pulling -SETTLED-> held (TURN, FLIP: yours to admire) -OPEN-> unwrapping -SETTLED-> open
//   open <-FOCUS/BACK-> focus (the disc too: you pick it up and look at it)
//   focus on the disc -INSERT-> boot.{disc -> warmup -> post -> splash -> dive} -SETTLED-> game
//   still (reduced motion) -PLAY-> game          and from anywhere: SKIP / PLAY -> game
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { ItemId } from "./content";

/** Where `?beat=` can start the intro (screenshots and review links). */
export const START_BEATS = ["shelf", "front", "back", "open", "manual", "coa", "eula", "inserts", "cd", "disc", "post", "splash"] as const;
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
  /** FLT-95: which way the box in your hands faces, in eighths of a turn (0 the front, 4 the back); never wrapped. */
  turn: Schema.Number,
  start: opaque<StartBeat>(),
});
export type IntroContext = typeof IntroContext.Type;

export const IntroInput = Schema.Struct({ still: Schema.Boolean, sheets: Schema.Number, start: Schema.optional(opaque<StartBeat>()), page: Schema.optional(Schema.Number) });
export type IntroInput = typeof IntroInput.Type;

const clampPage = (c: IntroContext, page: number) => Math.max(0, Math.min(c.sheets, page));

/** Which face of the box you are looking at, for `turn` eighths of a turn: the front, a spine, or the back. */
export function sideOf(turn: number): "front" | "spine" | "back" {
  const f = (((Math.round(turn) % 8) + 8) % 8) as number;
  return f === 7 || f <= 1 ? "front" : f >= 3 && f <= 5 ? "back" : "spine";
}

/** The next turn, going the same way round, that shows the other face square on (a spine flips to the back). */
export function flipped(turn: number): number {
  const goal = sideOf(turn) === "back" ? 0 : 4;
  let t = Math.round(turn) + 1;
  while ((((t % 8) + 8) % 8) !== goal) t++;
  return t;
}

/** A drag can turn the box several eighths at once, but not more than a full turn, and never by NaN. */
const turnBy = (by: number) => (Number.isFinite(by) ? Math.max(-8, Math.min(8, Math.round(by))) : 0);

export const introMachine = setupEffect({
  schemas: {
    context: IntroContext,
    input: IntroInput,
    events: {
      /** Take our box off the shelf. */
      PICK: Schema.Struct({}),
      /** FLT-95: turn the box in your hands, in eighths (◀ ▶, or a drag let go). */
      TURN: Schema.Struct({ by: Schema.Number }),
      /** FLT-95: show the other face (Flip to back / Flip to front). */
      FLIP: Schema.Struct({}),
      /** FLT-95: open the box you are holding. */
      OPEN: Schema.Struct({}),
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
      /** Put the disc in the demo kiosk (the disc in your hand; anywhere else, pick it up first). */
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
    turn: !input.still && input.start === "back" ? 4 : 0,
    start: input.still ? "shelf" : (input.start ?? "shelf"),
  }),
  initial: "start",
  states: {
    // A review link can open on any beat (`?beat=coa`); a real visit starts at the shelf.
    start: {
      always: ({ context }) => {
        if (context.still) return { target: "still" };
        switch (context.start) {
          case "front":
          case "back":
            return { target: "held" };
          case "cd":
            return { target: "focus", context: { ...context, item: "disc" } };
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
    pulling: { on: { SETTLED: { target: "held" } } },
    // FLT-95: the box in your hands, front first. It waits: turn it, read the back, and open it when you're ready.
    held: {
      on: {
        TURN: ({ context, event }) => ({ target: "held", context: { ...context, turn: context.turn + turnBy(event.by) } }),
        FLIP: ({ context }) => ({ target: "held", context: { ...context, turn: flipped(context.turn) } }),
        OPEN: { target: "unwrapping" },
      },
    },
    unwrapping: { on: { SETTLED: { target: "open" } } },
    open: {
      on: {
        FOCUS: ({ context, event }) => ({ target: "focus", context: { ...context, item: event.item, page: 0 } }),
        INSERT: ({ context }) => ({ target: "focus", context: { ...context, item: "disc", page: 0 } }),
      },
    },
    focus: {
      on: {
        FOCUS: ({ context, event }) => ({ target: "focus", context: { ...context, item: event.item, page: 0 } }),
        BACK: ({ context }) => ({ target: "open", context: { ...context, item: null } }),
        PAGE: ({ context, event }) => ({ target: "focus", context: { ...context, page: clampPage(context, context.page + event.delta) } }),
        // FLT-95: only the disc in your hand goes in the drive; from anything else, Insert picks the disc up first.
        INSERT: ({ context }) => (context.item === "disc" ? { target: "boot", context: { ...context, item: null } } : { target: "focus", context: { ...context, item: "disc", page: 0 } }),
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

/** The beat as one word, for the scene and the captions: "shelf", "held", "open", "focus", "disc", ..., "game". */
export function beatOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "boot" in value) return String((value as { boot: string }).boot);
  return "shelf";
}
