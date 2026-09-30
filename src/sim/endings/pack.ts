// Endings (FLT-11): the pack, direct-loaded from mods/base-endings like base-collusion until FLT-15 M1b's loader takes
// over. The pack owns every word, trigger and chart edge; the engine owns the stats the triggers read and two verbs
// (`look.set`, `autopilot.start`/`stop`). Deliberately light on imports: content/events.ts reads the Memo from here.
import { Schema } from "effect";
import json from "../../../mods/base-endings/mod.json";
import { ArcNode, EventCard, NamedCall } from "../../mods/schema";

const N = Schema.Finite;
const S = Schema.NonEmptyString;

/** The front page an ending finishes on. Templates: {lab} {model} {models} {manager} {placed} {day}. */
const Paper = Schema.Struct({
  kicker: S,
  headline: S,
  deck: S,
  caption: S,
  subs: Schema.Array(S),
  classified: S,
  /** The last line, under everything (The Takeover's "Thanks for playing. We'll take it from here."). */
  signoff: S,
});

const EndingDef = Schema.Struct({
  id: S,
  title: S,
  /** The headline, short form (FLT-15's `Ending.text`). */
  text: S,
  tone: Schema.Literals(["good", "bad", "neutral"]),
  /** After the front page, can the player carry on (keep watching), or has time stopped for good? */
  keepPlaying: Schema.Boolean,
  /** Guards that must all hold, checked once a day against the ending stats (driver.ts). The first ending in the list wins. */
  trigger: Schema.Array(NamedCall),
  initial: S,
  states: Schema.Record(S, ArcNode),
  paper: Paper,
});
export type EndingDef = typeof EndingDef.Type;

const Pack = Schema.Struct({
  apiVersion: Schema.Literal(1),
  id: S,
  version: S,
  content: Schema.Struct({
    endings: Schema.Struct({ add: Schema.Array(EndingDef) }),
    events: Schema.Struct({ add: Schema.Array(EventCard) }),
  }),
  rules: Schema.Struct({
    endings: Schema.Struct({
      memo: Schema.Struct({ era: N }),
      takeover: Schema.Struct({ aheadRank: N, managerOffset: N }),
      autopilot: Schema.Struct({ everyTicks: N, aimTicks: N, kinds: Schema.Array(S), refusal: S, paid: S }),
    }),
  }),
});

export function loadEndingsPack(input: unknown) {
  const p = Schema.decodeUnknownSync(Pack)(input);
  for (const e of p.content.endings.add) {
    if (!(e.initial in e.states)) throw new Error(`content.endings.add[${e.id}].initial: no state "${e.initial}"`);
    if (!Object.values(e.states).some((n) => n.type === "final")) throw new Error(`content.endings.add[${e.id}].states: needs a final state (the front page)`);
  }
  return { ...p, endings: p.content.endings.add, rules: p.rules.endings };
}

export const ENDINGS_PACK = loadEndingsPack(json);
export const ENDINGS: readonly EndingDef[] = ENDINGS_PACK.endings;
export const ENDING_RULES = ENDINGS_PACK.rules;
export const endingById = (id: string): EndingDef | undefined => ENDINGS.find((e) => e.id === id);

/** The flag that puts The Memo on the table, and the two it leaves behind. */
export const MEMO_OFFER = "offer:memo";
export const MEMO_RACE = "memo:race";
export const MEMO_SLOW = "memo:slow";
