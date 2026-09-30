// FLT-65: the save format. Round trip, determinism across a save and a load, the slots, and friendly errors.
import { Effect } from "effect";
import { createInitialState } from "../sim/state";
import { createMidgameScenario } from "../sim/scenarios/midgame";
import { runDays } from "../sim/testkit";
import { setRisk } from "../sim/disasters/driver";
import { tick } from "../sim/tick";
import type { GameState } from "../sim/types";
import { decodeSave, encodeSave, parseSave, serialize } from "./codec";
import { SAVE_VERSION, type SaveFile } from "./format";
import { makeSaveStore, MAX_SAVE_CHARS, memoryStorage } from "./store";
import { readSaveFile, saveFileName } from "./file";

const run = <A, E>(e: Effect.Effect<A, E>) => Effect.runPromise(e);
const fail = <A, E>(e: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(e));

/** A busy lab: the mid-game campus with disasters on, a month in. */
function busyLab(): GameState {
  const s = createMidgameScenario();
  setRisk(s, "normal");
  runDays(s, 30);
  return s;
}

describe("save round trip", () => {
  it("packs a World and gets the same World back", async () => {
    const world = busyLab();
    const save = await run(encodeSave(world, { skin: "frontier-95" }));
    expect(save).toMatchObject({ kind: "fltsave", v: SAVE_VERSION, lab: world.labName, day: world.day, tick: world.tick, seed: world.seed, skin: "frontier-95", enc: "gzip64", mods: [] });
    const back = await run(decodeSave(serialize(save)));
    expect(JSON.stringify(back.world)).toBe(JSON.stringify(world));
  });

  it("a mid-game save is small (the number goes in the PR)", async () => {
    const world = busyLab();
    const text = serialize(await run(encodeSave(world)));
    const raw = JSON.stringify(world).length;
    console.info(`[save size] day ${world.day}, ${world.walkers.length} walkers, ${world.buildings.length} buildings: World ${(raw / 1000).toFixed(0)}K JSON, save ${(text.length / 1000).toFixed(1)}K (${((text.length / raw) * 100).toFixed(0)}%)`);
    expect(text.length).toBeLessThan(150_000);
    expect(text.length).toBeLessThan(MAX_SAVE_CHARS / 10);
  });

  it("falls back to plain JSON where there is no CompressionStream, and that loads too", async () => {
    const world = createInitialState(3);
    const cs = globalThis.CompressionStream;
    (globalThis as { CompressionStream?: unknown }).CompressionStream = undefined;
    try {
      const save = await run(encodeSave(world));
      expect(save.enc).toBe("json");
      expect(JSON.stringify((await run(decodeSave(serialize(save)))).world)).toBe(JSON.stringify(world));
    } finally {
      globalThis.CompressionStream = cs;
    }
  });

  it("remembers the run's mods and where they came from", async () => {
    const world = createInitialState(2);
    world.mods = { mods: [{ id: "steve", version: "1.0.0", hash: "abc" }], contentHash: "def" };
    expect((await run(encodeSave(world))).mods).toEqual([{ id: "steve", version: "1.0.0", hash: "abc" }]);
    const mods = [{ id: "steve", version: "1.0.0", hash: "abc", source: "/mods/examples/every-lab-is-steve/mod.json" }];
    expect((await run(encodeSave(world, { mods }))).mods).toEqual(mods);
  });

  it("names the file after the lab and the date", () => {
    expect(saveFileName({ lab: "Gradient Descent Labs", day: 424 })).toBe("gradient-descent-labs-y2-mar-5.fltsave");
    expect(saveFileName({ lab: "???", day: 0 })).toBe("y1-jan-1.fltsave");
  });
});

describe("determinism across a save and a load", () => {
  it("save at tick N, load, run M ticks: the same World as never having stopped", async () => {
    const a = busyLab();
    const b = (await run(decodeSave(serialize(await run(encodeSave(a)))))).world;
    // Both run on: a keeps its object, b is the loaded copy. Cards are answered the same way on both.
    runDays(a, 60);
    runDays(b, 60);
    expect(b.tick).toBe(a.tick);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("from the first tick of a garage, through the tutorial", async () => {
    const a = createInitialState(11);
    for (let i = 0; i < 37; i++) tick(a);
    const b = (await run(decodeSave(serialize(await run(encodeSave(a)))))).world;
    runDays(a, 20);
    runDays(b, 20);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("friendly errors", () => {
  const good = () => run(encodeSave(createInitialState(5)));

  it("not JSON, not a save, empty", async () => {
    expect((await fail(parseSave("{nope"))).reason).toBe("notASave");
    expect((await fail(parseSave(JSON.stringify({ hello: "world" })))).reason).toBe("notASave");
    expect((await fail(parseSave("   "))).reason).toBe("empty");
    expect((await fail(parseSave(null))).reason).toBe("notASave");
  });

  it("a save from a newer game says so", async () => {
    const e = await fail(parseSave({ ...(await good()), v: SAVE_VERSION + 1 }));
    expect(e.reason).toBe("tooNew");
    expect(e.message).toMatch(/newer version/);
  });

  it("a damaged envelope or World is corrupt, with a sentence", async () => {
    const save = await good();
    expect((await fail(parseSave({ ...save, day: "Tuesday" }))).reason).toBe("corrupt");
    expect((await fail(decodeSave({ ...save, state: save.state.slice(0, 200) }))).reason).toBe("corrupt");
    expect((await fail(decodeSave({ ...save, enc: "json", state: "{\"seed\":1}" }))).message).toMatch(/incomplete/);
    expect((await fail(decodeSave({ ...save, v: 0 }))).reason).toBe("corrupt");
  });

  it("a file that is far too big is refused unread", async () => {
    const e = await fail(readSaveFile({ size: 9e6, text: () => Promise.reject(new Error("read")) } as unknown as Blob));
    expect(e.reason).toBe("tooBig");
  });

  it("a picked file decodes", async () => {
    const save = await good();
    const got = await run(readSaveFile(new Blob([serialize(save)])));
    expect(got.world.labName).toBe(save.lab);
  });
});

describe("the slots", () => {
  it("writes, lists and reads back", async () => {
    const store = makeSaveStore(memoryStorage());
    expect(store.list().every((l) => l.meta === null)).toBe(true);
    const save = await run(encodeSave(createInitialState(4)));
    const meta = await run(store.write("2", save));
    expect(meta.lab).toBe(save.lab);
    expect(store.list().map((l) => l.meta?.lab ?? null)).toEqual([null, null, save.lab, null]);
    expect((await run(store.read("2"))).state).toBe(save.state);
    store.remove("2");
    expect((await fail(store.read("2"))).reason).toBe("empty");
  });

  it("a full disk is an error, and the slot keeps its previous save", async () => {
    const storage = memoryStorage(60_000);
    const store = makeSaveStore(storage);
    const small = await run(encodeSave(createInitialState(4)));
    await run(store.write("auto", small));
    const big: SaveFile = { ...small, enc: "json", state: "x".repeat(80_000) };
    const e = await fail(store.write("auto", big));
    expect(e.reason).toBe("quota");
    expect(e.message).toMatch(/full/);
    expect((await run(store.read("auto"))).state).toBe(small.state);
  });

  it("a save over the size cap is refused before it is written", async () => {
    const store = makeSaveStore(memoryStorage());
    const small = await run(encodeSave(createInitialState(4)));
    expect((await fail(store.write("1", { ...small, enc: "json", state: "x".repeat(MAX_SAVE_CHARS) }))).reason).toBe("tooBig");
    expect(store.peek("1").meta).toBeNull();
  });

  it("blocked storage (private mode) fails softly", async () => {
    const store = makeSaveStore(null);
    expect(store.available).toBe(false);
    expect(store.list().every((l) => l.meta === null)).toBe(true);
    expect((await fail(store.write("1", await run(encodeSave(createInitialState(4)))))).reason).toBe("storage");
    const throwing = makeSaveStore({ getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => { throw new Error("denied"); } });
    expect(throwing.peek("auto").meta).toBeNull();
    expect((await fail(throwing.write("auto", await run(encodeSave(createInitialState(4)))))).reason).toBe("storage");
    expect(() => throwing.remove("auto")).not.toThrow();
  });

  it("junk in a slot is listed as broken, not thrown", () => {
    const storage = memoryStorage();
    storage.setItem("flt.save.3", "{{{");
    storage.setItem("flt.save.1", "{\"kind\":\"pizza\"}");
    const list = makeSaveStore(storage).list();
    expect(list[3]!.broken).toBeTruthy();
    expect(list[1]!.broken).toBeTruthy();
  });
});
