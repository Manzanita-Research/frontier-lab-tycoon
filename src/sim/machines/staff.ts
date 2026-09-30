// A staffer's day as a statechart (FLT-10). Janitor Bots, SREs, Comms Reps and Security all share it: they turn up at
// the gate, stand about, and when the driver (sim/staff.ts) finds something to do, go and do it. Like the walker
// machine it is declarative and context-free: only discrete changes reach it (a task found, arrived, done, fired), and
// the world work each state implies (walking, mopping, fixing, handing out tote bags) is the driver's.
//
//   arriving --ARRIVED--> idle --TASK--> going --ARRIVED--> working --DONE--> idle
//   going | working --LOST--> idle            (the puddle was mopped by someone else, the protester wandered off, ...)
//   (anything but leaving) --FIRED--> leaving --EXITED--> gone
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { remembered, type Stored } from "./run";
import type { EventFromLogic } from "xstate";

export const staffMachine = setupEffect({
  schemas: {
    context: Schema.Struct({}),
    input: Schema.Struct({}),
    events: {
      /** Reached the spot they were walking to: the patrol start when they arrive, the task when they are going. */
      ARRIVED: Schema.Struct({}),
      /** The driver found something for an idle staffer to do and routed them to it. */
      TASK: Schema.Struct({}),
      /** The task is finished. */
      DONE: Schema.Struct({}),
      /** The task went away (already done by someone else, the target left, the path is gone): back to patrolling. */
      LOST: Schema.Struct({}),
      /** The player let them go. */
      FIRED: Schema.Struct({}),
      /** Reached the gate on the way out. */
      EXITED: Schema.Struct({}),
    },
  },
}).createMachine({
  context: {},
  initial: "arriving",
  states: {
    /** Walking in through the gate to the first spot of the shift. */
    arriving: { on: { ARRIVED: { target: "idle" }, FIRED: { target: "leaving" } } },
    /** Patrolling, or standing about, looking for work. */
    idle: { on: { TASK: { target: "going" }, FIRED: { target: "leaving" } } },
    /** On the way to a puddle, a fire, a protester. */
    going: { on: { ARRIVED: { target: "working" }, LOST: { target: "idle" }, FIRED: { target: "leaving" } } },
    /** Mopping, fixing, handing out a tote bag. */
    working: { on: { DONE: { target: "idle" }, LOST: { target: "idle" }, FIRED: { target: "leaving" } } },
    /** Let go: off to the gate with a box. */
    leaving: { on: { EXITED: { target: "gone" } } },
    gone: { type: "final" },
  },
});

export type StaffStored = Stored<typeof staffMachine>;
export type StaffPhase = StaffStored["value"];

export const staffStart = (): StaffStored => ({ value: "arriving", context: {} });

const remember = remembered(staffMachine);

/** Send one event; the machine has no context and no effects, so this is just the next phase (remembered: FLT-39). */
export function stepStaff(stored: StaffStored, event: EventFromLogic<typeof staffMachine>): StaffStored {
  return remember({ value: stored.value, context: {} }, event).stored;
}
