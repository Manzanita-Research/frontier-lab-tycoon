// FLT-81, the freeze: one throw inside the app actor ended it for good. The clock stopped, ▶ and Space did nothing,
// and Save hung on "Reading drive A:…", because XState settles an actor whose action rejects and drops every later
// send. These run the real actor, the real save desk and the player's input, with a sim that throws once.
import { it } from "@effect/vitest";
import { Effect, Layer, Queue, Stream } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { createEffectActor, send } from "@xstate/effect";
import { createActorAtoms } from "@xstate/effect/atom";
import { makeSaveStore, memoryStorage } from "../save";
import type { Command } from "../sim/commands";
import { createTestCampus, runDays } from "../sim/testkit";
import { appMachine } from "./machine";
import { Frames, framesManual, ManualFrames, type Frame } from "./frames";
import type { Speed } from "./hud";
import { makeSaveDesk, Saves, type SaveResult } from "./saves";
import { Sim, simLayer, SimHandle } from "./sim";
import { mayRestart, RESTART_LIMIT, RESTART_WINDOW_MS, watchActor } from "./watchdog";

/** A sim with one bug in it: the next command it applies while time stands still throws. */
class Glitchy extends SimHandle {
  armed = false;
  override applyNow(commands: readonly Command[]) {
    if (this.armed && commands.length > 0) {
      this.armed = false;
      throw new Error("a sim bug");
    }
    super.applyNow(commands);
  }
}

const setup = () => {
  const desk = makeSaveDesk(makeSaveStore(memoryStorage()), true);
  const saved: SaveResult[] = [];
  desk.subscribe((r) => saved.push(r));
  const world = createTestCampus(1);
  runDays(world, 3);
  const handle = new Glitchy(world);
  const layer = Layer.mergeAll(simLayer(handle), framesManual, Layer.succeed(Saves, desk));
  return { desk, saved, handle, layer };
};

/** Push `n` frames and give the actor (and the save's compression) real time to answer. */
const pump = (n: number) =>
  Effect.gen(function* () {
    const frames = yield* ManualFrames;
    for (let i = 0; i < n; i++) {
      frames.emit(0.05);
      yield* Effect.sleep("2 millis");
    }
  });

describe("the freeze (FLT-81)", () => {
  it.live("pause, then Start → Run…, type, Enter: a sim bug on the way leaves the game taking input", () => {
    const { saved, handle, layer } = setup();
    const errors: unknown[][] = [];
    const quiet = vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args));
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 1, first: sim.report(true, true)! } });
      yield* pump(5);
      // Pause.
      yield* send(actor, { type: "TOGGLE_PAUSE" });
      yield* pump(3);
      expect(actor.getSnapshot().context.speed).toBe(0);
      // Start → Run…, type "finance.xls", Enter: what the taskbar and the window click send the app.
      handle.armed = true;
      yield* send(actor, { type: "SET_OVERLAY", id: "start", open: true });
      yield* send(actor, { type: "COMMAND", command: { type: "buildPanelOpened" } });
      yield* send(actor, { type: "COMMAND", command: { type: "coachClick" } });
      yield* send(actor, { type: "SET_OVERLAY", id: "start", open: false });
      yield* pump(3);
      yield* send(actor, { type: "COMMAND", command: { type: "coachClick" } });
      yield* send(actor, { type: "SET_OVERLAY", id: "finance", open: true });
      yield* pump(3);
      expect(handle.armed).toBe(false); // the bug went off

      // Still alive: ▶ unpauses, time moves, and Save answers.
      expect(actor.getSnapshot().status).toBe("active");
      yield* send(actor, { type: "TOGGLE_PAUSE" });
      const tick = sim.world.tick;
      yield* pump(10);
      expect(actor.getSnapshot().context.speed).toBe(1);
      expect(sim.world.tick).toBeGreaterThan(tick);
      yield* send(actor, { type: "SAVE", slot: "1", why: "manual" });
      for (let i = 0; i < 100 && saved.length === 0; i++) yield* pump(1);
      expect(saved.map((r) => [r.slot, r.why, r.error])).toEqual([["1", "manual", null]]);
      // ...and the bug was said out loud, with its stack, instead of swallowed.
      expect(errors.some((args) => args.some((a) => String(a).includes("a sim bug")))).toBe(true);
    }).pipe(
      Effect.ensuring(Effect.sync(() => quiet.mockRestore())),
      Effect.provide(layer),
    );
  });
});

describe("the watchdog (FLT-81)", () => {
  it("a throw inside a transition ends the actor: it says why and starts a new one on the same World", async () => {
    const { handle, desk } = setup();
    const queue = Effect.runSync(Queue.unbounded<Frame>());
    let now = 0;
    const frame = () => Queue.offerUnsafe(queue, { now: (now += 50), dt: 0.05 });
    const frames = Layer.succeed(Frames, Frames.of({ frames: Stream.fromQueue(queue) }));
    const runtime = Atom.runtime(Layer.mergeAll(simLayer(handle), frames, Layer.succeed(Saves, desk)));
    const input = { speed: 1 as Speed, first: handle.report(true, true)! };
    const app = createActorAtoms(runtime, appMachine, { input });
    const registry = AtomRegistry.make();
    const pump = async (n: number) => {
      for (let i = 0; i < n; i++) {
        frame();
        await new Promise((r) => setTimeout(r, 2));
      }
    };
    const status = () => {
      const r = registry.get(app.snapshot);
      return AsyncResult.isSuccess(r) ? r.value.status : "starting";
    };
    const context = () => {
      const r = registry.get(app.snapshot);
      return AsyncResult.isSuccess(r) ? r.value.context : null;
    };
    const logged: unknown[][] = [];
    const restarted: number[] = [];
    const unmount = registry.mount(app.actor);
    const unwatch = watchActor({
      registry,
      snapshot: app.snapshot,
      log: (...args) => void logged.push(args),
      restart: (last, error) => {
        restarted.push(handle.world.tick);
        input.speed = last.speed;
        input.first = handle.report(true, true)!;
        registry.refresh(app.actor);
        // As game.ts does (FLT-84): the new actor raises the recovery toast.
        registry.set(app.send, { type: "SNAG", report: String(error), now: 1 });
      },
    });
    try {
      await pump(5);
      registry.set(app.send, { type: "SET_SPEED", speed: 3 });
      await pump(5);
      expect(status()).toBe("active");
      const tick = handle.world.tick;
      const day = handle.world.day;

      // A report the machine can't read: its SYNCED transition throws, and XState ends the actor.
      registry.set(app.send, { type: "SYNCED", report: {} as never, now: 0 });
      await pump(3);

      expect(restarted).toHaveLength(1);
      expect(logged[0]?.[0]).toMatch(/restarting it on the same World/);
      expect(status()).toBe("active");
      // The same lab, at the speed the player had, taking input again.
      expect(handle.world.day).toBeGreaterThanOrEqual(day);
      expect(context()?.speed).toBe(3);
      // ...and says so, once (FLT-84).
      expect(context()?.toasts.filter((t) => t.snag)).toHaveLength(1);
      registry.set(app.send, { type: "TOGGLE_PAUSE" });
      await pump(3);
      expect(context()?.speed).toBe(0);
      registry.set(app.send, { type: "TOGGLE_PAUSE" });
      await pump(5);
      expect(handle.world.tick).toBeGreaterThan(tick);
    } finally {
      unwatch();
      unmount();
      registry.dispose();
    }
  });

  it("gives up after a few restarts a minute, and says so once", () => {
    const restarts: number[] = [];
    for (let i = 0; i < RESTART_LIMIT; i++) {
      expect(mayRestart(restarts, 1000 + i)).toBe(true);
      restarts.push(1000 + i);
    }
    expect(mayRestart(restarts, 2000)).toBe(false);
    expect(mayRestart(restarts, 1000 + RESTART_WINDOW_MS)).toBe(true);
  });
});

describe("the save desk (FLT-81)", () => {
  it.live("a save that crashes still answers, so the Save window never waits for ever", () =>
    Effect.gen(function* () {
      const store = makeSaveStore(memoryStorage());
      const desk = makeSaveDesk({ ...store, write: () => Effect.sync(() => { throw new Error("the drive caught fire"); }) }, true);
      const saved: SaveResult[] = [];
      desk.subscribe((r) => saved.push(r));
      const toasts: string[] = [];
      yield* desk.save(createTestCampus(1), "1", "manual", (text) => void toasts.push(text));
      expect(saved.map((r) => [r.slot, r.error?.reason])).toEqual([["1", "storage"]]);
      expect(toasts[0]).toMatch(/couldn't be written: the drive caught fire/);
    }),
  );
});
