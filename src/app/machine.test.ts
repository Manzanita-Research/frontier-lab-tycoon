// The app shell under @effect/vitest: real actor, real Sim service, frames pushed by hand, TestClock for the toasts.
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import { SCENARIO } from "../content/goals";
import { openEventOf } from "../sim/events";
import { createInitialState } from "../sim/state";
import { tick } from "../sim/tick";
import { createTestCampus, readyForPressure } from "../sim/testkit";
import type { Speed } from "./hud";
import { appMachine } from "./machine";
import { framesManual, ManualFrames } from "./frames";
import { Sim, simLayer, SimHandle } from "./sim";

const handleFor = (seed = 1) => new SimHandle(createTestCampus(seed));

/** Boot the app on `handle`, and hand back the actor and a frame pump. */
const boot = (speed: Speed = 1) =>
  Effect.gen(function* () {
    const sim = yield* Sim;
    const frames = yield* ManualFrames;
    const first = sim.report(true, true)!;
    const actor = yield* createEffectActor(appMachine, { input: { speed, first } });
    /** Push `n` frames of `dt` seconds and let the actor drain its mailbox. */
    const pump = (n: number, dt = 0.15) =>
      Effect.gen(function* () {
        for (let i = 0; i < n; i++) frames.emit(dt);
        for (let i = 0; i < 40 + n * 4; i++) yield* Effect.yieldNow;
      });
    return { actor, sim, pump };
  });

const provide = (handle: SimHandle) => Effect.provide(Layer.mergeAll(simLayer(handle), framesManual));

describe("app machine", () => {
  it.effect("opens paused at 1×, then the first build click starts time and coach marks never hold it", () => {
    const handle = new SimHandle(createInitialState(1));
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* pump(40);
      expect(actor.getSnapshot().matches({ playing: "paused" })).toBe(true);
      expect(actor.getSnapshot().context.speed).toBe(1);
      expect(sim.world.tick).toBe(0);
      yield* send(actor, { type: "COMMAND", command: { type: "buildPanelOpened" } });
      yield* pump(20);
      expect(sim.world.tick).toBeGreaterThan(0);
      expect(actor.getSnapshot().context.snap.coach?.id).toBe("path");
      const before = sim.world.tick;
      yield* send(actor, { type: "SET_OVERLAY", id: "build", open: true });
      yield* send(actor, { type: "SELECT", id: sim.world.walkers[0]!.id });
      yield* pump(120);
      expect(sim.world.tick - before).toBeGreaterThanOrEqual(60);
      const replayAt = sim.world.tick;
      yield* send(actor, { type: "COMMAND", command: { type: "coachReplay" } });
      yield* pump(10);
      expect(sim.world.tick).toBeGreaterThan(replayAt);
      yield* send(actor, { type: "SET_SPEED", speed: 0 });
      yield* pump(4);
      const held = sim.world.tick;
      yield* send(actor, { type: "COMMAND", command: { type: "coachReplay" } });
      yield* pump(10);
      expect(sim.world.tick).toBe(held);
    }).pipe(provide(handle));
  });

  it.effect("menus and inspection keep time running, while the player's pause persists", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(3);
      yield* send(actor, { type: "SET_OVERLAY", id: "staff", open: true });
      yield* send(actor, { type: "SET_OVERLAY", id: "thoughts", open: true });
      yield* pump(20);
      expect(sim.world.tick).toBeGreaterThan(0);
      yield* send(actor, { type: "COMMAND", command: { type: "hire", job: "sre" } });
      yield* pump(10);
      expect(sim.world.staff).toHaveLength(1);
      expect(actor.getSnapshot().context.speed).toBe(3);
      yield* send(actor, { type: "SET_SPEED", speed: 0 });
      yield* send(actor, { type: "SET_OVERLAY", id: "staff", open: false });
      yield* pump(10);
      expect(actor.getSnapshot().matches({ playing: "paused" })).toBe(true);
    }).pipe(provide(handle));
  });
  it.effect("starts in playing.running and advances the sim one tick per two 0.15 s frame at 1x, like direct ticks", () => {
    const handle = handleFor(3);
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      expect(actor.getSnapshot().matches({ playing: "running" })).toBe(true);
      yield* pump(120);
      expect(sim.world.tick).toBe(60);
      const direct = createTestCampus(3);
      for (let i = 0; i < 60; i++) tick(direct);
      expect(JSON.stringify(sim.world)).toBe(JSON.stringify(direct));
    }).pipe(provide(handle));
  });

  it.effect("a spending proposal pauses at the chosen speed, then cancellation resumes without a catch-up bill", () => {
    const handle = new SimHandle(createInitialState(1));
    handle.world.cash = 100_000;
    handle.applyNow([{ type: "skipTutorial" }]);
    delete handle.world.progression; delete handle.world.coach;
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(3);
      yield* pump(1); // let the manual frame stream subscribe before queuing the proposal
      yield* send(actor, { type: "COMMAND", command: { type: "hire", job: "sre" } });
      yield* pump(4);
      expect(actor.getSnapshot().context.snap.pendingConfirm?.kind).toBe("hire");
      const heldAt = sim.world.tick;
      const cash = sim.world.cash;
      yield* pump(80);
      expect(sim.world.tick).toBe(heldAt);
      expect(sim.world.cash).toBe(cash);
      expect(sim.world.staff).toHaveLength(0);
      expect(actor.getSnapshot().context.speed).toBe(3);
      yield* send(actor, { type: "COMMAND", command: { type: "cancelConfirm" } });
      yield* pump(4);
      expect(actor.getSnapshot().context.snap.pendingConfirm).toBeNull();
      expect(sim.world.tick - heldAt).toBeGreaterThan(0);
      expect(sim.world.tick - heldAt).toBeLessThanOrEqual(6);
      expect(actor.getSnapshot().context.speed).toBe(3);
    }).pipe(provide(handle));
  });

  it.effect("runs 3x speed three ticks per frame and stops advancing when paused", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* send(actor, { type: "SET_SPEED", speed: 3 });
      yield* waitFor(actor, (s) => s.context.speed === 3, { timeout: "1 second" });
      yield* pump(20);
      expect(sim.world.tick).toBe(30);
      yield* send(actor, { type: "TOGGLE_PAUSE" });
      yield* waitFor(actor, (s) => s.matches({ playing: "paused" }), { timeout: "1 second" });
      yield* pump(20);
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
    readyForPressure(handle.world);
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* pump(50);
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
    handle.world.day = SCENARIO.deadlineDay + 1;
    handle.world.tick = (SCENARIO.deadlineDay + 1) * 20 - 1;
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot();
      yield* pump(3);
      yield* waitFor(actor, (s) => s.matches("gameOver"), { timeout: "1 second" });
      expect(actor.getSnapshot().context.outcome).toBe("lost");
      yield* send(actor, { type: "NEW_LAB" });
      yield* pump(3);
      yield* waitFor(actor, (s) => s.matches({ playing: "paused" }), { timeout: "1 second" });
      expect(actor.getSnapshot().context.speed).toBe(1);
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

  it.effect("selects a walker: the snapshot carries their card, Follow and Thoughts highlight come through, and closing clears it", () => {
    const handle = handleFor(2);
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(0);
      const w = sim.world.walkers.find((o) => o.kind === "researcher")!;
      yield* send(actor, { type: "SELECT", id: w.id });
      yield* waitFor(actor, (st) => st.context.selected === w.id, { timeout: "1 second" });
      yield* pump(4);
      const snap = actor.getSnapshot().context.snap;
      expect(snap.inspect?.id).toBe(w.id);
      expect(snap.inspect?.name).toBe(w.name);
      expect(snap.inspect?.needs.map((n) => n.key)).toEqual(["energy", "focus", "fomo"]);
      expect(snap.inspect?.history).toHaveLength(3);
      expect(sim.ui.selected).toBe(w.id);
      expect(snap.board.length).toBeGreaterThan(0);

      yield* send(actor, { type: "SET_FOLLOW", follow: true });
      yield* waitFor(actor, (st) => st.context.follow, { timeout: "1 second" });
      yield* pump(4);
      expect(sim.ui.follow).toBe(true);
      const top = snap.board[0]!;
      yield* send(actor, { type: "HIGHLIGHT", key: top.key });
      yield* waitFor(actor, (st) => st.context.highlight === top.key, { timeout: "1 second" });
      yield* pump(4);
      expect(sim.highlightIds.size).toBe(top.count);
      yield* send(actor, { type: "HIGHLIGHT", key: top.key }); // the same row again switches it off
      yield* waitFor(actor, (st) => st.context.highlight === null, { timeout: "1 second" });
      yield* pump(4);
      expect(sim.highlightIds.size).toBe(0);

      yield* send(actor, { type: "SELECT", id: null });
      yield* waitFor(actor, (st) => st.context.selected === null, { timeout: "1 second" });
      yield* pump(4);
      expect(actor.getSnapshot().context.snap.inspect).toBeNull();
      expect(sim.ui.follow).toBe(false);
    }).pipe(provide(handle));
  });

  it.effect("closes the card by itself when the selected walker leaves the map", () => {
    const handle = handleFor(2);
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(0);
      const w = sim.world.walkers.find((o) => o.kind === "visitor")!;
      yield* send(actor, { type: "SELECT", id: w.id });
      yield* waitFor(actor, (st) => st.context.selected === w.id, { timeout: "1 second" });
      yield* pump(4);
      expect(actor.getSnapshot().context.selected).toBe(w.id);
      sim.world.walkers = sim.world.walkers.filter((o) => o.id !== w.id);
      yield* pump(4);
      expect(actor.getSnapshot().context.selected).toBeNull();
      expect(actor.getSnapshot().context.follow).toBe(false);
    }).pipe(provide(handle));
  });

  it.effect("hires through a COMMAND, shows the new staffer in the HUD snapshot, and paints their zone until they are let go", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(0);
      yield* pump(1);
      yield* send(actor, { type: "COMMAND", command: { type: "hire", job: "janitor" } });
      yield* pump(6);
      const ops = () => actor.getSnapshot().context.snap.ops;
      expect(ops().staff).toHaveLength(1);
      expect(ops().payroll).toBe(2_000);
      expect(ops().jobs.find((j) => j.job === "janitor")!.count).toBe(1);
      const id = ops().staff[0]!.id;

      // Painting mode: SET_ZONE picks the staffer, drops the build tool, and a second SET_ZONE for the same one stops it.
      yield* send(actor, { type: "SET_TOOL", tool: "path" });
      yield* send(actor, { type: "SET_ZONE", id });
      yield* waitFor(actor, (st) => st.context.zone === id, { timeout: "1 second" });
      expect(actor.getSnapshot().context.tool).toBeNull();
      yield* send(actor, { type: "COMMAND", command: { type: "paintZone", id, x: 8, z: 16, on: true } });
      yield* pump(6);
      expect(sim.world.staff[0]!.zone).toHaveLength(1);
      expect(ops().staff[0]!.zone).toBe(1);
      yield* send(actor, { type: "SET_TOOL", tool: "cluster" }); // picking a build tool leaves zone mode
      yield* waitFor(actor, (st) => st.context.zone === null, { timeout: "1 second" });

      // Fire them while their zone is being painted: the mode ends by itself once they are gone.
      yield* send(actor, { type: "SET_ZONE", id });
      yield* waitFor(actor, (st) => st.context.zone === id, { timeout: "1 second" });
      sim.world.staff = [];
      yield* pump(4);
      expect(actor.getSnapshot().context.zone).toBeNull();
    }).pipe(provide(handle));
  });

  it.effect("a toast that says the same thing again replaces the older one instead of stacking", () => {
    const handle = handleFor();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot(0);
      sim.world.toasts.push({ id: 900, text: "Frontier-2 is out! Build an API Gateway to sell it.", tone: "good" });
      yield* pump(6);
      sim.world.toasts.push({ id: 901, text: "Frontier-2 is out! Build an API Gateway to sell it.", tone: "good" });
      yield* pump(6);
      const texts = actor.getSnapshot().context.toasts.map((t) => t.text);
      expect(texts.filter((t) => t.startsWith("Frontier-2 is out"))).toHaveLength(1);
    }).pipe(provide(handle));
  });
});
