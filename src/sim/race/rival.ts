// One rival lab: idle -> training -> releasing -> cooldown, stepped once a week.
//
//   idle --WEEK--> training --WEEK (run over)--> releasing --WEEK--> cooldown --WEEK--> idle
//
// A lab that ships every week (cadence 1) goes releasing -> releasing without stopping. Pure: no rng, no World.
// The driver (sim/race/race.ts) pre-rolls the dice and the model name into the WEEK event, in a fixed order, and
// applies what the machine emits (news, hype, a poach attempt) to the World.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { Stored } from "../machines/run";

export const PersonalitySchema = Schema.Struct({
  cadence: Schema.Number,
  growth: Schema.Number,
  openness: Schema.Number,
  poaching: Schema.Number,
  hypeHunger: Schema.Number,
});

export const RivalContext = Schema.Struct({
  id: Schema.String,
  personality: PersonalitySchema,
  capability: Schema.Number,
  hype: Schema.Number,
  /** Hype drifts back to this between launches. */
  baseHype: Schema.Number,
  /** Weeks left in training or cooldown. */
  weeks: Schema.Number,
  releases: Schema.Number,
  /** Was the latest release open weights? */
  open: Schema.Boolean,
  /** A fraction of normal growth: rough weeks knock it down, quiet weeks bring it back. */
  momentum: Schema.Number,
  /** The latest model, or "" if they have never shipped one. */
  model: Schema.String,
  /** The week of the latest release, or -1. */
  lastRelease: Schema.Number,
});
export type RivalContext = typeof RivalContext.Type;

/** Everything the machine may not roll for itself. */
const Week = Schema.Struct({
  week: Schema.Number,
  /** Era: multiplies what a release adds. */
  aggro: Schema.Number,
  /** Era: divides how many weeks a run takes. */
  pace: Schema.Number,
  /** The race stays close: labs behind the leader catch up faster, labs far ahead ease off. Around 1. */
  chase: Schema.Number,
  /** Uniform draws in [0, 1): run length, release size, open weights, poaching. */
  lengthRoll: Schema.Number,
  gainRoll: Schema.Number,
  openRoll: Schema.Number,
  poachRoll: Schema.Number,
  /** The name the next release would have. */
  name: Schema.String,
});
type WeekEvent = typeof Week.Type;

export const rivalMachine = setupEffect({
  schemas: {
    context: RivalContext,
    input: RivalContext,
    events: {
      WEEK: Week,
      /** Something happened to them: negative numbers hurt. Used by the player's cards and the auction. */
      SHOCK: Schema.Struct({ capability: Schema.Number, hype: Schema.Number, momentum: Schema.Number }),
    },
    emitted: {
      RELEASED: Schema.Struct({ id: Schema.String, model: Schema.String, gain: Schema.Number, open: Schema.Boolean, capability: Schema.Number }),
      POACH: Schema.Struct({ id: Schema.String }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "idle",
  on: {
    SHOCK: ({ context, event }) => ({ context: shocked(context, event) }),
  },
  states: {
    /** Between runs. The next week starts one. */
    idle: { on: { WEEK: (args, enq) => nextRun(args.context, args.event, enq) } },
    /** Burning compute. Ships when the weeks run out. */
    training: {
      on: {
        WEEK: (args, enq) => {
          const { context, event } = args;
          poachCheck(context, event, enq);
          const weeks = context.weeks - 1;
          if (weeks > 0) return { target: "training", context: settle({ ...context, weeks }, event.week) };
          return release(context, event, enq);
        },
      },
    },
    /** Launch week: the hype is up. Then a press tour, or straight back to work. */
    releasing: {
      on: {
        WEEK: (args, enq) => {
          const { context, event } = args;
          poachCheck(context, event, enq);
          if (context.personality.cadence >= 6) return { target: "cooldown", context: settle({ ...context, weeks: 1 }, event.week) };
          return nextRun(context, event, enq, false);
        },
      },
    },
    /** A press tour and a lie-down. */
    cooldown: {
      on: {
        WEEK: (args, enq) => {
          const { context, event } = args;
          poachCheck(context, event, enq);
          const weeks = context.weeks - 1;
          if (weeks > 0) return { target: "cooldown", context: settle({ ...context, weeks }, event.week) };
          return { target: "idle", context: settle({ ...context, weeks: 0 }, event.week) };
        },
      },
    },
  },
});

export type RivalStored = Stored<typeof rivalMachine>;

type Enq = {
  emit: (e: { type: "RELEASED"; id: string; model: string; gain: number; open: boolean; capability: number } | { type: "POACH"; id: string }) => void;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The quiet part of a week: hype drifts home, momentum recovers. */
function settle(context: RivalContext, _week: number): RivalContext {
  const drift = clamp(context.baseHype - context.hype, -2.5, 2.5);
  return { ...context, hype: context.hype + drift, momentum: Math.min(1, context.momentum + 0.05) };
}

function shocked(context: RivalContext, e: { capability: number; hype: number; momentum: number }): RivalContext {
  return {
    ...context,
    capability: Math.max(1, context.capability + e.capability),
    hype: clamp(context.hype + e.hype, 0, 100),
    momentum: clamp(context.momentum + e.momentum, 0.2, 1),
  };
}

function poachCheck(context: RivalContext, event: WeekEvent, enq: Enq) {
  if (event.poachRoll < Math.min(0.9, context.personality.poaching * event.aggro)) enq.emit({ type: "POACH", id: context.id });
}

/** How many weeks the next run takes: the cadence, jittered, sped up by the era. Never less than one. */
export function runWeeks(context: RivalContext, event: { lengthRoll: number; pace: number }): number {
  return Math.max(1, Math.round((context.personality.cadence * (0.75 + 0.5 * event.lengthRoll)) / event.pace));
}

/** Start a run. A run of one week ships at once (the every-week labs), otherwise the wait begins. */
function nextRun(context: RivalContext, event: WeekEvent, enq: Enq, poach = true) {
  if (poach) poachCheck(context, event, enq);
  const weeks = runWeeks(context, event);
  if (weeks <= 1) return release(context, event, enq);
  return { target: "training", context: settle({ ...context, weeks: weeks - 1 }, event.week) };
}

/** Open weights: labs in the middle flip-flop, so a lab that just went open is likelier to close up again. */
export function opensThisTime(context: RivalContext, roll: number): boolean {
  const p = context.personality.openness;
  if (p <= 0) return false;
  if (p >= 1) return true;
  return roll < clamp(context.open ? p * 0.6 : p * 1.3, 0, 1);
}

function release(context: RivalContext, event: WeekEvent, enq: Enq) {
  const gain = context.personality.growth * (0.6 + 0.8 * event.gainRoll) * event.aggro * event.chase * context.momentum;
  const open = opensThisTime(context, event.openRoll);
  const next: RivalContext = {
    ...context,
    capability: context.capability + gain,
    hype: clamp(context.hype + 9 * context.personality.hypeHunger, 0, 100),
    weeks: 0,
    releases: context.releases + 1,
    open,
    model: event.name || context.model,
    lastRelease: event.week,
  };
  enq.emit({ type: "RELEASED", id: context.id, model: event.name, gain, open, capability: next.capability });
  return { target: "releasing", context: next };
}
