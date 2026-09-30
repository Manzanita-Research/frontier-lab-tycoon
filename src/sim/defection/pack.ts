// Direct-loaded FLT-15 sections until M1b. The pack owns every word, threshold and chart edge.
import { Schema } from "effect";
import json from "../../../mods/base-defection/mod.json";
import { ArcNode, EventCard, EventChoice, Headline, Thought } from "../../mods/schema";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const numbers = <K extends string>(...keys: K[]) => Schema.Struct(Object.fromEntries(keys.map((k) => [k, N])) as Record<K, typeof N>);
/** The card schema, but a defection card has four answers (the shared one stops at three). */
export const DramaCard = Schema.Struct({
  ...EventCard.fields,
  choices: Schema.Array(EventChoice).check(Schema.isBetweenLength(1, 4)),
});
export const Chart = Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) });
const Pool = Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, values: Schema.Array(S) })) });
const Personality = numbers("cadence", "growth", "openness", "poaching", "hypeHunger");
export const NeoLines = Schema.Struct({ release: Schema.Array(S), poach: Schema.Array(S), nemesis: Schema.Array(S), goodwill: Schema.Array(S) });
/** What a drama card looks like on screen: the resignation letter, the recruiter's email, the manifesto. Templates, like the card. */
export const Letter = Schema.Struct({
  card: S, style: Schema.Literals(["letter", "email", "manifesto"]), file: S, from: S, to: S, subject: S, lines: Schema.Array(S), sign: S,
});
export type Letter = typeof Letter.Type;
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Chart) }),
    events: Schema.Struct({ add: Schema.Array(DramaCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
    thoughts: Schema.Struct({ add: Schema.Array(Thought) }),
    reasons: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, text: S, titleOdds: N })) }),
    labNames: Pool,
    manifestos: Pool,
    neoLines: NeoLines,
    letters: Schema.Struct({ add: Schema.Array(Letter) }),
  }),
  rules: Schema.Struct({ defection: Schema.Struct({
    eligibility: numbers("minResearchers", "minTenureDays", "candidates"),
    score: numbers("base", "morale", "seniority", "passedOver", "rivalHype", "contentDecay", "contentHappiness", "bump", "courtBoost"),
    eras: Schema.Array(N),
    thresholds: numbers("courtScore", "cardScore", "coolScore"),
    signs: numbers("meetEveryDays", "headlineDay", "thoughtEveryDays", "minWarnDays", "gapDays"),
    exit: numbers("minLoss", "maxLoss", "minFollowers", "maxFollowers", "restDays", "followerHappiness"),
    spinout: numbers("startShare", "startHype", "hostileBoost"),
    personality: Schema.Struct({ friendly: Personality, hostile: Personality }),
  }) }),
});

export function loadDefectionPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one Defection chart");
  const pool = (section: typeof p.content.labNames, id: string) => {
    const found = section.add.find((x) => x.id === id);
    if (!found) throw new Error(`expected a "${id}" pool`);
    return found.values;
  };
  return {
    ...p, chart, rules: p.rules.defection,
    names: { friendly: pool(p.content.labNames, "friendly"), hostile: pool(p.content.labNames, "hostile") },
    manifestos: { friendly: pool(p.content.manifestos, "friendly"), hostile: pool(p.content.manifestos, "hostile") },
  };
}
export const DEFECTION = loadDefectionPack(json);
export const CARD = "defection-card";
export const MANIFESTO_CARD = "defection-manifesto";
export const PICK_PREFIX = "defection:pick:";
export const CHOICES = ["counter", "equity", "title", "goodbye"] as const;
export const MANIFESTO_CHOICES = ["congratulate", "vaguepost", "silence"] as const;
