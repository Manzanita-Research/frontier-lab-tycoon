// The yacht summit (FLT-24): mods/base-yacht, direct-loaded in the FLT-15 section shape until M1b. The pack owns the
// invitation, the chart's timing, the leaked chat's every line and the price-fixing headlines. Its guards and verbs are
// checked in yacht.test.ts.
import { Schema } from "effect";
import json from "../../../mods/base-yacht/mod.json";
import { ArcNode, EventCard, Headline } from "../../mods/schema";

const S = Schema.NonEmptyString;
const Line = Schema.Struct({ from: S, time: S, text: S });
const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1), id: S, version: S,
  content: Schema.Struct({
    arcs: Schema.Struct({ add: Schema.Array(Schema.Struct({ id: S, initial: S, states: Schema.Record(S, ArcNode) })) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
    headlines: Schema.Struct({ add: Schema.Array(Headline) }),
  }),
  rules: Schema.Struct({ yacht: Schema.Struct({
    yachtName: S, groupName: S,
    /** The leaked chat, by how the lab answered the invitation ("signed" covers the intern too). */
    chat: Schema.Struct({ signed: Schema.Array(Line), declined: Schema.Array(Line) }),
    ticker: Schema.Struct({ days: Schema.Finite, every: Schema.Finite }),
  }) }),
});
export function loadYachtPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  const chart = p.content.arcs.add[0];
  if (!chart || p.content.arcs.add.length !== 1) throw new Error("content.arcs.add: expected one yacht chart");
  return { ...p, chart, rules: p.rules.yacht };
}
export const YACHT = loadYachtPack(json);
export const PICK_PREFIX = "yacht:pick:";
/** Every pick key the pack's cards set (`yacht:pick:<key>`). */
export const PICKS = YACHT.content.events.add.flatMap((e) => e.choices.flatMap((c) => c.effects.flatMap((f) => (f.type === "flag" && f.name.startsWith(PICK_PREFIX) ? [f.name.slice(PICK_PREFIX.length)] : []))));
export const ENDINGS = ["denied", "apologised", "blamed"] as const;
