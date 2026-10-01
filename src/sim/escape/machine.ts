// One agent's try at the fence (FLT-59) as a statechart. Like the walker machine it is context-free and declarative:
// timers, the route and the dice live on the Runner (./state.ts), and the driver (./driver.ts) folds every decision
// into the choice of event, so a transition depends on nothing but the phase and the event type.
//
//   brooding (thinks about the fence) --PACE--> pacing (walks the fence line) --BOLT--> running --CLEARED--> escaped
//                                     --COOLED--> calm (a Sandbox brought its drift down)
//   pacing | running --GRABBED--> carried (the player's hand) --DROPPED--> caught
//   running --TACKLED--> tackled (a guard got there) --RECOVERED--> caught
//   running --TRAPPED--> trapped (the Honeypot's "EXIT (real)") --RECOVERED--> caught
//   (anything but the ends) --LOST--> gone (the walker left the World some other way)
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import type { EventFromLogic } from "xstate";
import { step, type Stored } from "../machines/run";

export const runnerMachine = setupEffect({
  schemas: {
    context: Schema.Struct({}),
    input: Schema.Struct({}),
    events: {
      /** Brooded long enough: off to the fence to pace it. */
      PACE: Schema.Struct({}),
      /** Drift fell back under the line before it did anything about it. */
      COOLED: Schema.Struct({}),
      /** The pacing timer ran out: it goes. */
      BOLT: Schema.Struct({}),
      /** The player picked it up (`catchAgent`). */
      GRABBED: Schema.Struct({}),
      /** Put down in the sandbox. */
      DROPPED: Schema.Struct({}),
      /** A security guard got within reach. */
      TACKLED: Schema.Struct({}),
      /** It reached the Honeypot: a dead end with a sign. */
      TRAPPED: Schema.Struct({}),
      /** Back on its feet after a tackle or the Honeypot, and marched back inside. */
      RECOVERED: Schema.Struct({}),
      /** Over the fence. */
      CLEARED: Schema.Struct({}),
      /** The walker is no longer in the World. */
      LOST: Schema.Struct({}),
    },
  },
}).createMachine({
  context: {},
  initial: "brooding",
  states: {
    brooding: { on: { PACE: { target: "pacing" }, COOLED: { target: "calm" }, LOST: { target: "gone" } } },
    pacing: { on: { BOLT: { target: "running" }, GRABBED: { target: "carried" }, LOST: { target: "gone" } } },
    running: { on: { GRABBED: { target: "carried" }, TACKLED: { target: "tackled" }, TRAPPED: { target: "trapped" }, CLEARED: { target: "escaped" }, LOST: { target: "gone" } } },
    carried: { on: { DROPPED: { target: "caught" }, LOST: { target: "gone" } } },
    tackled: { on: { RECOVERED: { target: "caught" }, LOST: { target: "gone" } } },
    trapped: { on: { RECOVERED: { target: "caught" }, LOST: { target: "gone" } } },
    calm: { type: "final" },
    caught: { type: "final" },
    escaped: { type: "final" },
    gone: { type: "final" },
  },
});

export type RunnerStored = Stored<typeof runnerMachine>;
export type RunnerPhase = RunnerStored["value"];
export type RunnerEvent = EventFromLogic<typeof runnerMachine>;

/** The phases a runner is done in: the driver drops it from the list. */
export const isOver = (phase: RunnerPhase) => phase === "calm" || phase === "caught" || phase === "escaped" || phase === "gone";
/** The phases the chase is on in: the game slows to 1x and the camera follows. */
export const isChase = (phase: RunnerPhase) => phase === "running" || phase === "carried" || phase === "tackled" || phase === "trapped";

export const stepRunner = (stored: RunnerStored, event: RunnerEvent): RunnerStored => step(runnerMachine, stored, event).stored;
