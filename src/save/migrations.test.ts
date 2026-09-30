// FLT-65: old saves keep loading. `fixtures/v1-*.fltsave` are frozen: never regenerate them, add a new one per version.
import { Effect } from "effect";
import { runDays } from "../sim/testkit";
import { decodeSave, encodeSave, loadWorld, parseSave, serialize, upgradeWorld } from "./codec";
import { SAVE_VERSION } from "./format";
import { RIVAL_DEFS } from "../content/rivals";
import { MIGRATIONS, WORLD_MIGRATIONS, migrate, renameIds, replaceText, type Migration } from "./migrations";

// Written once on Sep 30 2026 (FLT-65, v1): `createInitialState(7)`, `runDays(s, 45)`, then
// `encodeSave(s, { skin: "frontier-95", savedAt: new Date("2026-09-30T12:00:00Z") })`. Frozen: never regenerate it.
import V1_GARAGE from "./fixtures/v1-garage-day45.fltsave?raw";
// Written once on Sep 30 2026 (FLT-75, v2) by main at 4cbc20a: `createTestCampus(3)`, `waterDiscourse = 150`, 20 days of
// `tick(s, answer(s))`, then `encodeSave(s, { skin: "frontier-95", savedAt: new Date("2026-09-30T12:00:00Z") })`.
// 38 protesters at the gate, 3 of them mid-march. Frozen: never regenerate it.
import V2_PROTEST from "./fixtures/v2-protest-day20.fltsave?raw";
import { legacyWorld, people } from "../sim/ecs/protesters";
import { protesterCount } from "../sim/protest";
import { tick } from "../sim/tick";
import { answer } from "../sim/testkit";
import { TICKS_PER_DAY } from "../sim/constants";

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
    expect(renameIds({ constructor: "toString" }, { vssi: "x" })).toEqual({ constructor: "toString" });
  });

  it("replaceText swaps phrases inside any string, longest first when asked in that order", () => {
    const pairs = [["Very Safe Superintelligence Inc.", "Very Very Super Super Intelligence"], ["Very Safe SI", "Super Super AI"]] as const;
    expect(replaceText({ h: ["Very Safe SI raises again", "Very Safe Superintelligence Inc. files"], n: 1 }, pairs)).toEqual({ h: ["Super Super AI raises again", "Very Very Super Super Intelligence files"], n: 1 });
  });

  // v1 → v2 (#71): the rival `vssi` is `supersuper` now. The frozen v1 garage has the old id as values and as keys.
  it("v1 → v2: the frozen garage's `vssi` is `supersuper`, and it plays on", async () => {
    const { save, world } = await run(decodeSave(V1_GARAGE));
    expect(save.v).toBe(SAVE_VERSION);
    const json = JSON.stringify(world);
    expect(json).not.toMatch(/"vssi"|Very Safe S|MetaMeta Superintelligence/);
    const known = new Set<string>(RIVAL_DEFS.map((r) => r.id));
    for (const r of world.race!.rivals) expect(known.has(r.context.id)).toBe(true);
    expect(Object.keys(world.race!.prevRanks ?? {})).toContain("supersuper");
    runDays(world, 60);
    expect(world.day).toBe(105);
  });

  it("a World step reaches inside the packed World of a save, and no step leaves it alone", async () => {
    const save = await run(parseSave(V1_GARAGE));
    const upgraded = await run(upgradeWorld(save, 2, 3, { 2: (w) => renameIds(w, { anthro: "anthro-2" }) }));
    const before = JSON.stringify(await run(loadWorld(save)));
    const after = JSON.stringify(await run(loadWorld(upgraded)));
    expect(before).toContain('"anthro"');
    expect(after).not.toContain('"anthro"');
    expect(after.split('"anthro-2"').length).toBe(before.split('"anthro"').length);
    expect(await run(upgradeWorld(save, 2, 3, {}))).toBe(save);
  });

  // v2 → v3 (FLT-75): protesters leave `walkers` for their own rows, and come back as Koota entities that play on
  // exactly as main played the same save on: main loaded this file, ran 30 days and hashed the World to 2228a4c8.
  it("v2 → v3: the frozen protest's crowd moves into `protesters`, and plays on to main's World", async () => {
    const { save, world } = await run(decodeSave(V2_PROTEST));
    expect(save.v).toBe(3);
    expect(world.walkers.some((w) => w.kind === "protester")).toBe(false);
    expect(protesterCount(world)).toBe(38);
    expect(people(world).filter((w) => w.kind === "protester" && w.route.length > 0)).toHaveLength(3);
    for (let i = 0; i < 30 * TICKS_PER_DAY; i++) tick(world, answer(world));
    const json = JSON.stringify(legacyWorld(world));
    let h = 0x811c9dc5;
    for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 0x01000193) >>> 0;
    expect(h.toString(16).padStart(8, "0")).toBe("2228a4c8");
    // And a v3 save of it round-trips: rows out, Koota entities back in, the same World.
    const again = await run(decodeSave(serialize(await run(encodeSave(world)))));
    expect(JSON.stringify(again.world)).toBe(JSON.stringify(world));
  }, 120_000);
});
