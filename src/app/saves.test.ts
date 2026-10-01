// FLT-65, the app's side of saving: the machine autosaves when the month turns and when the lab ends, a manual SAVE
// writes the slot it names, LOAD_LAB swaps a save's World in, and staged links never autosave.
// FLT-95: TO_BOX (Help ▸ "Take the box off the shelf again") saves before it leaves.
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { createEffectActor, send } from "@xstate/effect";
import { decodeSave, makeSaveStore, memoryStorage } from "../save";
import { TICKS_PER_DAY } from "../sim/constants";
import { createTestCampus, runDays } from "../sim/testkit";
import { tick } from "../sim/tick";
import { appMachine } from "./machine";
import { framesManual, ManualFrames } from "./frames";
import { isStagedLink, makeSaveDesk, Saves, welcomesYou, type SaveResult } from "./saves";
import { Sim, simLayer, SimHandle } from "./sim";
import { Door } from "./door";

/** A campus a few ticks before the calendar turns to its second month. */
function lateInMonth(seed = 1) {
  const s = createTestCampus(seed);
  runDays(s, 29);
  while (s.tick < 30 * TICKS_PER_DAY - 4) tick(s, []);
  return s;
}

const boot = Effect.gen(function* () {
  const sim = yield* Sim;
  const frames = yield* ManualFrames;
  const actor = yield* createEffectActor(appMachine, { input: { speed: 1, first: sim.report(true, true)! } });
  const pump = (n: number, dt = 0.15) =>
    Effect.gen(function* () {
      for (let i = 0; i < n; i++) frames.emit(dt);
      for (let i = 0; i < 40 + n * 4; i++) yield* Effect.yieldNow;
    });
  // Compression runs on real promises: give them a moment.
  const settle = Effect.promise(() => new Promise((r) => setTimeout(r, 30)));
  return { actor, sim, pump, settle };
});

function setup(autosave = true) {
  const storage = memoryStorage();
  const desk = makeSaveDesk(makeSaveStore(storage), autosave);
  const results: SaveResult[] = [];
  desk.subscribe((r) => results.push(r));
  const handle = new SimHandle(lateInMonth());
  const layer = Layer.mergeAll(simLayer(handle), framesManual, Layer.succeed(Saves, desk));
  return { storage, desk, results, handle, provide: Effect.provide(layer) };
}

describe("saving from the app (FLT-65)", () => {
  it.effect("autosaves once when the month turns, and the save plays on like the lab", () => {
    const t = setup();
    return Effect.gen(function* () {
      const { actor, sim, pump, settle } = yield* boot;
      yield* send(actor, { type: "SET_SPEED", speed: 1 });
      yield* pump(60);
      yield* settle;
      expect(sim.world.day).toBeGreaterThanOrEqual(30);
      expect(t.results.map((r) => [r.slot, r.why, r.error])).toEqual([["auto", "month", null]]);
      const { save, world } = yield* decodeSave(t.storage.map.get("flt.save.auto")!);
      // Saved as the month turned (the action runs a frame or so after the report that asked for it).
      expect(save.day).toBeGreaterThanOrEqual(30);
      expect(save.day).toBeLessThanOrEqual(sim.world.day);
      expect(world.labName).toBe(sim.world.labName);
    }).pipe(t.provide);
  });

  it.effect("SAVE writes the slot it names and says so", () => {
    const t = setup();
    return Effect.gen(function* () {
      const { actor, pump, settle } = yield* boot;
      yield* send(actor, { type: "SAVE", slot: "2", why: "manual" });
      yield* pump(2);
      yield* settle;
      yield* pump(2);
      expect(t.results.map((r) => [r.slot, r.why])).toEqual([["2", "manual"]]);
      expect(t.storage.map.has("flt.save.2")).toBe(true);
      expect(actor.getSnapshot().context.toasts.some((x) => /Saved ".+" to slot 2\./.test(x.text))).toBe(true);
    }).pipe(t.provide);
  });

  it.effect("LOAD_LAB puts a save's World in play, and the next ticks are that lab's", () => {
    const t = setup();
    return Effect.gen(function* () {
      const { actor, sim, pump } = yield* boot;
      const other = createTestCampus(9);
      runDays(other, 5);
      const at = other.tick;
      yield* send(actor, { type: "LOAD_LAB", world: other, def: null });
      yield* pump(1);
      expect(sim.world).toBe(other);
      yield* pump(20);
      expect(sim.world).toBe(other);
      expect(sim.loaded).toBe(other);
      expect(sim.world.tick).toBeGreaterThan(at);
      expect(actor.getSnapshot().context.snap.labName).toBe(other.labName);
      // Jumping to another lab's calendar is not a month ending: no autosave.
      expect(t.results).toEqual([]);
    }).pipe(t.provide);
  });

  it.effect("a staged link never autosaves, but still saves on request", () => {
    const t = setup(false);
    return Effect.gen(function* () {
      const { actor, pump, settle } = yield* boot;
      yield* send(actor, { type: "SET_SPEED", speed: 1 });
      yield* pump(60);
      yield* send(actor, { type: "SAVE", slot: "auto", why: "hide" });
      yield* send(actor, { type: "SAVE", slot: "1", why: "manual" });
      yield* pump(2);
      yield* settle;
      expect(t.results.map((r) => [r.slot, r.why])).toEqual([["1", "manual"]]);
    }).pipe(t.provide);
  });

  it.effect("while Welcome back is up, the fresh lab behind it can't take the autosave", () => {
    const t = setup();
    t.desk.held = true;
    return Effect.gen(function* () {
      const { actor, pump, settle } = yield* boot;
      yield* send(actor, { type: "SAVE", slot: "auto", why: "hide" });
      yield* pump(2);
      yield* settle;
      expect(t.results).toEqual([]);
    }).pipe(t.provide);
  });
});

describe("which links save and greet", () => {
  it("staged links don't autosave or say welcome back", () => {
    for (const q of ["?scenario=midgame", "?moment=ops", "?debug=1", "?autosave=off", "?ladder=3"]) {
      expect(isStagedLink(q)).toBe(true);
      expect(welcomesYou(q)).toBe(false);
    }
  });
  it("plain and seeded links do; ?load= and ?saves= don't greet", () => {
    for (const q of ["", "?seed=42", "?mod=/mods/x.json", "?skin=frontier-95"]) expect(welcomesYou(q)).toBe(true);
    expect(welcomesYou("?load=pending")).toBe(false);
    expect(welcomesYou("?saves=demo")).toBe(false);
    expect(isStagedLink("?seed=42")).toBe(false);
  });
});

describe("back to the box (FLT-95)", () => {
  it.effect("TO_BOX autosaves the lab first, then walks out through the Door", () => {
    const t = setup();
    const seen: Array<boolean> = [];
    const door = Layer.succeed(Door, { toBox: () => void seen.push(t.storage.map.has("flt.save.auto")) });
    return Effect.gen(function* () {
      const { actor, pump, settle } = yield* boot;
      yield* send(actor, { type: "TO_BOX" });
      yield* pump(2);
      yield* settle;
      yield* pump(2);
      expect(t.results.map((r) => [r.slot, r.why])).toEqual([["auto", "hide"]]);
      // The save is on disk before the page goes.
      expect(seen).toEqual([true]);
    }).pipe(Effect.provide(Layer.mergeAll(simLayer(t.handle), framesManual, Layer.succeed(Saves, t.desk), door)));
  });

  it.effect("a door that jams is a snag, not a dead app", () => {
    const t = setup();
    const door = Layer.succeed(Door, { toBox: () => { throw new Error("the shelf is locked"); } });
    return Effect.gen(function* () {
      const { actor, pump, settle } = yield* boot;
      yield* send(actor, { type: "TO_BOX" });
      yield* pump(2);
      yield* settle;
      yield* pump(2);
      expect(actor.getSnapshot().status).toBe("active");
      expect(actor.getSnapshot().context.toasts.some((x) => x.snag)).toBe(true);
    }).pipe(Effect.provide(Layer.mergeAll(simLayer(t.handle), framesManual, Layer.succeed(Saves, t.desk), door)));
  });

  it.effect("without a Door (tests, the headless shell) TO_BOX does nothing", () => {
    const t = setup();
    return Effect.gen(function* () {
      const { actor, pump, settle } = yield* boot;
      yield* send(actor, { type: "TO_BOX" });
      yield* pump(2);
      yield* settle;
      expect(t.results).toEqual([]);
      expect(actor.getSnapshot().status).toBe("active");
    }).pipe(t.provide);
  });
});
