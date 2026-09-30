import { Effect, Layer, Schema } from "effect";
import { BaseGame } from "./base-game";
import { Content, type ContentApi } from "./services/content";
import { Skin } from "./services/skin";
import { Assets } from "./services/assets";
import { Audio } from "./services/audio";
import { Vocabulary } from "./services/vocabulary";
import { Arc, Building, Ending, EntityKind, EventCard, Goal, Headline, ModError, NamePool, Rival, Thought, Tip, decodeManifest, type ModManifest } from "./schema";
import { contentKey, patchById } from "./patch";
import { sanitizeCss } from "./css";
import { validateAssets } from "./assets";
import { validateContent } from "./validation";

function applyContent(below: ContentApi, mod: ModManifest): ContentApi {
  const p = mod.content;
  if (!p) return below;
  const buildingRows = Object.entries(below.buildings).map(([id, row]) => ({ ...row, id }));
  const buildingSchema = Schema.Struct({ id: Schema.String, ...Building.fields });
  const buildings = patchById("buildings", buildingRows, p.buildings, (row) => row.id, Schema.decodeUnknownSync(buildingSchema));
  for (const row of buildings) if (row.id !== row.kind) throw new ModError({ path: "content.buildings", detail: `building id "${row.id}" must equal kind "${row.kind}"` });
  return {
    ...below,
    buildings: Object.fromEntries(buildings.map(({ id, ...row }) => [id, row])),
    rivals: patchById("rivals", below.rivals, p.rivals, (row) => row.id, Schema.decodeUnknownSync(Rival)),
    headlines: p.headlines ? patchById("headlines", below.headlines.map((row, i) => ({ ...row, id: contentKey("headlines", row, i) })), p.headlines, (row) => row.id, (input) => Schema.decodeUnknownSync(Schema.Struct({ ...Headline.fields, id: Schema.String }))({ trigger: "filler", ...toObject(input) })) : below.headlines,
    thoughts: p.thoughts ? patchById("thoughts", below.thoughts.map((row, i) => ({ ...row, id: contentKey("thoughts", row, i) })), p.thoughts, (row) => row.id, Schema.decodeUnknownSync(Schema.Struct({ ...Thought.fields, id: Schema.String }))) : below.thoughts,
    events: patchById("events", below.events, p.events, (row) => row.id, Schema.decodeUnknownSync(EventCard)),
    arcs: patchById("arcs", below.arcs, p.arcs, (row) => row.id, Schema.decodeUnknownSync(Arc)),
    walkerKinds: patchById("walkerKinds", below.walkerKinds, p.walkerKinds, (row) => row.id, Schema.decodeUnknownSync(EntityKind)),
    endings: patchById("endings", below.endings, p.endings, (row) => row.id, Schema.decodeUnknownSync(Ending)),
    tips: patchById("tips", below.tips, p.tips, (row) => row.id, Schema.decodeUnknownSync(Tip)),
    names: patchById("names", below.names, p.names, (row) => row.id, Schema.decodeUnknownSync(NamePool)),
    goals: patchById("goals", below.goals, p.goals, (row) => row.id, Schema.decodeUnknownSync(Goal)),
  };
}
function toObject(value: unknown): object { return typeof value === "object" && value !== null ? value : {}; }
function asModError(error: unknown): ModError {
  return error instanceof ModError ? error : new ModError({ path: "$", detail: String(error) });
}

/** Each service starts from the service below it. Other extension services remain available when composed. */
export function modToLayer(input: ModManifest) {
  const manifest = decodeManifest(input);
  const content = Layer.effect(Content, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Content;
    const vocabulary = yield* Vocabulary;
    return yield* Effect.try({ try: () => {
      const next = applyContent(below, mod);
      validateContent(next, vocabulary);
      return next;
    }, catch: asModError });
  }));
  const assets = Layer.effect(Assets, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Assets;
    return yield* Effect.try({ try: () => {
      const own = { ...mod.assets, ...mod.skin?.assets };
      validateAssets(own);
      const urls = { ...below.urls, ...own };
      return Assets.of({ urls, resolve: (id) => urls[id] });
    }, catch: asModError });
  }));
  const skin = Layer.effect(Skin, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Skin;
    if (!mod.skin) return below;
    const value = mod.skin;
    return yield* Effect.try({ try: () => {
      const own = { ...mod.assets, ...value.assets };
      validateAssets(own);
      // Tokens are CSS too; they must pass the same boundary as the stylesheet.
      for (const [key, val] of Object.entries(value.tokens ?? {})) {
        if (!/^--[\w-]+$/.test(key) || /[;{}]|url\s*\(/i.test(val)) throw new ModError({ path: `skin.tokens.${key}`, detail: "expected a CSS custom property and a single value without URLs" });
        sanitizeCss(`:root {${key}:${val}}`, value.id, own);
      }
      for (const font of value.fonts ?? []) if (!Object.hasOwn(own, font)) throw new ModError({ path: "skin.fonts", detail: `unbundled font "${font}"` });
      const clean = { ...value, css: sanitizeCss(value.css ?? "", value.id, own) };
      return Skin.of({ active: value.activate ? value.id : below.active, skins: { ...below.skins, [value.id]: clean } });
    }, catch: asModError });
  }));
  const audio = Layer.effect(Audio, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Audio;
    for (const id of mod.audio?.music ?? []) if (!Object.hasOwn(mod.assets ?? {}, id)) return yield* Effect.fail(new ModError({ path: "audio.music", detail: `unbundled asset "${id}"` }));
    return Audio.of({ ...below, cues: { ...below.cues, ...mod.audio?.cues }, music: mod.audio?.music ?? below.music });
  }));
  return Layer.mergeAll(content, assets, skin, audio);
}
export interface Conflict {
  readonly path: string;
  readonly earlier: string;
  readonly later: string;
  readonly earlierOperation: "add" | "override" | "remove";
  readonly laterOperation: "add" | "override" | "remove";
  readonly resolution: "later operation wins if composition is valid";
}
export function conflictReport(mods: readonly ModManifest[]): readonly Conflict[] {
  const touched = new Map<string, { mod: string; operation: Conflict["earlierOperation"] }>();
  const report: Conflict[] = [];
  const mark = (path: string, mod: string, operation: Conflict["earlierOperation"]) => {
    const old = touched.get(path);
    if (old && old.mod !== mod) report.push({ path, earlier: old.mod, later: mod, earlierOperation: old.operation, laterOperation: operation, resolution: "later operation wins if composition is valid" });
    touched.set(path, { mod, operation });
  };
  for (const mod of mods) {
    for (const [section, patch] of Object.entries(mod.content ?? {})) {
      for (const operation of ["add", "override", "remove"] as const) {
        for (const row of patch[operation] ?? []) {
          const id = typeof row === "string" ? row : row.id;
          mark(`content.${section}.${id}`, mod.id, operation);
        }
      }
    }
    if (mod.skin) { mark(`skin.${mod.skin.id}`, mod.id, "override"); if (mod.skin.activate) mark("skin.active", mod.id, "override"); }
    for (const key of Object.keys({ ...mod.assets, ...mod.skin?.assets })) mark(`assets.${key}`, mod.id, "override");
    for (const key of Object.keys(mod.audio?.cues ?? {})) mark(`audio.cues.${key}`, mod.id, "override");
    if (mod.audio?.music) mark("audio.music", mod.id, "override");
  }
  return report;
}
export function composeMods(mods: readonly ModManifest[], base = BaseGame.layer) {
  const ids = new Set<string>();
  for (const mod of mods) {
    if (ids.has(mod.id)) throw new ModError({ path: "id", detail: `duplicate mod id "${mod.id}"` });
    ids.add(mod.id);
  }
  // provideMerge retains Rules, Vocabulary and GameEvents; the wrapping services replace their predecessors.
  let layer: Layer.Layer<Layer.Success<typeof base>, ModError> = base;
  for (const mod of mods) layer = modToLayer(mod).pipe(Layer.provideMerge(layer));
  return { layer, conflicts: conflictReport(mods), mods: mods.map(({ id, version }) => ({ id, version })) };
}
