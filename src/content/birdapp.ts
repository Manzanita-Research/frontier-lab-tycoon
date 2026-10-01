// The Bird App (FLT-69): researchers who post, as data. Every row of a pack's `content.birdapp` section is one of
// three kinds: an `archetype` (a kind of poster: how often, how spicy, the handles it picks, the factions its
// controversies move), a `post` (a line one archetype says, or `any` of them, maybe only at a moment) or an `event`
// (what someone thinks, replies or headlines when a post lands). mods/base-birdapp is the base game's; a Daily Drama
// pack adds posts for the day's news with one `add`, or has the timeline react with the `birdapp.post` verb.
// The engine side is src/sim/birdapp; the numbers are in that pack's `rules.birdapp`.
import { Schema } from "effect";
import pack from "../../mods/base-birdapp/mod.json";

/** What is going on that makes people post: a launch of yours, a rival's drop, the water discourse, a hearing, 3am. */
export const BIRD_MOMENTS = ["launch", "rivalDrop", "water", "hearing", "night"] as const;
export type BirdMoment = (typeof BIRD_MOMENTS)[number];
/** How a post lands. */
export const BIRD_OUTCOMES = ["flop", "banger", "controversy", "ratioed", "cancelled"] as const;
export type BirdOutcome = (typeof BIRD_OUTCOMES)[number];
/** When an event row speaks: an outcome, or a beat of a poster's life. */
export const BIRD_BEATS = [...BIRD_OUTCOMES, "drafting", "break", "back", "logoff", "leave", "drowning", "promoted"] as const;
export type BirdBeat = (typeof BIRD_BEATS)[number];

const Text = Schema.NonEmptyString;
const Id = Text.check(Schema.isPattern(/^(?!__proto__$|constructor$|prototype$)[\w:.-]+$/));
const Unit = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));
/** A handle stem: lowercase letters, digits and underscores, no @ (the generator adds that). */
const Stem = Text.check(Schema.isPattern(/^[a-z0-9_]{3,24}$/));

export const BirdArchetypeSchema = Schema.Struct({
  kind: Schema.Literal("archetype"),
  id: Id,
  name: Text,
  blurb: Text,
  /** How often they post, against the tier's rate (1 = the tier's rate). */
  rate: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  /** A new poster's personal spice is drawn from this range. */
  spice: Schema.Tuple([Unit, Unit]),
  /** Handle stems ("vibes_after_midnight"); the generator may add a suffix. */
  handles: Schema.Array(Stem),
  /** What a controversy of theirs does to each faction's meter. */
  factions: Schema.Record(Schema.String, Schema.Finite),
  /** Posting rate at night, times this. */
  night: Schema.optionalKey(Schema.Finite),
  /** They come in pairs: one posts, the other answers the same afternoon. */
  duo: Schema.optionalKey(Schema.Boolean),
  /** One character the panels draw as the avatar. */
  glyph: Schema.optionalKey(Text),
});
export const BirdPostSchema = Schema.Struct({
  kind: Schema.Literal("post"),
  id: Id,
  /** An archetype id, or `any`. */
  archetype: Id,
  /** `{model}` (your latest model), `{rival}` and `{lab}` are filled in. */
  text: Text,
  /** 0 (a badge photo) to 1 (a résumé-ender). */
  spice: Unit,
  /** Only said at this moment (and preferred then). */
  moment: Schema.optionalKey(Schema.Literals(BIRD_MOMENTS)),
  /** The Duo's other half says this back, the same afternoon. */
  answer: Schema.optionalKey(Text),
});
export const BirdEventSchema = Schema.Struct({
  kind: Schema.Literal("event"),
  id: Id,
  on: Schema.Literals(BIRD_BEATS),
  /** A thought bubble over the poster, a reply under the post, a Frontier Times headline or a toast. */
  channel: Schema.Literals(["thought", "reply", "headline", "toast"]),
  /** `{name}`, `{handle}`, `{lab}`, `{post}` and `{queue}` are filled in. */
  text: Text,
});
export const BirdRowSchema = Schema.Union([BirdArchetypeSchema, BirdPostSchema, BirdEventSchema]);
export type BirdArchetype = Schema.Schema.Type<typeof BirdArchetypeSchema>;
export type BirdPost = Schema.Schema.Type<typeof BirdPostSchema>;
export type BirdEvent = Schema.Schema.Type<typeof BirdEventSchema>;
export type BirdRow = Schema.Schema.Type<typeof BirdRowSchema>;

const Pack = Schema.Struct({ content: Schema.Struct({ birdapp: Schema.Struct({ add: Schema.Array(BirdRowSchema) }) }) });
/** The base game's rows (mods/base-birdapp). */
export const BIRDAPP: readonly BirdRow[] = Schema.decodeUnknownSync(Pack)(pack).content.birdapp.add;

/** The rows of a section, sorted by kind: what the sim reads, built once per section. */
export interface BirdContent {
  archetypes: readonly BirdArchetype[];
  archetypeById: ReadonlyMap<string, BirdArchetype>;
  posts: readonly BirdPost[];
  /** Posts by archetype id, the `any` ones in each. */
  postsFor: (archetype: string) => readonly BirdPost[];
  events: (beat: BirdBeat, channel: BirdEvent["channel"]) => readonly BirdEvent[];
}
const sorted = new WeakMap<readonly BirdRow[], BirdContent>();
export function birdContent(rows: readonly BirdRow[]): BirdContent {
  let hit = sorted.get(rows);
  if (hit) return hit;
  const archetypes = rows.filter((r): r is BirdArchetype => r.kind === "archetype");
  const posts = rows.filter((r): r is BirdPost => r.kind === "post");
  const events = rows.filter((r): r is BirdEvent => r.kind === "event");
  const byArchetype = new Map<string, BirdPost[]>();
  const any = posts.filter((p) => p.archetype === "any");
  for (const a of archetypes) byArchetype.set(a.id, [...posts.filter((p) => p.archetype === a.id), ...any]);
  const byBeat = new Map<string, BirdEvent[]>();
  for (const e of events) {
    const key = `${e.on}:${e.channel}`;
    const pool = byBeat.get(key);
    if (pool) pool.push(e);
    else byBeat.set(key, [e]);
  }
  hit = {
    archetypes, archetypeById: new Map(archetypes.map((a) => [a.id, a])), posts,
    postsFor: (id) => byArchetype.get(id) ?? any,
    events: (beat, channel) => byBeat.get(`${beat}:${channel}`) ?? [],
  };
  sorted.set(rows, hit);
  return hit;
}
