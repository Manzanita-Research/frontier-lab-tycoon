import { Effect, Layer, Stream } from "effect";
import { updateProgression, progressOf } from "../sim/progression";
import { BUILDINGS } from "../content/buildings";
import { EVENTS } from "../content/events";
import { HEADLINES } from "../content/headlines";
import { THOUGHTS } from "../content/thoughts";
import { RIVAL_DEFS } from "../content/rivals";
import { GOALS } from "../content/goals";
import * as Names from "../content/names";
import { CUES, cueNotes } from "../audio/score";
import { BaseGame, baseContent, baseRules, baseVocabulary, makeBaseGameLayer } from "./base-game";
import { resolveGameDefinition } from "./game-definition";
import { composeMods, modToLayer } from "./loader";
import { decodeManifest, ModError, type ModManifest } from "./schema";
import { Content } from "./services/content";
import { Skin } from "./services/skin";
import { Assets } from "./services/assets";
import { Audio } from "./services/audio";
import { GameEvents } from "./services/game-events";
import { baseTables } from "./tables";
import { runHeadless } from "./headless";
import { withDefs } from "../sim/defs";
import { createInitialState } from "../sim/state";
import steve from "../../mods/examples/every-lab-is-steve/mod.json";
import headlines from "../../mods/examples/headline-pack/mod.json";

const mod = (id: string, content: ModManifest["content"] = {}): ModManifest => ({ apiVersion: 1, id, name: id, version: "1.0.0", content });
const resolve = (mods: readonly ModManifest[]) => Effect.runPromise(resolveGameDefinition(composeMods(mods).layer));

describe("mod foundations", () => {
  it("resolves today's content exactly, without ids, reordered arrays, or mutated sources", async () => {
    const def = await Effect.runPromise(resolveGameDefinition(BaseGame.layer));
    expect(def.content).toEqual(baseContent);
    expect(def.content.buildings).toEqual(BUILDINGS);
    expect(def.content.rivals).toEqual(RIVAL_DEFS);
    expect(def.content.headlines).toEqual(HEADLINES);
    expect(def.content.thoughts).toEqual(THOUGHTS);
    expect(def.content.events).toEqual(EVENTS);
    expect(def.content.goals).toEqual(GOALS);
    expect(def.content.tables).toEqual(baseTables);
    for (const pool of def.content.names) expect(pool.values).toEqual(Reflect.get(Names, pool.id));
    expect(def.rules).toEqual(baseRules);
    expect(def.vocabulary).toEqual(baseVocabulary);
    expect(JSON.parse(JSON.stringify(def))).toEqual(def);
    expect(def.content.rivals).not.toBe(RIVAL_DEFS);
  });
  it("adds, overrides, removes, and retains unmentioned fields", async () => {
    const def = await resolve([mod("one", {
      rivals: { add: [{ ...RIVAL_DEFS[0]!, id: "steve", name: "Steve" }], override: [{ id: "anthro", name: "Steve Senior" }], remove: ["vssi"] },
      headlines: { add: [{ id: "hello", tone: "joke", text: "Steve ships" }] },
      buildings: { override: [{ id: "cluster", name: "Steve's Compute" }] },
      walkerKinds: { override: [{ id: "agent", presentation: "flow" }] },
    })]);
    expect(def.content.rivals[0]).toEqual({ ...RIVAL_DEFS[0], name: "Steve Senior" });
    expect(def.content.rivals.some((r) => r.id === "vssi")).toBe(false);
    expect(def.content.rivals.at(-1)?.id).toBe("steve");
    expect(def.content.headlines.at(-1)).toEqual({ id: "hello", tone: "joke", text: "Steve ships", trigger: "filler" });
    expect(def.content.buildings.cluster?.name).toBe("Steve's Compute");
    expect(def.content.walkerKinds.find((k) => k.id === "agent")?.presentation).toBe("flow");
    expect(RIVAL_DEFS[0]?.name).toBe("Anthropomorphic");
    expect(HEADLINES.some((h) => h.text === "Steve ships")).toBe(false);
  });
  it("loads progression overrides into the actual sim and rejects a missing level", async () => {
    const manifest = await Effect.runPromise(decodeManifest(mod("two-models", {
      progression: { override: [{ id: "garage", goal: { text: "Ship two models", metric: "models", target: 2 } }] },
    })));
    const def = await resolve([manifest]);
    const state = createInitialState(42, "garage", def);
    withDefs(def, () => {
      state.models.push("Fixture-1"); updateProgression(state);
      expect(progressOf(state)).toMatchObject({ level: 1, goal: { text: "Ship two models", target: 2 } });
      state.models.push("Fixture-2"); updateProgression(state);
      expect(progressOf(state).level).toBe(2);
    });
    expect(baseContent.progression[0]?.goal.target).toBe(1);
    await expect(resolve([mod("missing-level", { progression: { remove: ["team"] } })])).rejects.toThrow();
  });
  it("wraps the supplied service, stacks in order, and preserves other services", async () => {
    const first = mod("first", { rivals: { override: [{ id: "anthro", name: "First" }] } });
    const second = mod("second", { rivals: { override: [{ id: "anthro", name: "Second", short: "Second short" }] } });
    const { layer, conflicts } = composeMods([first, second]);
    const def = await Effect.runPromise(resolveGameDefinition(layer));
    expect(def.content.rivals[0]?.name).toBe("Second");
    expect((await resolve([second, first])).content.rivals[0]).toMatchObject({ name: "First", short: "Second short" });
    expect(conflicts).toEqual([{ path: "content.rivals.anthro", earlier: "first", later: "second", earlierOperation: "override", laterOperation: "override", resolution: "later operation wins if composition is valid" }]);
    const below = Layer.succeed(Content, { ...baseContent, rivals: baseContent.rivals.map((r) => ({ ...r, tagline: "From a supplied layer" })) });
    const direct = modToLayer(first).pipe(Layer.provide(Layer.merge(below, BaseGame.layer)));
    const content = await Effect.runPromise(Content.pipe(Effect.provide(direct)));
    // Test a custom base using a complete layer with Content overridden on the right.
    const custom = await Effect.runPromise(resolveGameDefinition(composeMods([first], Layer.merge(BaseGame.layer, below)).layer));
    expect(custom.content.rivals[0]?.tagline).toBe("From a supplied layer");
    expect(content.rivals[0]?.name).toBe("First");
    const services = await Effect.runPromise(Effect.gen(function* () {
      const assets = yield* Assets;
      const skin = yield* Skin;
      const audio = yield* Audio;
      const events = yield* GameEvents;
      return { urls: assets.urls, skin: skin.active, cues: audio.cues, events: yield* Stream.runCollect(events.stream) };
    }).pipe(Effect.provide(layer)));
    expect(services.urls).toEqual({});
    expect(services.skin).toBe("base-game");
    expect(services.events).toEqual([]);
    for (const cue of CUES) expect(services.cues[cue]).toEqual(JSON.parse(JSON.stringify(cueNotes(cue))));
  });
  it("keeps legacy patch keys stable after removes", async () => {
    const def = await resolve([
      mod("remove-first", { headlines: { remove: ["base-headlines-0"] } }),
      mod("change-second", { headlines: { override: [{ id: "base-headlines-1", text: "Second still means second" }] } }),
    ]);
    expect(def.content.headlines[0]).toMatchObject({ id: "base-headlines-1", text: "Second still means second" });
    expect(def.content.headlines[1]?.text).toBe(HEADLINES[2]?.text);
  });
  it("can override a mod's own addition and compose a remove followed by an add", async () => {
    const item = { ...RIVAL_DEFS[0]!, id: "steve", name: "Steve" };
    const def = await resolve([mod("one", { rivals: { add: [item], override: [{ id: "steve", name: "Steve II" }] } }), mod("two", { rivals: { remove: ["steve"] } }), mod("three", { rivals: { add: [item] } })]);
    expect(def.content.rivals.at(-1)?.name).toBe("Steve");
  });
  it("rejects collisions, nonexistent ids, invalid merged rows and duplicate mod ids", async () => {
    await expect(resolve([mod("bad", { rivals: { add: [RIVAL_DEFS[0]!] } })])).rejects.toThrow("already exists");
    await expect(resolve([mod("bad", { rivals: { override: [{ id: "antho", name: "Steve" }] } })])).rejects.toThrow('did you mean "anthro"');
    await expect(resolve([mod("bad", { rivals: { remove: ["missing"] } })])).rejects.toThrow("content.rivals.remove[0]");
    await expect(resolve([mod("bad", { headlines: { override: [{ id: "base-headlines-0", trigger: "filller" }] } })])).rejects.toThrow('did you mean "filler"');
    await expect(resolve([mod("bad", { rivals: { override: [{ id: "anthro", name: "A" }, { id: "anthro", name: "B" }] } })])).rejects.toThrow("duplicate id");
    expect(() => composeMods([mod("same"), mod("same")])).toThrow("duplicate mod id");
  });
  it("reports exact field paths and suggests misspelled fields", async () => {
    await expect(Effect.runPromise(decodeManifest({ ...mod("bad"), apiVersion: 2 }))).rejects.toThrow("apiVersion");
    await expect(Effect.runPromise(decodeManifest({ ...mod("bad"), content: { rivals: { overide: [] } } }))).rejects.toThrow('content.rivals.overide');
    await expect(Effect.runPromise(decodeManifest({ ...mod("bad"), content: { rivals: { overide: [] } } }))).rejects.toThrow('did you mean "override"');
    await expect(Effect.runPromise(decodeManifest({ ...mod("bad"), content: { rivals: { override: [{ id: "anthro", personality: { cadence: -1 } }] } } }))).rejects.toThrow("content.rivals.override[0].personality.cadence");
    await expect(Effect.runPromise(decodeManifest({ ...mod("bad"), script: "alert(1)" }))).rejects.toThrow("script");
    await expect(Effect.runPromise(decodeManifest({ ...mod("bad"), content: { headlines: { add: [{ id: "test", text: "Test", tone: "jok" }] } } }))).rejects.toThrow('did you mean "joke"');
  });
  it("validates named arc vocabulary, missing references and unreachable states", async () => {
    const arc = { id: "steve-arc", initial: "idle", states: { idle: { on: { DAY: { target: "done", guard: { type: "stat.gte", params: { stat: "hype", value: 40 } }, actions: [{ type: "cash.delta", params: { amount: 100 } }] } } }, done: { type: "final" as const } } };
    expect((await resolve([mod("arcs", { arcs: { add: [arc] } })])).content.arcs).toEqual([arc]);
    expect((await resolve([mod("arcs", { events: { add: [arc] } })])).content.events.at(-1)).toEqual(arc);
    const conditioned = await resolve([mod("conditional", { headlines: { add: [{ id: "discourse-line", text: "The discourse has a streaming deal", tone: "joke", when: { "stat.gte": ["waterDiscourse", 40] } }] } })]);
    expect(conditioned.content.headlines.at(-1)?.when).toEqual({ "stat.gte": ["waterDiscourse", 40] });
    await expect(resolve([mod("arcs", { arcs: { add: [{ ...arc, states: { ...arc.states, lonely: {} } }] } })])).rejects.toThrow("unreachable states: lonely");
    await expect(resolve([mod("arcs", { arcs: { add: [{ ...arc, states: { idle: { entry: ["cash.deltaa"] } } }] } })])).rejects.toThrow('did you mean "cash.delta"');
    await expect(resolve([mod("arcs", { arcs: { add: [{ ...arc, initial: "missing" }] } })])).rejects.toThrow("content.arcs[0].initial");
    await expect(Effect.runPromise(decodeManifest({ ...mod("arcs"), content: { arcs: { add: [{ ...arc, states: { idle: { after: { 1000: "done" } } } }] } } }))).rejects.toThrow("after");
  });
  it("accepts an injectable skin registry without pulling React into the pure definition", async () => {
    const layer = makeBaseGameLayer({ active: "test", skins: { test: { id: "test", name: "Test" } } });
    expect(await Effect.runPromise(Skin.pipe(Effect.provide(layer)))).toEqual({ active: "test", skins: { test: { id: "test", name: "Test" } } });
  });
  it("checks both examples for 365 actual days and replays deterministically", async () => {
    for (const input of [steve, headlines]) {
      const manifest = await Effect.runPromise(decodeManifest(input));
      const def = await resolve([manifest]);
      const report = runHeadless(def);
      expect(report.days).toBe(365);
      expect(report.ticks).toBe(365 * 20);
      expect(report.cardsAnswered).toBeGreaterThan(0);
      expect(report.state).toEqual(runHeadless(def).state);
      expect(report.coverage).toEqual({ executed: [input === steve ? "rivals" : "headlines"], inert: [] });
    }
  });
  it("starts rivals and goals from the definition without altering global modules", async () => {
    const def = await resolve([mod("tuning", { rivals: { override: [{ id: "anthro", startCapability: 77, personality: { ...RIVAL_DEFS[0]!.personality, growth: 23 } }] }, goals: { override: [{ id: "release", target: 4 }] } })]);
    const state = createInitialState(42, "garage", def);
    expect(state.race.rivals[0]?.context.capability).toBe(77);
    expect(state.race.rivals[0]?.context.personality.growth).toBe(23);
    expect(state.goals.context.goals[0]?.target).toBe(4);
    expect(createInitialState(42).race.rivals[0]?.context.capability).toBe(28);
    const report = runHeadless(def, { days: 30 });
    const baseline = runHeadless(await resolve([]), { days: 30 });
    expect(report.state.race.rivals[0]?.context.capability).not.toBe(baseline.state.race.rivals[0]?.context.capability);
  });
  it("exposes typed errors through the Effect channel", async () => {
    const result = await Effect.runPromise(resolveGameDefinition(composeMods([mod("bad", { rivals: { remove: ["missing"] } })]).layer).pipe(Effect.result));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") expect(result.failure).toBeInstanceOf(ModError);
  });
});
