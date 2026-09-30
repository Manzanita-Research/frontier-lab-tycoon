// Regulatory Capture (FLT-22): mods/base-capture, direct-loaded in the FLT-15 section shape until M1b. The pack owns the
// chart (invited → floor → law → exposed or sunset), the five clauses (their legalese, what they really mean, how
// shameless they are, and the Vocabulary calls they make: `rival.growth`, `rival.pace`, `rival.closed`, ...), the act
// names and the backfire odds. Guards and verbs are checked in capture.test.ts.
import { Schema } from "effect";
import json from "../../../mods/base-capture/mod.json";
import { ArcNode, EventCard, Headline, NamedCall } from "../../mods/schema";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const Clause = Schema.Struct({ id: S, title: S, legal: S, plain: S, effect: S, shame: N, effects: Schema.Array(NamedCall) });
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) })) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
  }),
  rules: Schema.Struct({ capture: Schema.Struct({
    clauses: Schema.Array(Clause),
    /** How many clauses a bill may carry. */
    pick: N,
    actNames: Schema.Array(S),
    /** Days on the floor before the roll call, when the Promise Tracker (FLT-23) is not there to hold it. */
    floorDays: N,
    /** A day's odds that journalists read the file properties: base × shame × (1 + heat/heatScale) × (1 + (50 − trust)/trustScale). */
    backfire: Schema.Struct({ base: N, heatScale: N, trustScale: N }),
    /**
     * FLT-56: the leak comes with a warning. When the day's roll hits, a reporter starts asking and the story runs `days`
     * later unless the lab buries it: `cost` (× `costGrowth` for each burial before), Capture −`capture`, Heat +`heat`,
     * and each burial adds `shame` to the odds (buried stories grow back). `meter` labels the draft's projected risk.
     */
    warning: Schema.Struct({
      days: N, cost: N, costGrowth: N, capture: N, heat: N, shame: N,
      caption: S, sub: S, toast: S, buried: Schema.Array(S), buriedToast: S, broke: S,
      meter: Schema.Array(Schema.Struct({ atLeast: N, label: S })),
    }),
    author: S, reporter: S, empty: S,
  }) }),
});
export type ClauseData = typeof Clause.Type;

export const DRAFT_CARD = "capture-draft";
export const EXPOSED_CARD = "capture-exposed";

export function loadCapturePack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one capture chart");
  const rules = p.rules.capture;
  const ids = new Set<string>();
  for (const c of rules.clauses) {
    if (ids.has(c.id)) throw new Error(`rules.capture.clauses.${c.id}: two clauses with that id`);
    ids.add(c.id);
  }
  if (rules.pick < 1 || rules.pick > rules.clauses.length) throw new Error(`rules.capture.pick: between 1 and ${rules.clauses.length}`);
  if (!rules.warning.buried.length) throw new Error("rules.capture.warning.buried: at least one headline");
  if (!rules.actNames.length) throw new Error("rules.capture.actNames: the bill needs a name");
  const cards = new Set(p.content.events.add.map((e) => e.id));
  for (const id of [DRAFT_CARD, EXPOSED_CARD]) if (!cards.has(id)) throw new Error(`content.events: the pack needs a "${id}" card`);
  for (const state of ["invited", "floor", "law", "exposed"]) if (!(state in chart.states)) throw new Error(`content.arcs: the capture chart needs a "${state}" state`);
  return { ...p, chart, rules };
}
export const CAPTURE = loadCapturePack(json);
export const PICK_PREFIX = "capture:pick:";
/** Every pick key the pack's cards set (`capture:pick:<key>`). */
export const PICKS = CAPTURE.content.events.add.flatMap((e) => e.choices.flatMap((c) => c.effects.flatMap((f) => (f.type === "flag" && f.name.startsWith(PICK_PREFIX) ? [f.name.slice(PICK_PREFIX.length)] : []))));
export const clauseById = (id: string): ClauseData | undefined => CAPTURE.rules.clauses.find((c) => c.id === id);
