// The Bird App (FLT-69): researchers who post, as data. Every row of a pack's `content.birdapp` section is one of
// three kinds: an `archetype` (a kind of poster: how often, how spicy, the handles it picks, the factions its
// controversies move), a `post` (a line one archetype says, or `any` of them, maybe only at a moment) or an `event`
// (what someone thinks, replies or headlines when a post lands). mods/base-birdapp is the base game's; a Daily Drama
// pack adds posts for the day's news with one `add`, or has the timeline react with the `birdapp.post` verb.
// FLT-92 adds the rival labs' side, `birdapp.rivals`: a `voice` (one of a lab's invented accounts: its CEO, its "we're so
// back" researcher, its launch teaser, its safety lead) and a `rival` line (what a voice says on a beat: a release of its
// own, an Arena swing, your launch, your leak, a cancel, an escape, a hearing, a raise). A pack adds rival posts the same
// way, with one `add`, or has a lab post today with the `birdapp.rival` verb.
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

/** FLT-92: who posts for a rival lab. The CEO vagueposts, the researcher is so back, the teaser account counts down, the safety lead threads. */
export const RIVAL_ROLES = ["ceo", "back", "teaser", "safety"] as const;
export type RivalRole = (typeof RIVAL_ROLES)[number];
/**
 * What a rival lab posts about. Its own: `idle` (a quiet day), `teaser` (a launch is close), `release`, `top` (#1 on the
 * Arena), `climb`, `drop` (fell 3 places: one line, then silence), `back` (the silence ends), `subtweet` (another lab
 * shipped). Yours: `launch`, `leak`, `cancel`, `escape`, `hearing`, `raise`, `ratio` (their CEO quote-posts one of your
 * posts into a ratio). `dunk` is the other way round: one of *your* posters on a lab's slide. `reply` is the top reply
 * under a rival post.
 */
export const RIVAL_BEATS = ["idle", "teaser", "release", "top", "climb", "drop", "back", "subtweet", "launch", "leak", "cancel", "escape", "hearing", "raise", "ratio", "dunk", "reply"] as const;
export type RivalBeat = (typeof RIVAL_BEATS)[number];

export const BirdVoiceSchema = Schema.Struct({
  kind: Schema.Literal("voice"),
  id: Id,
  /** A rival id (`defs().rivals`), or `any`: a voice every lab without one of that role borrows, its handle after the lab's name. */
  lab: Id,
  role: Schema.Literals(RIVAL_ROLES),
  name: Text,
  /** Without the @. An `any` voice's is a suffix: Sirocco's `_ceo` posts as @sirocco_ceo. */
  handle: Stem,
  followers: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  /** How often they post on a quiet day, against the rest (1 = as often). */
  rate: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
  glyph: Schema.optionalKey(Text),
});
export const BirdRivalLineSchema = Schema.Struct({
  kind: Schema.Literal("rival"),
  id: Id,
  on: Schema.Literals(RIVAL_BEATS),
  /** Only this role says it (`us`: one of your posters, for a dunk). Any role, without one. */
  role: Schema.optionalKey(Schema.Literals([...RIVAL_ROLES, "us"])),
  /** Only this lab's voices say it. */
  lab: Schema.optionalKey(Id),
  /** `{you}` (your lab), `{me}` (the lab posting), `{rival}` (the lab it is about), `{model}`, `{handle}` and `{rank}` are filled in. */
  text: Text,
});
export const BirdRowSchema = Schema.Union([BirdArchetypeSchema, BirdPostSchema, BirdEventSchema, BirdVoiceSchema, BirdRivalLineSchema]);
export type BirdVoice = Schema.Schema.Type<typeof BirdVoiceSchema>;
export type BirdRivalLine = Schema.Schema.Type<typeof BirdRivalLineSchema>;
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
  /** FLT-92: every rival voice, in content order. */
  voices: readonly BirdVoice[];
  /** A lab's voices: its own, then an `any` voice for each role it has none of. */
  voicesFor: (lab: string) => readonly BirdVoice[];
  /** The rival lines for a beat that this role at this lab may say. */
  rivalLines: (beat: RivalBeat, role: RivalRole | "us", lab: string) => readonly BirdRivalLine[];
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
  const voices = rows.filter((r): r is BirdVoice => r.kind === "voice");
  const lines = rows.filter((r): r is BirdRivalLine => r.kind === "rival");
  const byLab = new Map<string, BirdVoice[]>();
  const voicesFor = (lab: string) => {
    let hit = byLab.get(lab);
    if (!hit) {
      const own = voices.filter((v) => v.lab === lab);
      hit = [...own, ...voices.filter((v) => v.lab === "any" && !own.some((o) => o.role === v.role))];
      byLab.set(lab, hit);
    }
    return hit;
  };
  const byLine = new Map<string, BirdRivalLine[]>();
  const rivalLines = (beat: RivalBeat, role: RivalRole | "us", lab: string) => {
    const key = `${beat}:${role}:${lab}`;
    let hit = byLine.get(key);
    if (!hit) {
      hit = lines.filter((l) => l.on === beat && (l.role === undefined ? role !== "us" : l.role === role) && (l.lab === undefined || l.lab === lab));
      byLine.set(key, hit);
    }
    return hit;
  };
  hit = {
    archetypes, archetypeById: new Map(archetypes.map((a) => [a.id, a])), posts,
    postsFor: (id) => byArchetype.get(id) ?? any,
    events: (beat, channel) => byBeat.get(`${beat}:${channel}`) ?? [],
    voices, voicesFor, rivalLines,
  };
  sorted.set(rows, hit);
  return hit;
}
