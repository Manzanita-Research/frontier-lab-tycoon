// The app shell under @effect/vitest: real actor, real Sim service, frames pushed by hand, TestClock for the toasts.
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import { openEventOf } from "../sim/events";
import { createInitialState } from "../sim/state";
import { tick } from "../sim/tick";
import type { Speed } from "./hud";
import { appMachine } from "./machine";
import { framesManual, ManualFrames } from "./frames";
import { createSimHandle, Sim, simLayer, type SimHandle } from "./sim";

const handleFor = (seed = 1, warp = 0) => createSimHandle({ seed, warp, agents: 0, discourse: 0 });

/** Boot the app on `handle`, and hand back the actor and a frame pump. */
const boot = (speed: Speed = 1) =>
  Effect.gen(function* () {
    const sim = yield* Sim;
    const frames = yield* ManualFrames;
    const first = sim.report(true, true)!;
    const actor = yield* createEffectActor(appMachine, { input: { speed, first } });
    /** Push `n` frames of `dt` seconds and let the actor drain its mailbox. */
    const pump = (n: number, dt = 0.1) =>
      Effect.gen(function* () {
        for (let i = 0; i < n; i++) frames.emit(dt);
        for (let i = 0; i < 40 + n * 4; i++) yield* Effect.yieldNow;
      });
    return { actor, sim, pump };
  });

const provide = (handle: SimHandle) => Effect.provide(Layer.mergeAll(simLayer(handle), framesManual));

describe("app machine", () => {
  it.effect("starts in playing.running and advances the sim one tick per 0.1 s frame at 1x, like direct ticks", () => {
    const handle = handleFor(3);
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      expect(actor.getSnapshot().matches({ playing: "running" })).toBe(true);
      yield* pump(60);
      expect(sim.world.tick).toBe(60);
      const direct = createInitialState(3);
      for (let i = 0; i < 60; i++) tick(direct);
      expect(JSON.stringify(sim.world)).toBe(JSON.stringify(direct));
    }).pipe(provide(handle));
  });

  it.effect("runs 3x speed three ticks per frame and stops advancing when paused", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* send(actor, { type: "SET_SPEED", speed: 3 });
      yield* waitFor(actor, (s) => s.context.speed === 3, { timeout: "1 second" });
      yield* pump(10);
      expect(sim.world.tick).toBe(30);
      yield* send(actor, { type: "TOGGLE_PAUSE" });
      yield* waitFor(actor, (s) => s.matches({ playing: "paused" }), { timeout: "1 second" });
      yield* pump(10);
      expect(sim.world.tick).toBe(30);
      yield* send(actor, { type: "TOGGLE_PAUSE" });
      yield* waitFor(actor, (s) => s.matches({ playing: "running" }), { timeout: "1 second" });
    }).pipe(provide(handle));
  });

  it.effect("applies a queued command while paused without advancing time", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(0);
      yield* pump(1);
      expect(actor.getSnapshot().matches({ playing: "paused" })).toBe(true);
      const before = sim.world.buildings.length;
      yield* send(actor, { type: "COMMAND", command: { type: "placeBuilding", kind: "gateway", x: 7, z: 17 } });
      yield* pump(3);
      expect(sim.world.buildings.length).toBe(before + 1);
      expect(sim.world.tick).toBe(0);
      expect(actor.getSnapshot().context.snap.buildings.length).toBe(before + 1);
    }).pipe(provide(handle));
  });

  it.effect("opens the event card, holds time, forwards CHOOSE into the sim and resumes", () => {
    const handle = handleFor(1);
    handle.world.day = 59;
    handle.world.waterDiscourse = 44;
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* pump(30);
      yield* waitFor(actor, (s) => s.matches("eventOpen"), { timeout: "1 second" });
      expect(openEventOf(sim.world)?.id).toBe("waterDiscourse");
      const heldAt = sim.world.tick;
      yield* pump(5);
      expect(sim.world.tick).toBe(heldAt); // time stands still under the card
      yield* send(actor, { type: "CHOOSE", choiceIndex: 1 });
      yield* pump(2);
      yield* waitFor(actor, (s) => s.matches({ playing: "running" }), { timeout: "1 second" });
      expect(openEventOf(sim.world)).toBeNull();
      expect(sim.world.buildings.some((b) => b.kind === "fountain")).toBe(true);
      yield* pump(5);
      expect(sim.world.tick).toBeGreaterThan(heldAt);
    }).pipe(provide(handle));
  });

  it.effect("shows the outcome card on a loss, holds until a new lab, and a new lab starts fresh", () => {
    const handle = handleFor(1);
    handle.world.day = 361;
    handle.world.tick = 361 * 20 - 1;
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* pump(3);
      yield* waitFor(actor, (s) => s.matches("gameOver"), { timeout: "1 second" });
      expect(actor.getSnapshot().context.outcome).toBe("lost");
      yield* send(actor, { type: "NEW_LAB" });
      yield* pump(3);
      yield* waitFor(actor, (s) => s.matches({ playing: "running" }), { timeout: "1 second" });
      expect(actor.getSnapshot().context.outcome).toBe("playing");
      expect(sim.world.day).toBeLessThan(2);
    }).pipe(provide(handle));
  });

  it.effect("keeps a toast for 5.2 s of test time, then drops it; dismissing early cancels the timer", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor } = yield* boot();
      yield* send(actor, { type: "TOAST", text: "Not enough cash", tone: "bad" });
      yield* send(actor, { type: "TOAST", text: "Needs a path next to it", tone: "bad" });
      yield* waitFor(actor, (s) => s.context.toasts.length === 2, { timeout: "1 second" });
      yield* TestClock.adjust("5 seconds");
      expect(actor.getSnapshot().context.toasts).toHaveLength(2);
      const first = actor.getSnapshot().context.toasts[0]!;
      yield* send(actor, { type: "DISMISS_TOAST", id: first.id });
      yield* waitFor(actor, (s) => s.context.toasts.length === 1, { timeout: "1 second" });
      yield* TestClock.adjust("1 second");
      yield* waitFor(actor, (s) => s.context.toasts.length === 0, { timeout: "1 second" });
    }).pipe(provide(handle));
  });

  it.effect("picks a tool, toggles it off on a second pick, and ignores a hover that has not moved", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor } = yield* boot();
      yield* send(actor, { type: "SET_TOOL", tool: "gateway" });
      yield* waitFor(actor, (s) => s.context.tool === "gateway", { timeout: "1 second" });
      yield* send(actor, { type: "SET_HOVER", hover: { x: 3, z: 4 } });
      yield* waitFor(actor, (s) => s.context.hover?.x === 3, { timeout: "1 second" });
      const snap = actor.getSnapshot();
      yield* send(actor, { type: "SET_HOVER", hover: { x: 3, z: 4 } });
      yield* send(actor, { type: "SET_TOOL", tool: "gateway" });
      yield* waitFor(actor, (s) => s.context.tool === null, { timeout: "1 second" });
      expect(snap.context.hover).toEqual({ x: 3, z: 4 });
      expect(actor.getSnapshot().context.hover).toBeNull();
    }).pipe(provide(handle));
  });
});
