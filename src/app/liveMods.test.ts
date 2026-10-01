// FLT-78: which mods may join a running lab, the session recomposed around one, and the Sim swapping its definition on
// exactly the tick of the `addMod`/`removeMod` command (so the lab on screen is the lab a replay makes).
import { Effect } from "effect";
import drama from "../../mods/drama/2026-09-30/mod.json";
import steve from "../../mods/examples/every-lab-is-steve/mod.json";
import { decodeManifest, type ModManifest } from "../mods/schema";
import { defs, withDefs } from "../sim/defs";
import { createInitialState } from "../sim/state";
import { tick, TICKS_PER_DAY } from "../sim/tick";
import type { Command } from "../sim/commands";
import { cardsOf, needsRestart, NO_MODS, withMod, withoutModId } from "./mods";
import { SimHandle } from "./sim";

const decode = (m: unknown) => Effect.runPromise(decodeManifest(m));
const mod = (id: string, rest: Partial<ModManifest> = {}): ModManifest => ({ apiVersion: 1, id, name: id, version: "1.0.0", ...rest });
const TAGLINE = "Deeply worried. Priced accordingly.";

describe("which mods can join a running lab (FLT-78)", () => {
  it("a Daily Drama pack is data-only, and its one card is what it schedules", async () => {
    const m = await decode(drama);
    expect(needsRestart(m)).toBeNull();
    expect(cardsOf(m)).toEqual(["drama-2026-09-30-risk-factors"]);
  });

  it("anything the World is built from needs a fresh start, and says why", async () => {
    expect(needsRestart(await decode(steve))).toMatch(/fresh start/);
    expect(needsRestart(mod("s", { skin: { id: "x" } as never }))).toBe("Brings a look or sounds: needs a fresh start.");
    expect(needsRestart(mod("b", { content: { buildings: { add: [] } } as never }))).toBe("Changes buildings: needs a fresh start.");
    expect(needsRestart(mod("e", { content: { events: { remove: ["x"] } } as never }))).toBe("Changes how events work: needs a fresh start.");
    expect(needsRestart(mod("r", { content: { rivals: { override: [{ id: "anthro", short: "A" }] } } as never }))).toBe("Changes the rival labs: needs a fresh start.");
    expect(needsRestart(mod("t", { content: { rivals: { override: [{ id: "anthro", tagline: "Hi" }] }, headlines: { add: [] } } as never }))).toBeNull();
  });
});

describe("the session around a mod added mid-game (FLT-78)", () => {
  it("adds the pack's words and tagline, and taking it out puts the rival's own back", async () => {
    const manifest = await decode(drama);
    const added = await withMod(NO_MODS, { manifest, source: "/mods/drama/2026-09-30/mod.json" });
    expect(added.mods.map((m) => m.id)).toEqual([manifest.id]);
    expect(added.run?.mods).toEqual([{ id: manifest.id, version: manifest.version, hash: added.mods[0]!.hash }]);
    expect(withDefs(added.def, () => defs().rivalById.anthro.tagline)).toBe(TAGLINE);
    // Added again: still once.
    expect((await withMod(added, { manifest, source: "/mods/drama/2026-09-30/mod.json" })).mods).toHaveLength(1);
    const removed = await withoutModId(added, manifest.id);
    expect(removed).toMatchObject({ def: null, mods: [], run: null, manifests: [] });
    expect(withDefs(removed.def, () => defs().rivalById.anthro.tagline)).not.toBe(TAGLINE);
  });
});

describe("the Sim swaps its definition on the command's tick (FLT-78)", () => {
  it("a staged add runs the old definition up to the tick before, and is the same lab as a replay", async () => {
    const manifest = await decode(drama);
    const next = await withMod(NO_MODS, { manifest, source: "/mods/drama/2026-09-30/mod.json" });
    const add: Command = {
      type: "addMod",
      mod: { id: manifest.id, name: manifest.name, version: manifest.version, hash: next.mods[0]!.hash, url: "/mods/drama/2026-09-30/mod.json", cards: cardsOf(manifest) },
      run: next.run!,
      news: { toast: "📼 Today's Drama added", flash: "📼 Just in." },
    };
    const remove: Command = { type: "removeMod", id: manifest.id, cards: cardsOf(manifest), run: null };

    const sim = new SimHandle(createInitialState(9));
    sim.step(5 * TICKS_PER_DAY, []);
    sim.stageDef(add, next.def);
    expect(sim.def).toBeNull(); // nothing changes until the command runs
    sim.step(10 * TICKS_PER_DAY, [add]);
    expect(sim.def).toBe(next.def);
    sim.stageDef(remove, null);
    sim.step(3 * TICKS_PER_DAY, [remove]);
    expect(sim.def).toBeNull();

    const replay = createInitialState(9);
    for (let i = 0; i < 5 * TICKS_PER_DAY; i++) tick(replay, [], null);
    for (let i = 0; i < 10 * TICKS_PER_DAY; i++) tick(replay, i === 0 ? [add] : [], next.def);
    for (let i = 0; i < 3 * TICKS_PER_DAY; i++) tick(replay, i === 0 ? [remove] : [], null);
    expect(JSON.stringify(sim.world)).toBe(JSON.stringify(replay));
    expect(sim.world.modsAdded).toBeUndefined();
  });
});
