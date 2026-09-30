// The Hearing (FLT-21): mods/base-hearing, direct-loaded in the FLT-15 section shape until M1b. The pack owns every
// senator, question, answer, number and verdict; the chart's guards and verbs are checked in hearing.test.ts (checking
// here would import the Vocabulary while content/events.ts is still loading).
import { Schema } from "effect";
import json from "../../../mods/base-hearing/mod.json";
import { ArcNode, EventCard, Headline, NamedCall } from "../../mods/schema";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const Answer = Schema.Struct({ trust: N, capture: N, hype: N, heat: N });
export const ANSWER_KEYS = ["earnest", "slick", "chaotic"] as const;
export type AnswerKey = (typeof ANSWER_KEYS)[number];
const Senator = Schema.Struct({
  id: S, name: S, role: S, seat: S,
  look: Schema.Struct({ skin: S, suit: S, hair: S, tie: S, glasses: Schema.Boolean }),
});
/** What summons the lab: a flag set anew (by prefix), a stat that rises or crosses a line, or days since the pack woke. */
const Trigger = Schema.Struct({
  id: S, topic: S,
  flagPrefix: Schema.optionalKey(S),
  stat: Schema.optionalKey(S), atLeast: Schema.optionalKey(N), rises: Schema.optionalKey(Schema.Boolean),
  afterDays: Schema.optionalKey(N),
  chance: Schema.optionalKey(N),
});
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) })) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
  }),
  rules: Schema.Struct({ hearing: Schema.Struct({
    senators: Schema.Array(Senator),
    questions: Schema.Record(S, Schema.Struct({ senator: S, answers: Schema.Struct({ earnest: Answer, slick: Answer, chaotic: Answer }) })),
    triggers: Schema.Array(Trigger),
    verdicts: Schema.Record(S, Schema.Struct({ title: S, line: S })),
    meters: Schema.Struct({ trustLabel: S, captureLabel: S }),
    /**
     * What a verdict sets off once the lab has left the building (FLT-56): verbs (`{lab}` and `{quote}`, the CEO's
     * latest chaotic answer, are filled in) and `count` of the pack's headlines for `trigger`, all at once.
     */
    aftermath: Schema.optionalKey(Schema.Record(S, Schema.Struct({
      calls: Schema.optionalKey(Schema.Array(NamedCall)),
      headlines: Schema.optionalKey(Schema.Struct({ trigger: S, count: N })),
    }))),
  }) }),
});
export type HearingTrigger = typeof Trigger.Type;
export type SenatorData = typeof Senator.Type;

export function loadHearingPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one hearing chart");
  const rules = p.rules.hearing;
  const cards = new Set(p.content.events.add.map((e) => e.id));
  for (const [id, q] of Object.entries(rules.questions)) {
    if (!cards.has(id)) throw new Error(`rules.hearing.questions.${id}: no card with that id in content.events`);
    if (!rules.senators.some((s) => s.id === q.senator)) throw new Error(`rules.hearing.questions.${id}.senator: no senator "${q.senator}"`);
  }
  for (const t of rules.triggers) {
    if ([t.flagPrefix, t.stat, t.afterDays].filter((x) => x !== undefined).length !== 1) throw new Error(`rules.hearing.triggers.${t.id}: give one of flagPrefix, stat or afterDays`);
  }
  for (const id of Object.keys(rules.aftermath ?? {})) {
    if (!(id in rules.verdicts)) throw new Error(`rules.hearing.aftermath.${id}: no verdict "${id}"`);
  }
  if (!cards.has(GAVEL_CARD)) throw new Error(`content.events: the pack needs a "${GAVEL_CARD}" card`);
  return { ...p, chart, rules };
}
export const GAVEL_CARD = "hearing-gavel";
export const HEARING = loadHearingPack(json);
export const PICK_PREFIX = "hearing:pick:";
/** The chart's states that are a verdict: everything that isn't waiting, summoning or in session. */
export const isVerdict = (stage: string) => stage in HEARING.rules.verdicts;
/** Days of notice between the subpoena and the session, read off the chart's `summoned` edge (for the HUD's countdown). */
export const NOTICE_DAYS = (() => {
  const raw = HEARING.chart.states.summoned?.on?.DAY;
  const edge = Array.isArray(raw) ? raw[0] : raw;
  const days = typeof edge === "object" && edge && typeof edge.guard === "object" ? edge.guard.params?.days : undefined;
  return typeof days === "number" ? days : 0;
})();
