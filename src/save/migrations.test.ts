// FLT-65: old saves keep loading. `fixtures/v1-*.fltsave` are frozen: never regenerate them, add a new one per version.
import { Effect } from "effect";
import { runDays } from "../sim/testkit";
import { decodeSave, loadWorld, parseSave, upgradeWorld } from "./codec";
import { SAVE_VERSION } from "./format";
import { MIGRATIONS, WORLD_MIGRATIONS, migrate, renameIds, type Migration } from "./migrations";

// Written once on Sep 30 2026 (FLT-65, v1): `createInitialState(7)`, `runDays(s, 45)`, then
// `encodeSave(s, { skin: "frontier-95", savedAt: new Date("2026-09-30T12:00:00Z") })`. Frozen: never regenerate it.
import V1_GARAGE from "./fixtures/v1-garage-day45.fltsave?raw";

const run = <A, E>(e: Effect.Effect<A, E>) => Effect.runPromise(e);

describe("migrations", () => {
  it("the frozen v1 save loads, upgraded to the current version, and plays on", async () => {
    const { save, world } = await run(decodeSave(V1_GARAGE));
    expect(save.v).toBe(SAVE_VERSION);
    expect(save).toMatchObject({ lab: world.labName, day: world.day, seed: 7, skin: "frontier-95", savedAt: "2026-09-30T12:00:00.000Z" });
    expect(world.day).toBe(45);
    const cash = world.cash;
    runDays(world, 30);
    expect(world.day).toBe(75);
    expect(world.cash).not.toBe(cash);
  });

  it("every version below the current one has a step", () => {
    for (let v = 1; v < SAVE_VERSION; v++) expect(MIGRATIONS[v], `MIGRATIONS[${v}]`).toBeTypeOf("function");
  });

  it("runs the steps in order and refuses a gap", () => {
    const table: Record<number, Migration> = {
      1: (s) => ({ ...s, v: 2, trail: [...((s.trail as string[]) ?? []), "1→2"] }),
      2: (s) => ({ ...s, v: 3, trail: [...(s.trail as string[]), "2→3"] }),
    };
    expect(migrate({ v: 1 }, 3, table)).toEqual({ v: 3, trail: ["1→2", "2→3"] });
    expect(migrate({ v: 3 }, 3, table)).toEqual({ v: 3 });
    expect(() => migrate({ v: 1 }, 4, table)).toThrow(/No migration from save v3/);
    expect(() => migrate({ v: 1 }, 2, { 1: (s) => ({ ...s, v: 5 }) })).toThrow(/produced v5/);
  });

  it("every World step belongs to a version below the current one", () => {
    for (const k of Object.keys(WORLD_MIGRATIONS)) expect(Number(k)).toBeLessThan(SAVE_VERSION);
  });

  it("renameIds renames exact ids and keys, and leaves prose alone", () => {
    const w = { rivals: [{ id: "vssi" }, { id: "anthro" }], prevRanks: { vssi: 3 }, news: "vssi shipped", n: 4, f: null };
    expect(renameIds(w, { vssi: "supersuper" })).toEqual({ rivals: [{ id: "supersuper" }, { id: "anthro" }], prevRanks: { supersuper: 3 }, news: "vssi shipped", n: 4, f: null });
  });

  // A dress rehearsal for the FLT-62 rename (rival `vssi` to `supersuper`): the World step runs inside the packed
  // state of the frozen v1 garage, and every trace of the old id is gone.
  it("a World step reaches inside the packed World of an old save", async () => {
    const v1 = await run(parseSave(V1_GARAGE));
    const before = JSON.stringify(await run(loadWorld(v1)));
    expect(before).toContain('"vssi"');
    const upgraded = await run(upgradeWorld(v1, 1, 2, { 1: (w) => renameIds(w, { vssi: "supersuper" }) }));
    const after = JSON.stringify(await run(loadWorld(upgraded)));
    expect(after).not.toContain('"vssi"');
    expect(after).toContain('"supersuper"');
    expect(after.split('"supersuper"').length).toBe(before.split('"vssi"').length);
    // No step for this version: the save comes back untouched.
    expect(await run(upgradeWorld(v1, 1, 2, {}))).toBe(v1);
  });
});
