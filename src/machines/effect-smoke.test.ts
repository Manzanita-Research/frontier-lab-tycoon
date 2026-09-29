// Canary for the alpha stack (xstate 6 alpha, @xstate/effect alpha, effect 4 rc): if a pin moves and this breaks,
// the port's assumptions broke with it. Covers the three ways the game uses machines.
import { Context, Effect, Schema } from "effect";
import { createEffectActor, fromEffect, send, setupEffect, waitFor } from "@xstate/effect";
import { initialTransition, transition } from "xstate";

class Greeter extends Context.Service<Greeter, { readonly greet: (who: string) => Effect.Effect<string> }>()("@flt/Greeter") {}

const greet = fromEffect({
  schemas: { input: Schema.Struct({ who: Schema.String }) },
  effect: ({ input }) => Greeter.use((g) => g.greet(input.who)),
});

const helloMachine = setupEffect({
  schemas: { input: Schema.Struct({ who: Schema.String }) },
  actors: { greet },
}).createMachine({
  context: ({ input }) => ({ who: input.who, message: "" }),
  initial: "idle",
  states: {
    idle: { on: { GO: { target: "greeting" } } },
    greeting: {
      invoke: {
        src: "greet",
        input: ({ context }) => ({ who: context.who }),
        onDone: ({ context, event }) => ({ target: "done", context: { ...context, message: event.output } }),
      },
    },
    done: { type: "final" },
  },
});

describe("alpha stack canary", () => {
  it("runs a setupEffect machine under createEffectActor with a Context.Service", async () => {
    const program = Effect.gen(function* () {
      const actor = yield* createEffectActor(helloMachine, { input: { who: "lab" } });
      yield* send(actor, { type: "GO" });
      const snap = yield* waitFor(actor, (s) => s.matches("done"), { timeout: "5 seconds" });
      return snap.context.message;
    });
    const out = await Effect.runPromise(
      program.pipe(Effect.scoped, Effect.provideService(Greeter, { greet: (who) => Effect.succeed(`hello ${who}`) })),
    );
    expect(out).toBe("hello lab");
  });

  it("advances a machine with the pure transition() from a JSON-persisted { value, context }", () => {
    const [s0] = initialTransition(helloMachine, { who: "lab" });
    expect(s0.value).toBe("idle");
    // The sim keeps only `{ value, context }` per machine in the World and rebuilds a live snapshot with
    // resolveState (about 4x cheaper than getPersistedSnapshot/restoreSnapshot, measured in the FLT-3 PR).
    const stored = JSON.parse(JSON.stringify({ value: s0.value, context: s0.context }));
    const [s1] = transition(helloMachine, helloMachine.resolveState(stored), { type: "GO" });
    expect(s1.value).toBe("greeting");
    expect(s1.context).toEqual({ who: "lab", message: "" });
  });
});
