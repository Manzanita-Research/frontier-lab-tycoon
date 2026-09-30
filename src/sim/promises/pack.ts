// The Promise Tracker (FLT-23): mods/base-promises, direct-loaded in the FLT-15 section shape until M1b. The pack owns the
// docket (every motion, what each senator promises about it, how they lean and what passing does), the lobbyists'
// prices and the Truth-o-meter's labels. The senators are The Hearing's (FLT-21): the pack names them by id. Guards
// and verbs are checked in promises.test.ts.
import { Schema } from "effect";
import json from "../../../mods/base-promises/mod.json";
import { ArcNode, EventCard, Headline, NamedCall } from "../../mods/schema";
import { HEARING } from "../hearing/pack";

const N = Schema.Finite;
const S = Schema.NonEmptyString;
const Side = Schema.Literals(["aye", "nay"]);
const Pledge = Schema.Struct({ says: Schema.Literals(["aye", "nay", "both"]), line: S });
/** A motion: `labSide` is how the lab wants it to go; `lean` is each senator's odds of voting the lab's way before any lobbying. */
const Motion = Schema.Struct({
  id: S, title: S, summary: S, labSide: Side,
  promises: Schema.Record(S, Pledge),
  lean: Schema.Record(S, N),
  pass: Schema.Array(NamedCall), fail: Schema.Array(NamedCall),
});
const Bill = Schema.Struct({ title: S, summary: S, labSide: Side, promises: Schema.Record(S, Pledge), lean: Schema.Record(S, N) });
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) })) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
  }),
  rules: Schema.Struct({ promises: Schema.Struct({
    senators: Schema.Record(S, Schema.Struct({ lobby: N, line: S })),
    lobby: Schema.Struct({ capture: N, heat: N }),
    /** Each point of regulatory capture moves every senator this much towards the lab's side. */
    captureLean: N,
    motions: Schema.Array(Motion),
    bill: Bill,
    truth: Schema.Array(Schema.Struct({ atLeast: N, label: S })),
    unrated: S, passed: S, failed: S,
  }) }),
});
export type MotionData = typeof Motion.Type;
export type Side = typeof Side.Type;
export type PromiseData = typeof Pledge.Type;
/** What a roll call needs: a motion from the docket, or the bill FLT-22 tables. */
export interface MotionLike { id: string; title: string; summary: string; labSide: Side; promises: Readonly<Record<string, PromiseData>>; lean: Readonly<Record<string, number>> }

export const WHIP_CARD = "promises-whip";
export const ROLLCALL_CARD = "promises-rollcall";
/** The motion id FLT-22's bill goes to the floor as. */
export const BILL_MOTION = "bill";

export function loadPromisesPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one promises chart");
  const rules = p.rules.promises;
  const senators = HEARING.rules.senators.map((s) => s.id);
  const known = (id: string, at: string) => {
    if (!senators.includes(id)) throw new Error(`${at}: no senator "${id}" in The Hearing (${senators.join(", ")})`);
  };
  for (const id of Object.keys(rules.senators)) known(id, `rules.promises.senators.${id}`);
  for (const id of senators) if (!rules.senators[id]) throw new Error(`rules.promises.senators: no lobbyist's price for "${id}"`);
  for (const m of [...rules.motions, { ...rules.bill, id: BILL_MOTION }]) {
    for (const id of senators) {
      if (!m.promises[id]) throw new Error(`rules.promises.motions.${m.id}.promises: nothing promised by "${id}"`);
      if (m.lean[id] === undefined) throw new Error(`rules.promises.motions.${m.id}.lean: no lean for "${id}"`);
    }
    for (const id of [...Object.keys(m.promises), ...Object.keys(m.lean)]) known(id, `rules.promises.motions.${m.id}`);
  }
  if (rules.motions.some((m) => m.id === BILL_MOTION)) throw new Error(`rules.promises.motions: "${BILL_MOTION}" is FLT-22's bill`);
  const cards = new Set(p.content.events.add.map((e) => e.id));
  for (const id of [WHIP_CARD, ROLLCALL_CARD]) if (!cards.has(id)) throw new Error(`content.events: the pack needs a "${id}" card`);
  return { ...p, chart, rules };
}
export const PROMISES = loadPromisesPack(json);
export const PICK_PREFIX = "promises:pick:";
/** The senators, in The Hearing's order. */
export const SENATORS = HEARING.rules.senators;
export const motionById = (id: string): MotionData | undefined => PROMISES.rules.motions.find((m) => m.id === id);

/** The Truth-o-meter's label for a score (0 to 100), or "Unrated" with no record yet. */
export function truthLabel(score: number | null): string {
  if (score === null) return PROMISES.rules.unrated;
  return PROMISES.rules.truth.find((t) => score >= t.atLeast)?.label ?? PROMISES.rules.unrated;
}
