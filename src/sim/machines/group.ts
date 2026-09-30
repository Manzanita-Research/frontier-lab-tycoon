// A visitor group's day out as a statechart (FLT-19): a small party comes in through the gate, tours a planned list of
// buildings, stands about each one for a while (the `inspect` dwell, or a longer one with a progress bar when they run
// their own evals there), and goes home. Generic: Evals Without Borders today, journalists or a committee tomorrow.
// Like the staff machine it is context-free: only discrete changes reach it, and the walking and the dwell countdown
// are the driver's (sim/groups.ts).
//
//   walking --ARRIVED--> inspecting --NEXT--> walking
//   walking --EVALS--> evaluating --NEXT--> walking
//   inspecting | evaluating | walking --HUDDLE--> huddling --HOME--> leaving   (FLT-56: they compare notes first)
//   inspecting | evaluating | walking --HOME--> leaving --EXITED--> gone
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { step, type Stored } from "./run";
import type { EventFromLogic } from "xstate";

export const groupMachine = setupEffect({
  schemas: {
    context: Schema.Struct({}),
    input: Schema.Struct({}),
    events: {
      /** The leader reached the stop's door. */
      ARRIVED: Schema.Struct({}),
      /** The leader reached the door of the stop where they run their own evals. */
      EVALS: Schema.Struct({}),
      /** The dwell is over and there is another stop. */
      NEXT: Schema.Struct({}),
      /** No more stops, and the kind confers before it goes (FLT-56): a huddle where they stand. */
      HUDDLE: Schema.Struct({}),
      /** No more stops (or the owner called it off): back to the gate. */
      HOME: Schema.Struct({}),
      /** Out through the gate. */
      EXITED: Schema.Struct({}),
    },
  },
}).createMachine({
  context: {},
  initial: "walking",
  states: {
    /** Single file along the paths to the next stop. */
    walking: { on: { ARRIVED: { target: "inspecting" }, EVALS: { target: "evaluating" }, HUDDLE: { target: "huddling" }, HOME: { target: "leaving" } } },
    /** Fanned out along the front of a building, writing things down. */
    inspecting: { on: { NEXT: { target: "walking" }, HUDDLE: { target: "huddling" }, HOME: { target: "leaving" } } },
    /** The same, with a progress bar: their evals, on your hardware. */
    evaluating: { on: { NEXT: { target: "walking" }, HUDDLE: { target: "huddling" }, HOME: { target: "leaving" } } },
    /** In a tight ring, facing in, comparing notes (FLT-56). */
    huddling: { on: { HOME: { target: "leaving" } } },
    leaving: { on: { EXITED: { target: "gone" } } },
    gone: { type: "final" },
  },
});

export type GroupStored = Stored<typeof groupMachine>;
export type GroupPhase = GroupStored["value"];

export const groupStart = (): GroupStored => ({ value: "walking", context: {} });

/** Send one event; no context and no effects, so this is just the next phase. */
export function stepGroup(stored: GroupStored, event: EventFromLogic<typeof groupMachine>): GroupStored {
  return step(groupMachine, { value: stored.value, context: {} }, event).stored;
}
