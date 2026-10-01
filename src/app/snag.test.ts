// FLT-84, the recovery toast: when the FLT-81 guard catches an error, the player hears about it once, with the details
// for a bug report, and never more than once a minute. These run the real actor with a sim that throws.
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { createEffectActor, send } from "@xstate/effect";
import type { Command } from "../sim/commands";
import { createTestCampus, runDays } from "../sim/testkit";
import { appMachine } from "./machine";
import { framesManual, ManualFrames } from "./frames";
import { Sim, simLayer, SimHandle } from "./sim";
import { maySnag, SNAG_EVERY_MS, SNAG_TEXT, snagDetails } from "./snag";

/** A sim with a bug in it: every command it applies while time stands still throws, `bugs` times. */
class Glitchy extends SimHandle {
  bugs = 0;
  override applyNow(commands: readonly Command[]) {
    if (this.bugs > 0 && commands.length > 0) {
      this.bugs--;
      throw new Error("the hall is on fire and so is this function");
    }
    super.applyNow(commands);
  }
}

const setup = () => {
  const world = createTestCampus(7);
  runDays(world, 2);
  const handle = new Glitchy(world);
  return { handle, layer: Layer.mergeAll(simLayer(handle), framesManual) };
};

const pump = (n: number) =>
  Effect.gen(function* () {
    const frames = yield* ManualFrames;
    for (let i = 0; i < n; i++) {
      frames.emit(0.05);
      yield* Effect.sleep("2 millis");
    }
  });

describe("the recovery toast (FLT-84)", () => {
  it.live("a caught action error raises exactly one toast, with the details to copy", () => {
    const { handle, layer } = setup();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 0, first: sim.report(true, true)! } });
      yield* pump(3);
      // Paused, a command on the way, and the sim throws on it: the `hold` action's guard catches it.
      handle.bugs = 1;
      yield* send(actor, { type: "COMMAND", command: { type: "coachClick" } });
      yield* pump(5);
      expect(handle.bugs).toBe(0);
      const snags = actor.getSnapshot().context.toasts.filter((t) => t.snag);
      expect(snags).toHaveLength(1);
      expect(snags[0]!.text).toBe(SNAG_TEXT);
      const report = snags[0]!.snag!;
      expect(report).toContain("error: the hall is on fire and so is this function");
      expect(report).toContain("caught by: hold");
      expect(report).toContain(`seed: ${sim.world.seed}`);
      expect(report).toMatch(/tick: \d+ \(day \d+\)/);
      expect(report).toMatch(/version: \S+/);
      expect(report).toMatch(/skin: \S+/);
      // The stack, so a bug report says where.
      expect(report).toMatch(/at .*Glitchy\.applyNow/);
      expect(actor.getSnapshot().status).toBe("active");
    }).pipe(
      Effect.ensuring(Effect.sync(() => quiet.mockRestore())),
      Effect.provide(layer),
    );
  });

  it.live("a bug that fires every frame still raises one toast, and the game keeps taking input", () => {
    const { handle, layer } = setup();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 0, first: sim.report(true, true)! } });
      handle.bugs = 10;
      for (let i = 0; i < 20; i++) {
        yield* send(actor, { type: "COMMAND", command: { type: "coachClick" } });
        yield* pump(1);
      }
      yield* pump(3);
      expect(handle.bugs).toBe(0);
      expect(actor.getSnapshot().context.toasts.filter((t) => t.snag)).toHaveLength(1);
      yield* send(actor, { type: "TOGGLE_PAUSE" });
      const tick = sim.world.tick;
      yield* pump(10);
      expect(sim.world.tick).toBeGreaterThan(tick);
    }).pipe(
      Effect.ensuring(Effect.sync(() => quiet.mockRestore())),
      Effect.provide(layer),
    );
  });

  it.live("at most one a minute, never stacked: a later snag replaces the one showing", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 0, first: sim.report(true, true)! } });
      const snags = () => actor.getSnapshot().context.toasts.filter((t) => t.snag);
      yield* send(actor, { type: "SNAG", report: "first", now: 1_000 });
      yield* send(actor, { type: "SNAG", report: "second", now: 30_000 });
      yield* send(actor, { type: "TOAST", text: "Training Hall down.", tone: "bad" });
      yield* pump(1);
      expect(snags().map((t) => t.snag)).toEqual(["first"]);
      yield* send(actor, { type: "SNAG", report: "third", now: 1_000 + SNAG_EVERY_MS });
      yield* pump(1);
      expect(snags().map((t) => t.snag)).toEqual(["third"]);
      // The other toasts are left alone.
      expect(actor.getSnapshot().context.toasts.some((t) => t.text === "Training Hall down.")).toBe(true);
    }).pipe(Effect.provide(layer));
  });

  it.live("a watchdog restart keeps the minute: the new actor starts with the dead one's snagAt", () => {
    const { layer } = setup();
    expect(maySnag(null, 0)).toBe(true);
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 1, first: sim.report(true, true)!, snagAt: 5_000 } });
      yield* send(actor, { type: "SNAG", report: "too soon", now: 5_000 + SNAG_EVERY_MS - 1 });
      yield* pump(1);
      expect(actor.getSnapshot().context.toasts.filter((t) => t.snag)).toHaveLength(0);
      yield* send(actor, { type: "SNAG", report: "a minute on", now: 5_000 + SNAG_EVERY_MS });
      yield* pump(1);
      expect(actor.getSnapshot().context.toasts.filter((t) => t.snag)).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it("the details read top to bottom: what, where, which build, then the stack", () => {
    const text = snagDetails({ where: "advance", message: "boom", stack: "Error: boom\n    at tick (tick.ts:1:1)", seed: 42, tick: 1234, day: 12 }, { version: "abc1234", skin: "frontier-95" });
    expect(text.split("\n")).toEqual([
      "Frontier Lab Tycoon: snag report",
      "error: boom",
      "caught by: advance",
      "seed: 42",
      "tick: 1234 (day 12)",
      "version: abc1234",
      "skin: frontier-95",
      "",
      "Error: boom",
      "    at tick (tick.ts:1:1)",
    ]);
  });
});
