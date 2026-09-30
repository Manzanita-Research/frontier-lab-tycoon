// A walker's life as a statechart. Only discrete changes reach it (arrived, room or no room, stay over, time to pick
// the next stop, quit); movement, timers, routes and the visit/step counters stay plain data on the walker, and
// nothing here runs per tick. How the walker feels is a second machine (machines/mood.ts).
//
//   arriving | seeking --ARRIVED--> inside --LINGER--> loitering
//   arriving | seeking --QUEUED--> queuing --ADMITTED--> inside
//                                         --GAVE_UP---> choosing
//   arriving | seeking | queuing | inside | loitering | wandering --NEXT--> choosing --CHOSE_BUILDING--> seeking
//                                                                                    --CHOSE_WANDER---> wandering
//   (anywhere on foot or inside) --TOUR_DONE--> leaving --EXITED--> gone
//   (anywhere on foot or inside) --QUIT--> quitting (walks out the gate with a box) --EXITED--> gone
//   arriving | wandering --PROTEST_STARTED--> picketing (protester) --SENT_HOME--> leaving
//
// The need a walker is seeking (`seeking(need)`) is `Walker.need`: the state says they are on their way, the need says
// what for. Purely declarative on purpose: this is the one machine that runs hundreds of times a tick, and in XState v6
// alpha a transition that contains a function (a context mapper or a `to`) costs about 20 us against 3-4 us for a plain
// `{ target }` (measured, see docs/ARCHITECTURE.md). So there are no functions here: the dice and facts a decision needs
// are folded into the choice of event by the driver (sim/walkers.ts), and the world work a state implies runs when the
// driver sees that state entered:
//   choosing  -> score the buildings for the most urgent need and route to one (or wander), then answer CHOSE_*
//   loitering -> step out and stand near the door
//   leaving | quitting -> route to the gate
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { WalkerKind } from "../types";
import { step, type Stored } from "./run";
import type { EventFromLogic } from "xstate";

export const walkerMachine = setupEffect({
  schemas: {
    context: Schema.Struct({}),
    input: Schema.Struct({}),
    events: {
      /** Reached the building they were heading for (it still exists). */
      ARRIVED: Schema.Struct({}),
      /** Reached the building but it is full: join the queue at the door. */
      QUEUED: Schema.Struct({}),
      /** A spot opened up for the walker at the front of the queue. */
      ADMITTED: Schema.Struct({}),
      /** Patience ran out in the queue. */
      GAVE_UP: Schema.Struct({}),
      /** A researcher has had enough: box, gate, headline. */
      QUIT: Schema.Struct({}),
      /** The stay is over and the die said: hang around outside for a bit. */
      LINGER: Schema.Struct({}),
      /** Time to pick the next stop: a timer ran out, the target vanished, or the paths changed under them. */
      NEXT: Schema.Struct({}),
      /** Same moment, but a visitor's tour is done (see `tourDone`): head for the gate. */
      TOUR_DONE: Schema.Struct({}),
      /** The driver found a building and routed to it. */
      CHOSE_BUILDING: Schema.Struct({}),
      /** Nowhere to go: the driver sent them to amble to a random path tile. */
      CHOSE_WANDER: Schema.Struct({}),
      /** A protester has come to picket the gate. */
      PROTEST_STARTED: Schema.Struct({}),
      /** A protester's spot is no longer wanted: off to the gate. */
      SENT_HOME: Schema.Struct({}),
      /** Reached the gate on the way out. */
      EXITED: Schema.Struct({}),
    },
  },
}).createMachine({
  context: {},
  initial: "arriving",
  states: {
    /** Just turned up (through the gate, or at the start of the game) and on the way to a first stop. */
    arriving: { on: { ARRIVED: { target: "inside" }, QUEUED: { target: "queuing" }, NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, QUIT: { target: "quitting" }, PROTEST_STARTED: { target: "picketing" } } },
    /** Walking to a building for a need (or the day job). */
    seeking: { on: { ARRIVED: { target: "inside" }, QUEUED: { target: "queuing" }, NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, QUIT: { target: "quitting" } } },
    /** At a full building's door, waiting for a spot until patience runs out. */
    queuing: { on: { ADMITTED: { target: "inside" }, GAVE_UP: { target: "choosing" }, NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, QUIT: { target: "quitting" } } },
    /** In a building until the stay is over. */
    inside: { on: { LINGER: { target: "loitering" }, NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, QUIT: { target: "quitting" } } },
    /** Standing around outside the last building. */
    loitering: { on: { NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, QUIT: { target: "quitting" } } },
    /** Ambling to a random path tile, or waiting there. */
    wandering: { on: { NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, QUIT: { target: "quitting" }, PROTEST_STARTED: { target: "picketing" } } },
    /** A stop is being picked; the driver answers in the same tick. */
    choosing: { on: { CHOSE_BUILDING: { target: "seeking" }, CHOSE_WANDER: { target: "wandering" } } },
    /** Heading for the gate. */
    leaving: { on: { EXITED: { target: "gone" } } },
    /** Heading for the gate for good, carrying a box. */
    quitting: { on: { EXITED: { target: "gone" } } },
    /** A protester at their spot near the gate. */
    picketing: { on: { SENT_HOME: { target: "leaving" } } },
    /** Off the map. */
    gone: { type: "final" },
  },
});

export type WalkerStored = Stored<typeof walkerMachine>;
export type WalkerPhase = WalkerStored["value"];

/** Patience below this and a visitor has had enough. */
export const LEAVE_PATIENCE = 0.06;

/** A visitor tours a fixed number of buildings; when none are left, or patience is gone, the next decision is to leave. */
export const tourDone = (kind: WalkerKind, visits: number, patience = 1) => kind === "visitor" && (visits <= 0 || patience < LEAVE_PATIENCE);

const memo = new Map<WalkerPhase, Map<string, WalkerPhase>>();

/**
 * `step(walkerMachine, ...)` for a machine with no context and no functions: what a transition does then depends on
 * nothing but the phase and the event type, so the answer is computed by XState once and remembered (there are about
 * 150 pairs). Same result as `step`, minus the ~10 us of rebuilding a snapshot every time; walkers change phase
 * dozens of times a tick, and this is what keeps the 800-walker budget. `machine.test.ts` checks every pair.
 */
export function stepWalker(stored: WalkerStored, event: EventFromLogic<typeof walkerMachine>): WalkerStored {
  let events = memo.get(stored.value);
  if (!events) { events = new Map(); memo.set(stored.value, events); }
  let next = events.get(event.type);
  if (next === undefined) {
    next = step(walkerMachine, { value: stored.value, context: {} }, event).stored.value;
    events.set(event.type, next);
  }
  return { value: next, context: {} };
}
