// FLT-69 the Bird App's numbers, direct-loaded from mods/base-birdapp's `rules.birdapp` (its words are the
// `birdapp` content section, read through defs() so a mod can add to them).
import { Schema } from "effect";
import json from "../../../mods/base-birdapp/mod.json";
import { BIRD_OUTCOMES } from "../../content/birdapp";

const N = Schema.Finite;
const Range = Schema.Tuple([N, N]);
/** Per outcome: [likes per follower, reposts per like, replies per like]. */
const Engagement = Schema.Record(Schema.Literals(BIRD_OUTCOMES), Schema.Tuple([N, N, N]));
const Rules = Schema.Struct({
  /** A new poster's tier, by share. */
  tiers: Schema.Struct({ recluse: N, occasional: N, big: N }),
  /** Followers a new poster starts with, by tier. */
  followers: Schema.Struct({ recluse: Range, occasional: Range, big: Range }),
  /** Posts a day, by tier (the archetype's `rate` scales it). */
  rates: Schema.Struct({ occasional: N, big: N }),
  /** Followers that make an occasional poster a big account (on a banger), and the most posts in a day. */
  bigAt: N, maxPosts: N,
  /** A moment multiplies the posting rate, adds to the spice, and is the line's topic this often. */
  moment: N, momentSpice: N, momentLine: N,
  /** Water discourse at or above this is a water moment. */
  moments: Schema.Struct({ water: N }),
  /** [base, slope] per outcome: banger, controversy and ratioed are base + slope × spice, cancelled base + slope × spice². The rest flop. */
  odds: Schema.Struct({ banger: Range, controversy: Range, ratioed: Range, cancelled: Range }),
  /** "Run it by Comms": the spice and the banger odds, times these. Capacity a day: the founder's, plus each Comms Rep's. */
  comms: Schema.Struct({ spice: N, banger: N, founder: N, perRep: N, drown: N, sticksDays: N }),
  aura: Schema.Struct({
    start: N, banger: Schema.Struct({ occasional: N, big: N }), controversy: N, ratioed: N, cancelled: N,
    /** Aura drifts toward a floor the posters hold up: this much per big account and per occasional poster, at most `floorMax`. */
    perBig: N, perOccasional: N, floorMax: N, ease: N,
  }),
  /** Aura into the lab: resting Hype + aura × hype; visitors × (1 + aura / visitors); applicants × (1 + aura / applicants). A banger's own Hype. */
  effects: Schema.Struct({ hype: N, visitors: N, applicants: N, bangerHype: N }),
  engagement: Engagement,
  /** Followers gained (a share of the count) per outcome; a banger's is a range. */
  growth: Schema.Struct({ banger: Range, ratioed: N, cancelled: N, flop: N }),
  /** A cancel: water discourse (protest), the chance it ends in a resignation when it sticks, the posting break, how much of the Aura crash Comms wins back. */
  cancel: Schema.Struct({ discourse: N, controversyDiscourse: N, leave: N, breakDays: N, contained: N, defection: N }),
  /** "Please log off": focus lost a day, and after `quitAfter` days a big account may quit. */
  logoff: Schema.Struct({ focus: N, quitAfter: N, quitChance: N }),
  /** FLT-92 the rival labs' posts. */
  rivals: Schema.Struct({
    /** Rival posts a day, every lab together, and the chance a voice posts on a quiet day (times its `rate`). */
    maxPosts: N, idle: N,
    /** The chance a lab answers a beat about you, and how many labs at most; the chance another lab subtweets a release; the chance a teaser account counts down. */
    react: N, reactors: N, subtweet: N, teaser: N,
    /** A lab that falls `dropPlaces` on the Arena goes quiet for `silenceDays`; one that climbs `climbPlaces` brags. */
    silenceDays: N, dropPlaces: N, climbPlaces: N,
    /** How a rival post lands: banger and ratioed odds (the rest flop), and a loud beat's banger odds (a release, #1). */
    outcomes: Schema.Struct({ banger: N, ratioed: N, loud: N }),
    /** One of your posters dunks on a lab's slide: the chance someone does, the chance it lands, and the Aura a landed dunk adds on top of the banger's. */
    dunk: Schema.Struct({ chance: N, banger: N, aura: N }),
    /** A rival CEO quote-posts one of your ratioed posts: the chance it was them, and the Hype it costs. */
    ratio: Schema.Struct({ chance: N, hype: N }),
    /** How many landed rival posts the log keeps. */
    log: N,
  }),
});
export type BirdRules = typeof Rules.Type;
export const loadBirdRules = (input: unknown): BirdRules => Schema.decodeUnknownSync(Schema.Struct({ rules: Schema.Struct({ birdapp: Rules }) }))(input).rules.birdapp;
export const BIRD = loadBirdRules(json);
