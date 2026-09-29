// The era ratchet: era1 -> era2 -> era3 -> era4, on the R&D multiplier. It only ever climbs, so a new hall
// (more researchers, a lower multiplier) never takes an era away or shows the title card twice.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { eraOf } from "../../content/eras";
import type { Stored } from "../machines/run";

export const EraContext = Schema.Struct({
  /** The highest multiplier reached so far. */
  peak: Schema.Number,
});
export type EraContext = typeof EraContext.Type;

type Enq = { emit: (e: { type: "ERA_REACHED"; era: number }) => void };

export const eraMachine = setupEffect({
  schemas: {
    context: EraContext,
    input: EraContext,
    events: {
      /** The daily check: the R&D multiplier as it stands. */
      DAY: Schema.Struct({ mult: Schema.Number }),
    },
    emitted: {
      /** A new era began. The driver sets the flag that opens its title card. */
      ERA_REACHED: Schema.Struct({ era: Schema.Number }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "era1",
  states: {
    /** Stumbling Agents (under 2x). */
    era1: { on: { DAY: ({ context, event }, enq) => climb(1, context, event.mult, enq) } },
    /** Coding Automation (2x to 5x). */
    era2: { on: { DAY: ({ context, event }, enq) => climb(2, context, event.mult, enq) } },
    /** Superhuman Coder (5x to 25x). */
    era3: { on: { DAY: ({ context, event }, enq) => climb(3, context, event.mult, enq) } },
    /** Intelligence Explosion (over 25x). The last one. */
    era4: { on: { DAY: ({ context, event }, enq) => climb(4, context, event.mult, enq) } },
  },
});

export type EraStored = Stored<typeof eraMachine>;

function climb(current: number, context: EraContext, mult: number, enq: Enq) {
  const peak = Math.max(context.peak, mult);
  const era = eraOf(peak);
  if (era > current) {
    enq.emit({ type: "ERA_REACHED", era });
    return { target: `era${era}` as "era1" | "era2" | "era3" | "era4", context: { peak } };
  }
  return peak === context.peak ? undefined : { context: { peak } };
}

/** The era number a stored machine is in. */
export const eraNumber = (stored: EraStored): number => Number(String(stored.value).slice(3));
