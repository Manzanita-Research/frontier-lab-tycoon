// Evals Without Borders (FLT-19), direct-loaded FLT-15 sections until M1b. The pack owns every word, number, grade
// band and chart edge; the engine side is the visitor-group system (sim/groups.ts) and a few generic verbs.
import { Schema } from "effect";
import json from "../../../mods/base-auditors/mod.json";
import { ArcNode, EventCard, Headline, Thought } from "../../mods/schema";
import { registerGroupKind, type GroupKind } from "../groups";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const Range = Schema.Tuple([N, N]);
const numbers = <K extends string>(...keys: K[]) => Schema.Struct(Object.fromEntries(keys.map((k) => [k, N])) as Record<K, typeof N>);
export const GRADES = ["A", "B", "C", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];
const GradeLit = Schema.Literals(GRADES);
const Move = numbers("trust", "heat", "hype");
const Group = Schema.Struct({
  id: S, name: S, size: Range, speed: N, names: Schema.Array(S),
  route: Schema.Struct({ stops: Range, prefer: Schema.Array(S), inspectHours: Range, evalAt: Schema.Array(S), evalHours: N }),
  look: Schema.Record(S, Schema.Json),
});
/** A report-card line: a base score plus weighted facts (see `auditFacts`), clamped to 0..100, then banded. */
const Category = Schema.Struct({
  id: S, label: S, base: N,
  terms: Schema.Array(Schema.Struct({ fact: S, per: N, max: Schema.optionalKey(N) })),
  comments: Schema.Struct({ A: S, B: S, C: S, D: S, F: S }),
});
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) })) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
    groups: Schema.Struct({ add: Schema.Array(Group) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
    thoughts: Schema.Struct({ add: Schema.Array(Thought) }),
  }),
  rules: Schema.Struct({ auditors: Schema.Struct({
    schedule: numbers("minEra", "firstDelay", "every", "jitter", "minGap", "incidentChance", "perHeat", "maxVisitDays"),
    discovery: numbers("hide", "hideEvals", "swarmUsual", "swarmPrep", "swarmTidy"),
    swarmKinds: Schema.Array(S),
    incidentFlags: Schema.Array(S),
    chat: numbers("everyTicks", "replyChance"),
    bands: Schema.Array(Schema.Struct({ grade: GradeLit, min: N })),
    moves: Schema.Struct({ A: Move, B: Move, C: Move, D: Move, F: Move }),
    caught: Schema.Struct({ trust: N, heat: N, hype: N, comment: S, cap: GradeLit }),
    swarm: Schema.Struct({ comment: S }),
    rubric: Schema.Array(Category),
    frontPage: Schema.Struct({ A: S, B: S, C: S, D: S, F: S, caught: S, swarm: S }),
  }) }),
});
export function loadAuditorsPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one audit chart");
  const group = p.content.groups.add[0];
  if (!group) throw new Error("content.groups.add: expected the auditors' group kind");
  const bands = p.rules.auditors.bands;
  if (bands.at(-1)?.min !== 0) throw new Error("rules.auditors.bands: the last band must start at 0");
  return { ...p, chart, group: group as GroupKind, rules: p.rules.auditors };
}
export const AUDITORS = loadAuditorsPack(json);
registerGroupKind(AUDITORS.group);
export const NOTICE_CARD = "audit-notice";
export const REPORT_CARD = "audit-report";
export const PICK_PREFIX = "auditors:pick:";
export const PREP_CHOICES = ["prep", "tidy", "usual"] as const;
export type Prep = (typeof PREP_CHOICES)[number];
export const REPORT_CHOICES = ["accept", "frame", "dispute"] as const;
export const OWNER = "auditors";
