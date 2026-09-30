// FLT-20 Poaching War, direct-loaded in the FLT-15 section shape until M1b. The pack owns the words and numbers.
import { Schema } from "effect";
import json from "../../../mods/base-poaching/mod.json";
import { Headline, Thought } from "../../mods/schema";
import { Chart, DramaCard, Letter, NeoLines } from "../defection/pack";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const Range = Schema.Tuple([N, N]);
const Pool = Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, values: Schema.Array(S) })) });
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Chart) }),
    events: Schema.Struct({ add: Schema.Array(DramaCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
    thoughts: Schema.Struct({ add: Schema.Array(Thought) }),
    labNames: Pool,
    manifestos: Pool,
    neoLines: NeoLines,
    letters: Schema.Struct({ add: Schema.Array(Letter) }),
  }),
  rules: Schema.Struct({ poaching: Schema.Struct({
    /** How many researchers one offer goes to: the big spenders' range, everyone else's, and the FLT-9 floor. */
    targets: Schema.Struct({ big: Range, other: Range, floor: N }),
    bigPoachers: Schema.Array(S),
    restDays: N,
    found: Schema.Struct({ chance: N, startShare: N, startHype: N, delayDays: N }),
    personality: Schema.Struct({ cadence: N, growth: N, openness: N, poaching: N, hypeHunger: N }),
  }) }),
});

export function loadPoachingPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one Poaching chart");
  const pool = (section: typeof p.content.labNames) => section.add[0]?.values ?? [];
  return { ...p, chart, rules: p.rules.poaching, names: pool(p.content.labNames), manifestos: pool(p.content.manifestos) };
}
export const POACHING = loadPoachingPack(json);
export const CARD = "poaching-offer";
export const PICK_PREFIX = "poaching:pick:";
export const CHOICES = ["match", "remind", "letgo"] as const;
