// Direct-loaded FLT-15 sections until M1b. The pack owns every word, threshold and chart edge.
import { Schema } from "effect";
import json from "../../../mods/base-collusion/mod.json";
import { ArcNode, EventCard, Headline, Thought } from "../../mods/schema";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const numbers = <K extends string>(...keys: K[]) => Schema.Struct(Object.fromEntries(keys.map((k) => [k, N])) as Record<K, typeof N>);
const Ending = numbers("capabilityDelta", "invalidDays");
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) })) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
    thoughts: Schema.Struct({ add: Schema.Array(Thought) }),
    wikiPages: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, name: S })) }),
    heartbeats: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, text: S })) }),
  }),
  rules: Schema.Struct({ collusion: Schema.Struct({
    seeding: numbers("minDay", "minAgents", "base", "perAgent", "perCapability", "perPressure", "perUnreliability", "securityReduction", "maxChance"),
    growth: numbers("initialScore", "seeded", "spreading", "organized", "spreadDays", "organizedScore", "signScore", "exposeAge", "exposeScore"),
    investigation: numbers("days", "base", "perStaff", "stagePenalty", "maxChance", "retryDays"),
    scores: numbers("minBonus", "maxBonus"),
    signs: numbers("newsEvery", "packetEveryTicks", "packetLifetimeTicks", "gatherFromHour", "gatherUntilHour", "maxMembers"),
    endings: Schema.Struct({ contained: Ending, partlyContained: Ending, exposed: Ending }),
    frontPage: Schema.Struct({ classified: S, scandal: S }),
  }) }),
});
export function loadCollusionPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one Swarm chart");
  return { ...p, chart, rules: p.rules.collusion };
}
export const COLLUSION = loadCollusionPack(json);
export const SIGN_CARD = "collusion-sign";
export const PICK_PREFIX = "collusion:pick:";
