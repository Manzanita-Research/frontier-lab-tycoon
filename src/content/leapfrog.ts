// Release Leapfrog's content pack (FLT-27): benchmark names, cadence and tuning knobs, headlines, livestream mishaps
// and the cards, all data in `mods/base-leapfrog/mod.json` in the FLT-15 section shape (`content.<section>.add`, plus
// `rules.leapfrog` for the knobs; see docs/MODDING.md). It is loaded straight from JSON and checked with Effect Schema
// until FLT-15 M1b's loader takes it over, which should be a mechanical change: the shape is the same.
// A friendly path is the error when a section is wrong, e.g. `content.mishaps.add[2].weight: Expected number`.
import { Schema } from "effect";
import pack from "../../mods/base-leapfrog/mod.json";
import type { EventDef } from "./events";

const Num = Schema.Number;
const Str = Schema.String;
/** A `[min, max]` range. */
const Range = Schema.Tuple([Num, Num]);
/** One number per era. */
const PerEra = Schema.Tuple([Num, Num, Num, Num]);

const Tone = Schema.Literals(["good", "bad", "neutral", "joke"]);
export const LAB_KINDS = ["frontier", "neo", "open", "bigco"] as const;
export type LabKind = (typeof LAB_KINDS)[number];

/** What the engine can say with a headline from the pack. A mod adds lines to a trigger; it does not add triggers. */
export const PACK_TRIGGERS = [
  "sota", "youSota", "answer", "cycleOwned", "cycleLost", "crowded", "saturated",
  "react:frontier", "react:neo", "react:open", "react:bigco",
  "bug", "shipped", "counterStrong", "counterSoft", "windowClosed", "flawless", "leak", "leakBusted", "stunt",
] as const;
export type PackTrigger = (typeof PACK_TRIGGERS)[number];

const BenchmarkSchema = Schema.Struct({
  id: Str,
  name: Str,
  short: Str,
  /** `score`: a percentage that saturates toward 100. `elo`: an unbounded rating that never does. */
  kind: Schema.Literals(["score", "elo"]),
  /** The capability at which a lab scores 50% (score kind only). Bigger is harder. */
  difficulty: Num,
  /** The benchmark this one is introduced to replace once that one is declared solved. */
  replaces: Schema.optionalKey(Str),
});
export interface BenchmarkDef extends Schema.Schema.Type<typeof BenchmarkSchema> {}

const LabSchema = Schema.Struct({
  id: Str,
  kind: Schema.Literals(LAB_KINDS),
  /** Capability multiplier per benchmark id: what this lab is good (above 1) or bad (below 1) at. */
  bias: Schema.Record(Str, Num),
});
export interface LabDef extends Schema.Schema.Type<typeof LabSchema> {}

const HeadlineSchema = Schema.Struct({ id: Str, trigger: Schema.Literals(PACK_TRIGGERS), tone: Tone, text: Str });
export interface PackHeadline extends Schema.Schema.Type<typeof HeadlineSchema> {}

const MishapSchema = Schema.Struct({
  id: Str,
  /** Relative odds. */
  weight: Num,
  /** Share-of-voice push the moment it happens (negative: you lose the room). The card's choices add to it. */
  voice: Num,
  /** The headline when it airs; `stream:<id>` is the card that follows. */
  headline: Str,
});
export interface MishapDef extends Schema.Schema.Type<typeof MishapSchema> {}

// Cards: the same shape as content/events.ts. Only the effects a pack may use are allowed.
const ConditionSchema: Schema.Codec<unknown> = Schema.Union([
  Schema.Struct({ stat: Schema.Literals(["waterDiscourse", "hype", "cash", "capability", "day"]), atLeast: Num }),
  Schema.Struct({ flag: Str, daysAgo: Num }),
  Schema.Struct({ all: Schema.Array(Schema.suspend((): Schema.Codec<unknown> => ConditionSchema)) }),
]);
const EffectSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("cash"), amount: Num }),
  Schema.Struct({ type: Schema.Literal("hype"), amount: Num }),
  Schema.Struct({ type: Schema.Literal("discourse"), add: Schema.optionalKey(Num), set: Schema.optionalKey(Num) }),
  Schema.Struct({ type: Schema.Literal("flag"), name: Str, clear: Schema.optionalKey(Schema.Boolean) }),
  Schema.Struct({ type: Schema.Literal("news"), text: Str, tone: Schema.optionalKey(Tone) }),
  Schema.Struct({ type: Schema.Literal("thought"), text: Str, count: Num, kind: Schema.optionalKey(Str) }),
  Schema.Struct({ type: Schema.Literal("voice"), amount: Num }),
  Schema.Struct({ type: Schema.Literal("trust"), amount: Num }),
  Schema.Struct({ type: Schema.Literal("leapfrog"), action: Schema.Literals(["shipNow", "hold", "leak"]) }),
]);
const EventSchema = Schema.Struct({
  id: Str,
  kind: Schema.optionalKey(Schema.Literals(["response", "stream"])),
  stripe: Schema.optionalKey(Str),
  title: Str,
  body: Str,
  tone: Tone,
  when: ConditionSchema,
  cooldown: Schema.optionalKey(Num),
  choices: Schema.Array(Schema.Struct({ label: Str, hint: Str, effects: Schema.Array(EffectSchema) })),
});

const RulesSchema = Schema.Struct({
  cadence: Schema.Struct({
    /** The first lead drop, so a new lab gets a few quiet minutes. */
    firstDropDay: Num,
    gapMin: Num,
    gapMax: Num,
    /** Multiplies the gap, by era: later eras run faster. */
    eraPace: PerEra,
    /** The chance a lead drop is answered the next day, by era. */
    pairChance: PerEra,
    minGapDays: Num,
  }),
  benchmarks: Schema.Struct({
    slope: Num,
    /** Best score at which a benchmark is `crowded` (a photo finish at the ceiling), and `saturated` (declared solved). */
    crowdedAt: Num,
    solvedAt: Num,
    retireAfterDays: Num,
    /** How far past the record a benchmaxxed claim lands, in points: `maxxMargin` for scores, `eloMargin` for Elo. */
    maxxMargin: Range,
    eloMargin: Range,
  }),
  voice: Schema.Struct({
    /** Yesterday's attention is worth this much today. */
    decay: Num,
    /** Everyone gets `baseline + baselinePerHype x hype` of attention a day, so the meter never divides by zero. */
    baseline: Num,
    baselinePerHype: Num,
    leadPush: Num,
    answerPush: Num,
    stuntPush: Num,
    ownPush: Num,
    ownSotaPush: Num,
    sotaPush: Num,
    /** A lab owns the cycle at this share and this many times the runner-up; it keeps it above `keepShare`. */
    ownShare: Num,
    ownLead: Num,
    keepShare: Num,
    /** Your share above `fairShare` lifts your hype by `hypePerShare` per unit a day (clamped). */
    fairShare: Num,
    hypePerShare: Num,
    hypeMin: Num,
    hypeMax: Num,
  }),
  response: Schema.Struct({
    /** No forced-response card before this day, below this readiness, or within `gapDays` of the last. */
    minDay: Num,
    minReady: Num,
    gapDays: Num,
    /** Ship-now lands this fraction of what the full run would (on top of the readiness). */
    shipQuality: Num,
    bugBase: Num,
    bugPerMissing: Num,
    shipPush: Num,
    bugHype: Num,
    bugIncident: Num,
    holdDays: Num,
    holdRivalPush: Num,
    holdDamp: Num,
    counterStrongPush: Num,
    counterSoftPush: Num,
    counterHype: Num,
    /** Extra launch-week cash of a strong counter-launch, as a fraction of the normal bonus. */
    counterBonus: Num,
    leakPush: Num,
    leakBustedTrust: Num,
  }),
  livestream: Schema.Struct({
    oddsScale: Num,
    oddsFloor: Num,
    oddsCeil: Num,
    stageBonus: Num,
    flawlessPush: Num,
    flawlessHype: Num,
    mishapIncident: Num,
  }),
  trust: Schema.Struct({ start: Num, restorePerDay: Num, hypeWeight: Num, valuationBase: Num, valuationWeight: Num }),
  valuation: Schema.Struct({ base: Num, perShare: Num }),
});
export interface LeapfrogRules extends Schema.Schema.Type<typeof RulesSchema> {}

const PackSchema = Schema.Struct({
  id: Str,
  name: Str,
  version: Str,
  content: Schema.Struct({
    benchmarks: Schema.Struct({ add: Schema.Array(BenchmarkSchema) }),
    labs: Schema.Struct({ add: Schema.Array(LabSchema) }),
    footnotes: Schema.Struct({ add: Schema.Array(Str) }),
    headlines: Schema.Struct({ add: Schema.Array(HeadlineSchema) }),
    mishaps: Schema.Struct({ add: Schema.Array(MishapSchema) }),
    events: Schema.Struct({ add: Schema.Array(EventSchema) }),
  }),
  rules: Schema.Struct({ leapfrog: RulesSchema }),
});

/** Checks a pack (a parsed `mod.json`) and returns it typed, or throws with the path of the first thing wrong. */
export function loadLeapfrogPack(json: unknown) {
  const p = Schema.decodeUnknownSync(PackSchema)(json);
  const c = p.content;
  const benchmarks = c.benchmarks.add;
  return {
    id: p.id,
    version: p.version,
    /** Benchmarks in play from the start (nothing replaces them), and the ones that replace a solved one. */
    benchmarks,
    starters: benchmarks.filter((b) => b.replaces === undefined),
    labs: Object.fromEntries(c.labs.add.map((l) => [l.id, l] as const)) as Record<string, LabDef>,
    footnotes: c.footnotes.add,
    headlines: c.headlines.add,
    mishaps: c.mishaps.add,
    events: c.events.add as unknown as EventDef[],
    rules: p.rules.leapfrog,
  };
}

export const LEAPFROG = loadLeapfrogPack(pack);
export type LeapfrogPack = typeof LEAPFROG;

export const BENCH_BY_ID: Record<string, BenchmarkDef> = Object.fromEntries(LEAPFROG.benchmarks.map((b) => [b.id, b]));
/** The benchmark that takes over when `id` is declared solved, if the pack names one. */
export const successorOf = (id: string): BenchmarkDef | undefined => LEAPFROG.benchmarks.find((b) => b.replaces === id);
export const mishapById = (id: string): MishapDef | undefined => LEAPFROG.mishaps.find((m) => m.id === id);
