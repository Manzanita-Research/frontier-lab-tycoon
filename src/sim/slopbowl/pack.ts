// The Slop Bowl is late (FLT-109): mods/base-slopbowl, direct-loaded in the FLT-15 section shape. The pack owns the
// place's name, the odds, the campus-clock timing, how far research slides, every line each beat can say, the courier's
// lines and the card. Its numbers and words are checked in slopbowl.test.ts.
import { Schema } from "effect";
import json from "../../../mods/base-slopbowl/mod.json";
import { EventCard } from "../../mods/schema";

const S = Schema.NonEmptyString;
const N = Schema.Finite;
const Lines = Schema.Array(S);
const Toast = Schema.Struct({ text: S, tone: Schema.Literals(["good", "bad", "neutral", "joke"]), importance: Schema.Literals(["you", "world"]) });
/** What one beat says and does. Every part is optional; `*Count` is how many of the pool it uses. */
const Beat = Schema.Struct({
  toast: Schema.optionalKey(Toast),
  /** Bird App Aura, now (Vibes ×10 while the Bird App is asleep). */
  aura: Schema.optionalKey(N),
  vibes: Schema.optionalKey(N),
  news: Schema.optionalKey(Lines),
  thoughts: Schema.optionalKey(Lines),
  thoughtCount: Schema.optionalKey(N),
  posts: Schema.optionalKey(Lines),
  postCount: Schema.optionalKey(N),
  spice: Schema.optionalKey(N),
  rivals: Schema.optionalKey(Lines),
  rivalCount: Schema.optionalKey(N),
  /** A camera beat (the `camera.beat` verb's params, `on` the gate). */
  beat: Schema.optionalKey(Schema.Struct({ kind: S, kicker: Schema.optionalKey(S), caption: S, sub: Schema.optionalKey(S), zoom: Schema.optionalKey(N), hold: Schema.optionalKey(N) })),
});
export const BEATS = ["late", "hangry", "worse", "meltdown", "arrive", "fed", "granola", "backup"] as const;
export type SlopBeat = (typeof BEATS)[number];
/** The machine's stages while an order is out (quiet has no tracker). */
export const STAGES = ["late", "hangry", "worse", "meltdown", "arriving", "fed"] as const;
export type SlopStage = (typeof STAGES)[number];
const step = () => Schema.Struct({ eta: S, status: S, route: N });
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({ events: Schema.Struct({ add: Schema.Array(EventCard) }) }),
  rules: Schema.Struct({ slopbowl: Schema.Struct({
    place: S,
    /** A roll at each campus noon: `perNoon`, with `minResearchers` on staff, `firstAfterDays` after the pack wakes, `gapDays` after the last. */
    odds: Schema.Struct({ perNoon: N, minResearchers: N, firstAfterDays: N, gapDays: N }),
    /** Game days late at each beat (the order falls due at noon on the campus clock), how long the courier may take, and lunch. */
    days: Schema.Struct({ hangry: N, worse: N, meltdown: N, arrive: N, courierWait: N, fed: N }),
    /** While hangry a day's training adds `-backwards` of what it would have (`granola` of that, after the granola); fed, it wins it back at `catchUp` of a day's gain a day. */
    research: Schema.Struct({ backwards: N, granola: N, catchUp: N }),
    /** The share of researchers at the gate in each stage, and how often each one paces to a new spot (ticks). */
    crowd: Schema.Struct({ late: N, hangry: N, worse: N, meltdown: N, paceTicks: N }),
    /** How many of the waiting researchers lie down on the floor at the meltdown. */
    flop: N,
    /** The delivery tracker (the OrderTracker slot): its app's name, the order, what it says at each stage, and the day line. */
    tracker: Schema.Struct({
      app: S, order: S, day: S,
      steps: Schema.Struct(Object.fromEntries(STAGES.map((k) => [k, Schema.Struct({ eta: S, status: S, route: N })])) as Record<SlopStage, ReturnType<typeof step>>),
    }),
    /** Energy and focus everyone gets back with the bowls. */
    cheer: N,
    /** The courier: a visitor with this role, who talks with the researcher who signs for the bowls for `talkTicks`. */
    courier: Schema.Struct({ role: S, talkTicks: N, lines: Lines }),
    beats: Schema.Struct(Object.fromEntries(BEATS.map((b) => [b, Beat])) as Record<SlopBeat, typeof Beat>),
  }) }),
});

export function loadSlopBowlPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  return { ...p, rules: p.rules.slopbowl };
}
export const SLOPBOWL = loadSlopBowlPack(json);
export const CARD = "slopbowl";
export const PICK_PREFIX = "slopbowl:pick:";
export const PICKS = ["wait", "granola", "backup"] as const;
export type SlopPick = (typeof PICKS)[number];
