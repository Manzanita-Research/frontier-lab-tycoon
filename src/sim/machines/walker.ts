// A walker's inner life as a statechart. Only discrete changes reach it (arrived, stay over, time to pick the next
// stop, sent home); movement, timers, routes and the visit/step counters stay plain data on the walker, and nothing
// here runs per tick.
//
//   heading --ARRIVED--> inside --LINGER--> loitering
//   heading | inside | loitering | wandering --NEXT--> choosing --CHOSE_BUILDING--> heading
//                                                               --CHOSE_WANDER---> wandering
//   heading | inside | loitering | wandering --TOUR_DONE--> leaving --EXITED--> gone
//   wandering --PROTEST_STARTED--> picketing (protester) --SENT_HOME--> leaving
//
// Purely declarative on purpose: this is the one machine that runs hundreds of times a tick, and in XState v6 alpha a
// transition that contains a function (a context mapper or a `to`) costs about 20 us against 3-4 us for a plain
// `{ target }` (measured, see docs/ARCHITECTURE.md). So there are no functions here: the dice and facts a decision needs
// are folded into the choice of event by the driver (sim/walkers.ts), which rolls them in the original order, and the
// world work a state implies runs when the driver sees that state entered:
//   choosing  -> pick a building and route to it (or wander), then answer CHOSE_BUILDING / CHOSE_WANDER
//   loitering -> step out and stand near the door
//   leaving   -> route to the gate
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { WalkerKind } from "../types";
import type { Stored } from "./run";

export const walkerMachine = setupEffect({
  schemas: {
    context: Schema.Struct({}),
    input: Schema.Struct({}),
    events: {
      /** Reached the building they were heading for (it still exists). */
      ARRIVED: Schema.Struct({}),
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
  initial: "wandering",
  states: {
    /** Walking to a building. */
    heading: { on: { ARRIVED: { target: "inside" }, NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" } } },
    /** In a building until the stay is over. */
    inside: { on: { LINGER: { target: "loitering" }, NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" } } },
    /** Standing around outside the last building. */
    loitering: { on: { NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" } } },
    /** Ambling to a random path tile, or waiting there. */
    wandering: { on: { NEXT: { target: "choosing" }, TOUR_DONE: { target: "leaving" }, PROTEST_STARTED: { target: "picketing" } } },
    /** A stop is being picked; the driver answers in the same tick. */
    choosing: { on: { CHOSE_BUILDING: { target: "heading" }, CHOSE_WANDER: { target: "wandering" } } },
    /** Heading for the gate. */
    leaving: { on: { EXITED: { target: "gone" } } },
    /** A protester at their spot near the gate. */
    picketing: { on: { SENT_HOME: { target: "leaving" } } },
    /** Off the map. */
    gone: { type: "final" },
  },
});

export type WalkerStored = Stored<typeof walkerMachine>;
export type WalkerPhase = WalkerStored["value"];

/** A visitor tours a fixed number of buildings; when none are left, the next decision is to leave. */
export const tourDone = (kind: WalkerKind, visits: number) => kind === "visitor" && visits <= 0;
