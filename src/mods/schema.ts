import { Effect, Schema, SchemaIssue, Struct } from "effect";
import { BenchmarkSchema, MishapSchema } from "../content/leapfrog";

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
]);
export const EventCard = Schema.Struct({
  id, title: text, body: text, tone, when: Condition,
  cooldown: Schema.optionalKey(nonnegative),
  choices: Schema.Array(Schema.Struct({ label: text, hint: Schema.String, effects: Schema.Array(EventEffect) })).check(Schema.isBetweenLength(1, 3)),
  kind: Schema.optionalKey(Schema.Literals(["era", "auction", "response", "stream"])), stripe: Schema.optionalKey(text),
});
export type EventData = typeof EventCard.Type;

export const NamedCall = Schema.Union([text, Schema.Struct({ type: text, params: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)) })]);
const Transition = Schema.Union([text, Schema.Struct({ target: Schema.optionalKey(text), guard: Schema.optionalKey(NamedCall), actions: Schema.optionalKey(Schema.Array(NamedCall)) })]);
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
export const Arc = Schema.Struct({ id, initial: text, states: Schema.Record(id, ArcNode) });
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
// Adds need an id even where the original game uses a dictionary or anonymous lines.
const identifiedBuilding = Schema.Struct({ id, ...Building.fields });
const identifiedHeadline = Schema.Struct({ ...Headline.fields, id, trigger: Schema.optionalKey(text) });
const identifiedThought = Schema.Struct({ ...Thought.fields, id });
export const Progression = Schema.Struct({
  id, level: Schema.Literals([1, 2, 3, 4, 5]), name: text,
  // Any building kind, including a mod's own (validation checks it exists).
  buildings: Schema.Array(text),
  staff: Schema.Array(Schema.Literals(["janitor", "sre", "comms", "security"])),
  systems: Schema.Array(Schema.Literals(["breakdowns", "slop", "leapfrog", "arena", "rnd", "news", "events", "protests", "disasters", "papers", "collusion"])),
  panels: Schema.Array(Schema.Literals(["revenue", "vibes", "arena", "rnd", "thoughts", "news", "staff", "events", "papers", "disasters"])),
  goal: Schema.Struct({ text, metric: Schema.Literals(["models", "revenue", "team", "arena"]), target: positive, vibes: Schema.optionalKey(nonnegative) }),
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
});
export const SkinData = Schema.Struct({
  id: ModId, name: text, tokens: Schema.optionalKey(record), strings: Schema.optionalKey(record),
  css: Schema.optionalKey(Schema.String), fonts: Schema.optionalKey(strings),
  assets: Schema.optionalKey(record), activate: Schema.optionalKey(Schema.Boolean),
});
export type SkinData = typeof SkinData.Type;
export const Note = Schema.Struct({ at: nonnegative, hz: positive, endHz: Schema.optionalKey(positive), duration: positive, gain: fraction, wave: Schema.Literals(["sine", "square", "sawtooth", "triangle", "noise"]) });
export const ModManifest = Schema.Struct({
  apiVersion: Schema.Literal(1), id: ModId, name: text, version: text,
  author: Schema.optionalKey(Schema.String), description: Schema.optionalKey(Schema.String),
  skin: Schema.optionalKey(Schema.NullOr(SkinData)), content: Schema.optionalKey(ContentPatch),
  assets: Schema.optionalKey(record), audio: Schema.optionalKey(Schema.Struct({ cues: Schema.optionalKey(Schema.Record(text, Schema.Array(Note))), music: Schema.optionalKey(strings) })),
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
const fieldNames = ["apiVersion", "id", "name", "version", "author", "description", "skin", "content", "assets", "audio", "add", "override", "remove", ...Object.keys(ContentPatch.fields), ...Object.keys(Rival.fields), ...Object.keys(Building.fields), ...Object.keys(SkinData.fields), "choices", "effects", "type", "amount", "cash", "hype", "discourse", "protesters", "flag", "news", "thought", "place", "race", "text", "tone", "trigger", "when", "presentation", "good", "bad", "neutral", "joke", "walker", "flow", "sprite", "offmap", "initial", "states", "entry", "exit", "on", "guard", "actions", "target", "params", "blurb", "odds", "requires", "cards", "difficulty", "replaces", "weight", "voice", "headline"];
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
