// One benchmark, from a fresh leaderboard column to a solved one:
//
//   live --SCORES (best passes the record)--> live, emits SOTA
//   live --SCORES (best at the ceiling)--> crowded --SCORES (best solved)--> saturated --DAY x N--> retired (final)
//
// Saturated means the leaderboard is declared solved: the driver introduces the harder successor and the old column stops
// counting for SOTA claims. Pure: the driver scores every lab from its capability and sends the resulting best.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { BenchmarkDef } from "../../../content/leapfrog";
import type { Stored } from "../../machines/run";

export const BenchContext = Schema.Struct({
  id: Schema.String,
  /** The best score anyone has posted (an Elo for the Elo benchmark), and who has it. */
  best: Schema.Number,
  holder: Schema.String,
  /** The day it joined the leaderboard. */
  introduced: Schema.Number,
  /** Best scores at which it is `crowded`, and `saturated`. Elo benchmarks use a ceiling nobody reaches. */
  crowdedAt: Schema.Number,
  solvedAt: Schema.Number,
  /** Days a solved column stays before it is retired. */
  retireAfter: Schema.Number,
  /** The day it was declared solved, or -1. */
  solvedDay: Schema.Number,
  /** How many SOTA claims it has seen. */
  claims: Schema.Number,
});
export type BenchContext = typeof BenchContext.Type;

type Emit =
  | { type: "SOTA"; id: string; lab: string; score: number; prev: number; prevHolder: string }
  | { type: "CROWDED"; id: string; lab: string; score: number }
  | { type: "SATURATED"; id: string; lab: string; score: number }
  | { type: "RETIRED"; id: string };
type Enq = { emit: (e: Emit) => void };

export const benchMachine = setupEffect({
  schemas: {
    context: BenchContext,
    input: BenchContext,
    events: {
      /** The leaderboard changed: the best score now, and who holds it. */
      SCORES: Schema.Struct({ best: Schema.Number, holder: Schema.String, day: Schema.Number }),
      DAY: Schema.Struct({ day: Schema.Number }),
    },
    emitted: {
      /** A new record. `prevHolder` may be the same lab beating its own score. */
      SOTA: Schema.Struct({ id: Schema.String, lab: Schema.String, score: Schema.Number, prev: Schema.Number, prevHolder: Schema.String }),
      CROWDED: Schema.Struct({ id: Schema.String, lab: Schema.String, score: Schema.Number }),
      /** Declared solved: the headline, the reactions and the harder replacement follow. */
      SATURATED: Schema.Struct({ id: Schema.String, lab: Schema.String, score: Schema.Number }),
      RETIRED: Schema.Struct({ id: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "live",
  states: {
    /** Anyone can claim the top of it. */
    live: { on: { SCORES: ({ context, event }, enq) => scored(context, event, enq) } },
    /** A photo finish at the ceiling. */
    crowded: { on: { SCORES: ({ context, event }, enq) => scored(context, event, enq) } },
    /** Solved. It no longer counts: no claim can be made on it. */
    saturated: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.day - context.solvedDay < context.retireAfter) return;
          enq.emit({ type: "RETIRED", id: context.id });
          return { target: "retired" };
        },
      },
    },
    /** Gone from the leaderboard. */
    retired: { type: "final" },
  },
});

export type BenchStored = Stored<typeof benchMachine>;

/**
 * The leaderboard re-read with nothing new on it (FLT-39): the same best, the same holder, below the solved line, and
 * already in the state that best puts it in. The machine would stay put and say nothing, so the driver can skip
 * `transition()`. Null when the machine has to decide.
 */
export function quietScores(stored: BenchStored, event: { best: number; holder: string }): BenchStored | null {
  const c = stored.context;
  if (event.best !== c.best || event.holder !== c.holder || !(event.best < c.solvedAt)) return null;
  if (stored.value === "crowded") return stored;
  return stored.value === "live" && event.best < c.crowdedAt ? stored : null;
}

/** A record needs to beat the old one by more than this (a rounding error is not a claim). */
const EPS = 0.04;

function scored(context: BenchContext, event: { best: number; holder: string; day: number }, enq: Enq) {
  const record = event.best > context.best + EPS;
  const sota = record ? 1 : 0;
  if (record) enq.emit({ type: "SOTA", id: context.id, lab: event.holder, score: event.best, prev: context.best, prevHolder: context.holder });
  const next: BenchContext = { ...context, best: event.best, holder: event.holder, claims: context.claims + sota };
  if (event.best >= context.solvedAt) {
    enq.emit({ type: "SATURATED", id: context.id, lab: event.holder, score: event.best });
    return { target: "saturated", context: { ...next, solvedDay: event.day } };
  }
  if (event.best >= context.crowdedAt) {
    // Only the first crossing is news.
    const crossing = context.best < context.crowdedAt;
    if (crossing) enq.emit({ type: "CROWDED", id: context.id, lab: event.holder, score: event.best });
    return { target: "crowded", context: next };
  }
  // A claim that was beaten or withdrawn can lower the best; the state only ratchets forward.
  return { context: next };
}

/** Score of a lab with `capability` (times its bias for this benchmark): 50 at `difficulty`, toward 100 as it grows. */
export function scoreFor(def: Pick<BenchmarkDef, "difficulty" | "kind">, slope: number, capability: number, bias: number, hype: number): number {
  const cap = Math.max(0.01, capability * bias);
  if (def.kind === "elo") return Math.round(1000 + 4 * cap + 1.5 * hype);
  return 100 / (1 + (def.difficulty / cap) ** slope);
}

export const isSolved = (stored: BenchStored): boolean => stored.value === "saturated" || stored.value === "retired";
/** Still on the leaderboard and can still be claimed. */
export const isOpen = (stored: BenchStored): boolean => stored.value === "live" || stored.value === "crowded";
