import { Effect, Layer, Schema } from "effect";
import { BaseGame } from "./base-game";
import { Content, type ContentApi } from "./services/content";
import { Skin } from "./services/skin";
import { Assets } from "./services/assets";
import { Audio } from "./services/audio";
import { Looks, type ResolvedLook } from "./services/looks";
import { Voice } from "./services/voice";
import { Vocabulary } from "./services/vocabulary";
import { Progression, CoachLine, Arc, Building, Disaster, Ending, EntityKind, EventOrArc, Goal, Headline, ModError, NamePool, Rival, Thought, Tip, decodeManifest, suggest, type LookData, type ModManifest, type SkinData } from "./schema";
import { contentKey, patchById } from "./patch";
import { BenchmarkSchema, MishapSchema } from "../content/leapfrog";
import { FactionSchema } from "../content/factions";
import { BirdRowSchema } from "../content/birdapp";
import type { ProgressionLevel } from "../content/progression";
import { sanitizeCss } from "./css";
import { ownAsset, validateAssets } from "./assets";
import { VISITOR_ROLES } from "../content/names";
import { validateContent } from "./validation";
import baseTokens from "../skins/base/tokens.json";
import baseStrings from "../skins/base/strings.json";

function applyContent(below: ContentApi, mod: ModManifest): ContentApi {
  const p = mod.content;
  if (!p) return below;
  const buildingRows = Object.entries(below.buildings).map(([id, row]) => ({ ...row, id }));
  const buildingSchema = Schema.Struct({ id: Schema.String, ...Building.fields });
  const buildings = patchById("buildings", buildingRows, p.buildings, (row) => row.id, Schema.decodeUnknownSync(buildingSchema));
  for (const row of buildings) if (row.id !== row.kind) throw new ModError({ path: "content.buildings", detail: `building id "${row.id}" must equal kind "${row.kind}"` });
  return {
    ...below,
    progression: patchById("progression", below.progression, p.progression, (row) => row.id, (input) => Schema.decodeUnknownSync(Progression)(input) as ProgressionLevel),
    coach: patchById("coach", below.coach, p.coach, (row) => row.id, Schema.decodeUnknownSync(CoachLine)),
    buildings: Object.fromEntries(buildings.map(({ id, ...row }) => [id, row])),
    rivals: patchById("rivals", below.rivals, p.rivals, (row) => row.id, Schema.decodeUnknownSync(Rival)),
    headlines: p.headlines ? patchById("headlines", below.headlines.map((row, i) => ({ ...row, id: contentKey("headlines", row, i) })), p.headlines, (row) => row.id, (input) => Schema.decodeUnknownSync(Schema.Struct({ ...Headline.fields, id: Schema.String }))({ trigger: "filler", ...toObject(input) })) : below.headlines,
    thoughts: p.thoughts ? patchById("thoughts", below.thoughts.map((row, i) => ({ ...row, id: contentKey("thoughts", row, i) })), p.thoughts, (row) => row.id, Schema.decodeUnknownSync(Schema.Struct({ ...Thought.fields, id: Schema.String }))) : below.thoughts,
    events: patchById("events", below.events, p.events, (row) => row.id, Schema.decodeUnknownSync(EventOrArc, { onExcessProperty: "error" })),
    arcs: patchById("arcs", below.arcs, p.arcs, (row) => row.id, Schema.decodeUnknownSync(Arc)),
    walkerKinds: patchById("walkerKinds", below.walkerKinds, p.walkerKinds, (row) => row.id, Schema.decodeUnknownSync(EntityKind)),
    endings: patchById("endings", below.endings, p.endings, (row) => row.id, Schema.decodeUnknownSync(Ending)),
    tips: patchById("tips", below.tips, p.tips, (row) => row.id, Schema.decodeUnknownSync(Tip)),
    names: patchById("names", below.names, p.names, (row) => row.id, Schema.decodeUnknownSync(NamePool)),
    goals: patchById("goals", below.goals, p.goals, (row) => row.id, Schema.decodeUnknownSync(Goal)),
    disasters: patchById("disasters", below.disasters, p.disasters, (row) => row.id, Schema.decodeUnknownSync(Disaster)),
    benchmarks: patchById("benchmarks", below.benchmarks, p.benchmarks, (row) => row.id, Schema.decodeUnknownSync(BenchmarkSchema)),
    mishaps: patchById("mishaps", below.mishaps, p.mishaps, (row) => row.id, Schema.decodeUnknownSync(MishapSchema)),
    factions: patchById("factions", below.factions, p.factions, (row) => row.id, Schema.decodeUnknownSync(FactionSchema)),
    birdapp: patchById("birdapp", below.birdapp, p.birdapp, (row) => row.id, Schema.decodeUnknownSync(BirdRowSchema)),
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
      checkSkin(value, own);
      // Fonts and the preview are resolved to the mod's own data URLs here, so the skin carries everything it draws.
      const fonts = (value.fonts ?? []).map((font) => typeof font === "string" ? { family: font, src: own[font]! } : { ...font, src: own[font.src]! });
      const clean = { ...value, css: sanitizeCss(value.css ?? "", value.id, own), fonts, ...(value.preview !== undefined ? { preview: own[value.preview]! } : {}) };
      return Skin.of({ active: value.activate ? value.id : below.active, skins: { ...below.skins, [value.id]: clean } });
    }, catch: asModError });
  }));
  const audio = Layer.effect(Audio, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Audio;
    for (const id of mod.audio?.music ?? []) if (!Object.hasOwn(mod.assets ?? {}, id)) return yield* Effect.fail(new ModError({ path: "audio.music", detail: `unbundled asset "${id}"` }));
    return Audio.of({ ...below, cues: { ...below.cues, ...mod.audio?.cues }, music: mod.audio?.music ?? below.music });
  }));
  const looks = Layer.effect(Looks, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Looks;
    const content = yield* Content;
    if (!mod.looks) return below;
    const own = { ...mod.assets, ...mod.skin?.assets };
    return yield* Effect.try({ try: () => {
      validateAssets(own);
      const looks = { ...below.looks };
      for (const [target, look] of Object.entries(mod.looks ?? {})) looks[target] = resolveLook(target, look, own, content, mod.id);
      return Looks.of({ looks });
    }, catch: asModError });
  }));
  // A voice (FLT-102) is plain data the schema already checked; the last mod with one speaks.
  const voice = Layer.effect(Voice, Effect.gen(function* () {
    const mod = yield* manifest;
    const below = yield* Voice;
    return mod.voice ? Voice.of({ voice: { ...mod.voice, mod: mod.id } }) : below;
  }));
  return Layer.mergeAll(content, assets, skin, audio, looks, voice);
}

const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
/** FLT-14 token names ("color.accent", "x.mine") or raw custom properties ("--ink"). */
const TOKEN = /^(?:--[\w-]+|[a-z][\w]*(?:\.[\w]+)*)$/;
function checkSkin(value: SkinData, own: Readonly<Record<string, string>>) {
  // Tokens are CSS too; they must pass the same boundary as the stylesheet.
  for (const [key, val] of Object.entries(value.tokens ?? {})) {
    if (!TOKEN.test(key) || /[;{}<>\\]|url\s*\(|@import|expression\s*\(/i.test(val)) throw new ModError({ path: `skin.tokens.${key}`, detail: "expected a token name (\"color.accent\" or \"--ink\") and a single value without URLs" });
    sanitizeCss(`:root {--t:${val}}`, value.id, own);
    if (!key.startsWith("--") && !key.startsWith("x.") && !Object.hasOwn(baseTokens, key)) throw new ModError({ path: `skin.tokens.${key}`, detail: `unknown token "${key}"${suggest(key, Object.keys(baseTokens))} (the tokens are listed in docs/SKINS.md; your own start with "x.")` });
  }
  for (const key of Object.keys(value.strings ?? {})) {
    if (!Object.hasOwn(baseStrings, key)) throw new ModError({ path: `skin.strings.${key}`, detail: `unknown string "${key}"${suggest(key, Object.keys(baseStrings))} (the keys are in src/skins/base/strings.json)` });
  }
  (value.fonts ?? []).forEach((font, i) => ownAsset(own, typeof font === "string" ? font : font.src, "font", `skin.fonts[${i}]`));
  if (value.preview !== undefined) ownAsset(own, value.preview, "image", "skin.preview");
  if (value.extends === value.id) throw new ModError({ path: "skin.extends", detail: "a skin cannot extend itself" });
}

/** Who a look can be for: the walker kinds, and a kind and one of its roles for the kinds that have several. */
function lookTargets(content: ContentApi): { kinds: string[]; roles: Record<string, readonly string[]> } {
  const pool = (id: string) => content.names.find((row) => row.id === id)?.values ?? [];
  return { kinds: content.walkerKinds.map((row) => row.id), roles: { visitor: VISITOR_ROLES, researcher: pool("RESEARCHER_ROLES") } };
}
function resolveLook(target: string, look: LookData, own: Readonly<Record<string, string>>, content: ContentApi, mod: string): ResolvedLook {
  const path = `looks.${target}`;
  const fail = (detail: string, at = path) => { throw new ModError({ path: at, detail }); };
  const { kinds, roles } = lookTargets(content);
  const [kind = "", role] = target.split(":");
  if (kind === "faction") {
    // A faction crowd (FLT-33): the protesters who came with it, and anyone who has taken its side.
    const ids = content.factions.map((row) => row.id);
    if (!role || !ids.includes(role)) fail(`unknown faction "${role ?? ""}"${suggest(role ?? "", ids)}; factions are ${ids.join(", ")}`);
  } else if (!kinds.includes(kind)) fail(`unknown walker kind "${kind}"${suggest(kind, kinds)}; looks are for ${kinds.join(", ")} or "faction:<id>"`);
  if (role !== undefined && kind !== "faction") {
    const known = roles[kind];
    if (!known) fail(`"${kind}" has one role; use "${kind}" on its own`);
    else if (!known.includes(role)) fail(`unknown ${kind} role "${role}"${suggest(role, known)}; ${kind} roles are ${known.join(", ")}`);
  }
  const forms = (["recipe", "sprite", "glb", "tint"] as const).filter((key) => look[key] !== undefined);
  if (forms.length !== 1) fail(`give exactly one of "recipe", "sprite", "glb" or "tint" (found ${forms.length ? forms.join(", ") : "none"})`);
  for (const [i, coat] of (look.coats ?? []).entries()) if (!HEX.test(coat)) fail(`expected a colour like "#d9a441", got "${coat}"`, `${path}.coats[${i}]`);
  for (const [i, part] of (look.recipe ?? []).entries()) {
    if (part.color === "coat" ? !look.coats : !HEX.test(part.color)) fail(part.color === "coat" ? "\"coat\" needs a \"coats\" list on the look" : `expected "#rrggbb" or "coat", got "${part.color}"`, `${path}.recipe[${i}].color`);
  }
  for (const key of ["body", "head"] as const) {
    const c = look.tint?.[key];
    if (c !== undefined && !HEX.test(c)) fail(`expected a colour like "#d9a441", got "${c}"`, `${path}.tint.${key}`);
  }
  if (look.signs && kind !== "protester" && kind !== "faction") fail("only protesters (and faction crowds) carry signs", `${path}.signs`);
  const src = look.sprite !== undefined ? ownAsset(own, look.sprite, "image", `${path}.sprite`) : look.glb !== undefined ? ownAsset(own, look.glb, "model", `${path}.glb`) : undefined;
  return { ...look, mod, ...(src ? { src } : {}) };
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
    for (const key of Object.keys(mod.looks ?? {})) mark(`looks.${key}`, mod.id, "override");
    if (mod.voice) mark("voice", mod.id, "override");
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
