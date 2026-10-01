import { Effect, Schema, SchemaIssue, Struct } from "effect";
import { BenchmarkSchema, MishapSchema } from "../content/leapfrog";
import { FactionSchema } from "../content/factions";
import { BirdArchetypeSchema, BirdEventSchema, BirdPostSchema, BirdRowSchema } from "../content/birdapp";
import { HUD_PANELS, SYSTEM_IDS } from "../content/progression";

const text = Schema.NonEmptyString;
const number = Schema.Finite;
const positive = number.check(Schema.isGreaterThan(0));
const nonnegative = number.check(Schema.isGreaterThanOrEqualTo(0));
const fraction = number.check(Schema.isBetween({ minimum: 0, maximum: 1 }));
const strings = Schema.Array(Schema.String);
const record = Schema.Record(Schema.String, Schema.String);
const tone = Schema.Literals(["neutral", "good", "bad", "joke"]);
const pair = Schema.Tuple([nonnegative, nonnegative]);
const id = text.check(Schema.isPattern(/^(?!__proto__$|constructor$|prototype$)[\w:.-]+$/));
export const ModId = text.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

export const Building = Schema.Struct({
  kind: id, name: text, size: Schema.Tuple([positive, positive]), price: nonnegative,
  upkeepPerDay: nonnegative, blurb: Schema.String, color: text,
  scenery: Schema.optionalKey(Schema.Boolean), hosts: strings, capacity: nonnegative,
  stay: pair, serves: Schema.Record(Schema.String, Schema.Record(Schema.String, fraction)),
  show: Schema.optionalKey(Schema.Boolean), tally: Schema.optionalKey(Schema.Literals(["sips", "naps", "snacks", "demos"])),
  locked: Schema.optionalKey(Schema.Boolean),
});
export type BuildingData = typeof Building.Type;
export const Rival = Schema.Struct({
  id, name: text, short: text, color: text, tagline: Schema.String,
  startCapability: nonnegative, startHype: nonnegative,
  personality: Schema.Struct({ cadence: positive, growth: nonnegative, openness: fraction, poaching: fraction, hypeHunger: nonnegative }),
  models: Schema.NullOr(Schema.Struct({ base: text, tiers: strings })),
  headlines: Schema.Struct({ release: strings, open: Schema.optionalKey(strings), stunt: Schema.optionalKey(strings), poach: Schema.optionalKey(strings) }),
});
export type RivalData = typeof Rival.Type;
// Legacy lines have no id. Keep their data exact; contentKey supplies stable base keys without changing them.
export const GuardCondition = Schema.Union([
  Schema.Struct({ "stat.gte": Schema.Tuple([text, number]) }),
  Schema.Struct({ "flag.is": Schema.Tuple([text, Schema.Boolean]) }),
  Schema.Struct({ "day.after": nonnegative }),
  Schema.Struct({ chance: fraction }),
]);
export const Headline = Schema.Struct({ id: Schema.optionalKey(id), trigger: text, text, tone, when: Schema.optionalKey(GuardCondition) });
export type HeadlineData = typeof Headline.Type;
export const Thought = Schema.Struct({ id: Schema.optionalKey(id), kind: text, when: text, text });
export type ThoughtData = typeof Thought.Type;
interface ConditionData {
  readonly stat?: "waterDiscourse" | "hype" | "cash" | "capability" | "day";
  readonly atLeast?: number;
  readonly flag?: string;
  readonly daysAgo?: number;
  readonly all?: ReadonlyArray<ConditionData>;
}
const Condition: Schema.Codec<ConditionData> = Schema.suspend(() => Schema.Union([
  Schema.Struct({ stat: Schema.Literals(["waterDiscourse", "hype", "cash", "capability", "day"]), atLeast: number }),
  Schema.Struct({ flag: text, daysAgo: nonnegative }),
  Schema.Struct({ all: Schema.Array(Condition) }),
]));
const delta = { add: Schema.optionalKey(number), set: Schema.optionalKey(number) };
const EventEffect = Schema.Union([
  Schema.Struct({ type: Schema.Literal("cash"), amount: number }),
  Schema.Struct({ type: Schema.Literal("hype"), amount: number }),
  Schema.Struct({ type: Schema.Literal("discourse"), ...delta }),
  Schema.Struct({ type: Schema.Literal("protesters"), ...delta }),
  Schema.Struct({ type: Schema.Literal("flag"), name: text, clear: Schema.optionalKey(Schema.Boolean) }),
  Schema.Struct({ type: Schema.Literal("news"), text, tone: Schema.optionalKey(tone) }),
  Schema.Struct({ type: Schema.Literal("thought"), text, count: nonnegative, kind: Schema.optionalKey(text) }),
  Schema.Struct({ type: Schema.Literal("place"), kind: text, near: Schema.Literal("gate") }),
  Schema.Struct({ type: Schema.Literal("race"), action: Schema.Literals(["cutPrices", "openRelease", "safetyConcerns", "bidLow", "bidMid", "bidAll", "raise", "raiseCircular"]) }),
  // Release Leapfrog (FLT-27): the news cycle, trust, and the forced-response card's three answers.
  Schema.Struct({ type: Schema.Literal("voice"), amount: number }),
  Schema.Struct({ type: Schema.Literal("trust"), amount: number }),
  Schema.Struct({ type: Schema.Literal("leapfrog"), action: Schema.Literals(["shipNow", "hold", "leak"]) }),
  // Factions (FLT-33): move one faction's meter, or how two factions feel about each other (−100 to 100).
  Schema.Struct({ type: Schema.Literal("faction"), id, amount: number }),
  Schema.Struct({ type: Schema.Literal("relation"), a: id, b: id, amount: number }),
]);
/** One answer on a card. Exported so a pack with a bigger card (FLT-26's four-way choice) can reuse it. */
export const EventChoice = Schema.Struct({ label: text, hint: Schema.String, effects: Schema.Array(EventEffect) });
export const EventCard = Schema.Struct({
  id, title: text, body: text, tone, when: Condition,
  cooldown: Schema.optionalKey(nonnegative),
  choices: Schema.Array(EventChoice).check(Schema.isBetweenLength(1, 3)),
  kind: Schema.optionalKey(Schema.Literals(["era", "auction", "response", "stream", "hearing", "leak", "drama", "report", "bill", "vote"])), stripe: Schema.optionalKey(text),
});
export type EventData = typeof EventCard.Type;

export const NamedCall = Schema.Union([text, Schema.Struct({ type: text, params: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)) })]);
// A guard, or a list of guards that must all hold.
const Transition = Schema.Union([text, Schema.Struct({ target: Schema.optionalKey(text), guard: Schema.optionalKey(Schema.Union([NamedCall, Schema.Array(NamedCall)])), actions: Schema.optionalKey(Schema.Array(NamedCall)) })]);
export type NamedCallData = typeof NamedCall.Type;
interface ArcNodeData {
  readonly type?: "final";
  readonly initial?: string;
  readonly states?: Readonly<Record<string, ArcNodeData>>;
  readonly entry?: ReadonlyArray<NamedCallData>;
  readonly exit?: ReadonlyArray<NamedCallData>;
  readonly on?: Readonly<Record<string, typeof Transition.Type | ReadonlyArray<typeof Transition.Type>>>;
}
export const ArcNode: Schema.Codec<ArcNodeData> = Schema.suspend(() => Schema.Struct({
  type: Schema.optionalKey(Schema.Literal("final")), initial: Schema.optionalKey(text),
  states: Schema.optionalKey(Schema.Record(id, ArcNode)), entry: Schema.optionalKey(Schema.Array(NamedCall)), exit: Schema.optionalKey(Schema.Array(NamedCall)),
  on: Schema.optionalKey(Schema.Record(text, Schema.Union([Transition, Schema.Array(Transition)]))),
}));
/** `requires`: systems (content/progression.ts) that must be unlocked before the arc hears anything (FLT-33). */
export const Arc = Schema.Struct({ id, requires: Schema.optionalKey(Schema.Array(Schema.Literals(SYSTEM_IDS))), initial: text, states: Schema.Record(id, ArcNode) });
export type ArcData = typeof Arc.Type;
export const EntityKind = Schema.Struct({ id, name: text, presentation: Schema.Literals(["walker", "flow", "sprite", "offmap"]), needs: strings });
/** A disaster (FLT-17): a JSON statechart plus its cards. The shape is checked in full by sim/disasters/validate.ts. */
export const Disaster = Schema.Struct({
  id, name: text, blurb: text, tags: Schema.optionalKey(strings), odds: Schema.Json, requires: Schema.optionalKey(Schema.Json),
  target: Schema.optionalKey(Schema.Json), initial: text, states: Schema.Record(Schema.String, Schema.Json), cards: Schema.optionalKey(Schema.Array(Schema.Json)),
});
export type DisasterData = typeof Disaster.Type;
export const Ending = Schema.Struct({ id, title: text, text, when: Condition });
export const Tip = Schema.Struct({ id, text, when: Schema.optionalKey(text) });
export const NamePool = Schema.Struct({ id, values: strings });
export const Goal = Schema.Struct({ id, metric: Schema.Literals(["runs", "revenue", "hype", "era", "arena"]), label: text, target: nonnegative, unit: Schema.Literals(["runs", "money", "points", "era", "rank"]) });

function patch<const Fields extends Schema.Struct.Fields & { readonly id: Schema.Constraint }>(schema: Schema.Struct<Fields>) {
  return Schema.Struct({
    add: Schema.optionalKey(Schema.Array(schema)),
    override: Schema.optionalKey(Schema.Array(Schema.Struct({ id, ...Struct.map(Struct.omit(schema.fields, ["id"]), Schema.optionalKey) }))),
    remove: Schema.optionalKey(Schema.Array(id)),
  });
}
const PartialEvent = Schema.Struct({ id, ...Struct.map(Struct.omit(EventCard.fields, ["id"]), Schema.optionalKey) });
const PartialArc = Schema.Struct({ id, ...Struct.map(Struct.omit(Arc.fields, ["id"]), Schema.optionalKey) });
/** events accepts today's choice cards and the documented data-only statecharts. arcs is also an explicit section. */
export const EventOrArc = Schema.Union([EventCard, Arc]);
const EventPatch = Schema.Struct({ add: Schema.optionalKey(Schema.Array(EventOrArc)), override: Schema.optionalKey(Schema.Array(Schema.Union([PartialEvent, PartialArc]))), remove: Schema.optionalKey(Schema.Array(id)) });
const partialOf = <const F extends Schema.Struct.Fields>(fields: F) => Schema.Struct({ id, ...Struct.map(Struct.omit(fields, ["id"]), Schema.optionalKey) });
/** FLT-69: the Bird App's rows are archetypes, posts and reactions, told apart by `kind`. */
const BirdPatch = Schema.Struct({
  add: Schema.optionalKey(Schema.Array(BirdRowSchema)),
  override: Schema.optionalKey(Schema.Array(Schema.Union([partialOf(BirdArchetypeSchema.fields), partialOf(BirdPostSchema.fields), partialOf(BirdEventSchema.fields)]))),
  remove: Schema.optionalKey(Schema.Array(id)),
});
// Adds need an id even where the original game uses a dictionary or anonymous lines.
const identifiedBuilding = Schema.Struct({ id, ...Building.fields });
const identifiedHeadline = Schema.Struct({ ...Headline.fields, id, trigger: Schema.optionalKey(text) });
const identifiedThought = Schema.Struct({ ...Thought.fields, id });
export const Progression = Schema.Struct({
  id, level: Schema.Literals([1, 2, 3, 4, 5]), name: text,
  // Any building kind, including a mod's own (validation checks it exists).
  buildings: Schema.Array(text),
  staff: Schema.Array(Schema.Literals(["janitor", "sre", "comms", "security"])),
  systems: Schema.Array(Schema.Literals(SYSTEM_IDS)),
  panels: Schema.Array(Schema.Literals(HUD_PANELS)),
  goal: Schema.Struct({ text, metric: Schema.Literals(["models", "revenue", "team", "arena", "business", "ops"]), target: positive, vibes: Schema.optionalKey(nonnegative), visitors: Schema.optionalKey(nonnegative) }),
  // FLT-54: systems that wake later than the rung, each with its own small New! card.
  wakes: Schema.optionalKey(Schema.Array(Schema.Struct({ id: Schema.Literals(SYSTEM_IDS), after: nonnegative, title: Schema.String, body: Schema.String, silent: Schema.optionalKey(Schema.Boolean) }))),
});
export const CoachLine = Schema.Struct({
  id, text,
  target: Schema.Literals(["start", "build:path", "build:hall", "training", "build:gateway", "stat:runway", "goals", "map:suggest"]),
  waitFor: Schema.Literals(["action", "timer"]),
  trigger: Schema.Literals(["buildPanelOpened", "pathConnected", "hallBuilt", "released", "gatewayBuilt", "timer"]),
});
export const ContentPatch = Schema.Struct({
  progression: Schema.optionalKey(patch(Progression)), coach: Schema.optionalKey(patch(CoachLine)),
  buildings: Schema.optionalKey(patch(identifiedBuilding)), rivals: Schema.optionalKey(patch(Rival)),
  headlines: Schema.optionalKey(patch(identifiedHeadline)), thoughts: Schema.optionalKey(patch(identifiedThought)),
  events: Schema.optionalKey(EventPatch), arcs: Schema.optionalKey(patch(Arc)),
  walkerKinds: Schema.optionalKey(patch(EntityKind)), endings: Schema.optionalKey(patch(Ending)),
  tips: Schema.optionalKey(patch(Tip)), names: Schema.optionalKey(patch(NamePool)), goals: Schema.optionalKey(patch(Goal)),
  disasters: Schema.optionalKey(patch(Disaster)),
  benchmarks: Schema.optionalKey(patch(BenchmarkSchema)), mishaps: Schema.optionalKey(patch(MishapSchema)),
  factions: Schema.optionalKey(patch(FactionSchema)),
  birdapp: Schema.optionalKey(BirdPatch),
});
/** A bundled font: an asset id (the family is the id), or FLT-14's `{ family, src }` with `src` an asset id. */
export const SkinFont = Schema.Union([text, Schema.Struct({
  family: text.check(Schema.isPattern(/^[\w -]+$/)), src: text,
  weight: Schema.optionalKey(Schema.Union([number, text.check(Schema.isPattern(/^[\w -]+$/))])), style: Schema.optionalKey(Schema.Literals(["normal", "italic"])),
})]);
export const SkinData = Schema.Struct({
  id: ModId, name: text, tokens: Schema.optionalKey(record), strings: Schema.optionalKey(record),
  css: Schema.optionalKey(Schema.String), fonts: Schema.optionalKey(Schema.Array(SkinFont)),
  assets: Schema.optionalKey(record), activate: Schema.optionalKey(Schema.Boolean),
  /** FLT-55: a built-in skin to start from (its slots, CSS and tokens), e.g. "frontier-95". Default: the base. */
  extends: Schema.optionalKey(ModId),
  author: Schema.optionalKey(Schema.String), description: Schema.optionalKey(Schema.String),
  /** An image asset id the Display picker shows. */
  preview: Schema.optionalKey(text),
});
export type SkinData = typeof SkinData.Type;
export const Note = Schema.Struct({ at: nonnegative, hz: positive, endHz: Schema.optionalKey(positive), duration: positive, gain: fraction, wave: Schema.Literals(["sine", "square", "sawtooth", "triangle", "noise"]) });
/** A cue name: lower-case words joined by dots or dashes ("protest.grow", "ui.click", "gr-bark"). */
export const CueName = text.check(Schema.isPattern(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/));
/** A mod's note: audible pitches, and nothing that starts or rings for longer than five seconds (a cue is a moment, not a drone). */
const hz = number.check(Schema.isBetween({ minimum: 20, maximum: 20000 }));
const seconds = number.check(Schema.isBetween({ minimum: 0, maximum: 5 }));
export const CueNote = Schema.Struct({ ...Note.fields, at: seconds, hz, endHz: Schema.optionalKey(hz), duration: seconds.check(Schema.isGreaterThan(0)) });
export const AudioSection = Schema.Struct({ cues: Schema.optionalKey(Schema.Record(CueName, Schema.Array(CueNote).check(Schema.isBetweenLength(0, 32)))), music: Schema.optionalKey(strings) });

const vec3 = Schema.Tuple([number, number, number]);
const size3 = Schema.Tuple([positive, positive, positive]);
/** One primitive of a walker recipe (FLT-55). Units are world tiles at scale 1: a person stands about 1.25 tall. */
export const LookPart = Schema.Struct({
  shape: Schema.Literals(["box", "sphere", "capsule", "cone", "cylinder"]),
  size: size3, at: vec3,
  /** Degrees about x, y, z, applied to the part before it is placed. */
  rotate: Schema.optionalKey(vec3),
  /** Where the part turns for its `motion` (default: its centre, `at`). */
  pivot: Schema.optionalKey(vec3),
  /** "#rrggbb", or "coat" for the walker's colour from `coats`. */
  color: text,
  /** Darken (below 0) or lighten (above 0) the colour, -1 to 1. */
  shade: Schema.optionalKey(number.check(Schema.isBetween({ minimum: -1, maximum: 1 }))),
  /** wag (a tail), nod (a head), flop (an ear), sway, or step / step-alt (legs, in turn, while walking). */
  motion: Schema.optionalKey(Schema.Literals(["wag", "nod", "flop", "sway", "step", "step-alt"])),
});
export type LookPartData = typeof LookPart.Type;
/** How a walker kind or role looks (FLT-55). Exactly one of `recipe`, `sprite`, `glb` or `tint`. Presentation only. */
export const Look = Schema.Struct({
  recipe: Schema.optionalKey(Schema.Array(LookPart).check(Schema.isBetweenLength(1, 16))),
  sprite: Schema.optionalKey(text),
  glb: Schema.optionalKey(text),
  tint: Schema.optionalKey(Schema.Struct({ body: Schema.optionalKey(text), head: Schema.optionalKey(text) })),
  /** Per-walker colours for `"coat"` parts, and a per-walker tint on a sprite. */
  coats: Schema.optionalKey(Schema.Array(text).check(Schema.isBetweenLength(1, 16))),
  /** A sprite's width and height in tiles (default 0.9 x 1.2, about a person); a model is fitted to the height. */
  size: Schema.optionalKey(Schema.Tuple([positive, positive])),
  scale: Schema.optionalKey(positive),
  gait: Schema.optionalKey(Schema.Literals(["walk", "trot", "hop", "float"])),
  /** Protest placards for this look (protesters only): short lines, 1 to 12 of them. */
  signs: Schema.optionalKey(Schema.Array(text.check(Schema.isMaxLength(40))).check(Schema.isBetweenLength(1, 12))),
  /** Placard height in tiles (default: held up just above the top of the look; a small look gets a smaller placard). */
  signHeight: Schema.optionalKey(positive),
  /** What the inspector calls one ("Golden Retriever"). */
  label: Schema.optionalKey(text.check(Schema.isMaxLength(40))),
});
export type LookData = typeof Look.Type;
/** `looks` keys: a walker kind ("protester"), a kind and a role ("visitor:Journalist"), or a faction crowd ("faction:doomers"). */
export const LookTarget = text.check(Schema.isPattern(/^[a-z][\w-]*(?::[\w '.-]+)?$/));
export const ModManifest = Schema.Struct({
  apiVersion: Schema.Literal(1), id: ModId, name: text, version: text,
  author: Schema.optionalKey(Schema.String), description: Schema.optionalKey(Schema.String),
  skin: Schema.optionalKey(Schema.NullOr(SkinData)), content: Schema.optionalKey(ContentPatch),
  assets: Schema.optionalKey(record), audio: Schema.optionalKey(AudioSection),
  looks: Schema.optionalKey(Schema.Record(LookTarget, Look)),
});
export interface ModManifest extends Schema.Schema.Type<typeof ModManifest> {}

export class ModError extends Schema.TaggedError<ModError>()("ModError", { path: Schema.String, detail: Schema.String }) {
  override get message() { return `${this.path}: ${this.detail}`; }
}
export function suggest(word: string, candidates: readonly string[]): string {
  const distance = (a: string, b: string) => {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < b.length; j++) next.push(Math.min((next[j] ?? 0) + 1, (row[j + 1] ?? 0) + 1, (row[j] ?? 0) + (a[i] === b[j] ? 0 : 1)));
      row = next;
    }
    return row[b.length] ?? Infinity;
  };
  const best = candidates.map((value) => ({ value, distance: distance(word, value) })).sort((a, b) => a.distance - b.distance)[0];
  return best && best.distance <= 2 ? ` (did you mean "${best.value}"?)` : "";
}
const fieldNames = ["apiVersion", "id", "name", "version", "author", "description", "skin", "content", "assets", "audio", "looks", "cues", "music", ...Object.keys(Look.fields), ...Object.keys(LookPart.fields), "family", "src", "add", "override", "remove", ...Object.keys(ContentPatch.fields), ...Object.keys(Rival.fields), ...Object.keys(Building.fields), ...Object.keys(SkinData.fields), "choices", "effects", "type", "amount", "cash", "hype", "discourse", "protesters", "flag", "news", "thought", "place", "race", "text", "tone", "trigger", "when", "presentation", "good", "bad", "neutral", "joke", "walker", "flow", "sprite", "offmap", "initial", "states", "entry", "exit", "on", "guard", "actions", "target", "params", "blurb", "odds", "requires", "cards", "difficulty", "replaces", "weight", "voice", "headline", ...Object.keys(FactionSchema.fields), "faction", "relation", ...Object.keys(BirdArchetypeSchema.fields), ...Object.keys(BirdPostSchema.fields), ...Object.keys(BirdEventSchema.fields)];
function pathString(path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>): string {
  return path.reduce<string>((s, part) => {
    const key = typeof part === "object" ? part.key : part;
    return typeof key === "number" ? `${s}[${key}]` : `${s ? `${s}.` : ""}${String(key)}`;
  }, "") || "$";
}
export const decodeManifest = Effect.fn("Mods.decodeManifest")(function* (input: unknown) {
  return yield* Schema.decodeUnknownEffect(ModManifest, { onExcessProperty: "error", errors: "all", reportInput: true })(input).pipe(
    Effect.mapError((error) => {
      const issues = SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues;
      const details = issues.map((issue) => {
        const path = issue.path ?? [];
        const last = path[path.length - 1];
        let value: unknown = input;
        for (const part of path) {
          const key = typeof part === "object" ? part.key : part;
          value = typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
        }
        const word = issue.message.includes("Unexpected") ? typeof last === "string" ? last : "" : typeof value === "string" ? value : "";
        return `${pathString(path)}: ${issue.message}${suggest(word, fieldNames)}`;
      });
      return new ModError({ path: "$", detail: details.join("\n") });
    }),
  );
});
