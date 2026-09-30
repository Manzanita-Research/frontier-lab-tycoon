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

/** What the end screen offers first (FLT-57): every ending leads somewhere. Templates as the paper's. */
const Next = Schema.Struct({
  /** "refound": Found a new lab, with a perk (the endings that stop time); "keepPlaying": time goes on. */
  action: Schema.Literals(["refound", "keepPlaying"]),
  label: S,
  /** One line under the headline: what just happened to you, and what you can do about it. */
  prompt: S,
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
  next: Next,
  paper: Paper,
});
export type EndingDef = typeof EndingDef.Type;
export type MemoForkDef = typeof MemoFork.Type;
export type PerkDef = typeof Perk.Type;
export type PerkId = PerkDef["id"];

/** A walker's line: who says it, and what. */
const Line = Schema.Struct({ kind: Schema.Literals(["researcher", "agent", "visitor", "protester"]), text: S });

/** One box on The Memo, and what ticking it does to the lab from then on (FLT-57). */
const MemoFork = Schema.Struct({
  label: S,
  /** Training runs this much faster (1.25) or slower (0.5) for the rest of the game. */
  training: N,
  /** The water discourse is multiplied by this once a day: the protest at the gate grows (Race) or goes home (Slow Down). */
  discourse: N,
  /** The lingering effect, in words, for the chip and the extra edition. */
  effects: Schema.Array(S),
  chip: S,
  /** The extra edition that goes to press the moment the box is ticked. */
  extra: Schema.Struct({ kicker: S, headline: S, deck: S }),
  /** Said out loud on campus, the moment it lands, by the first of each kind the driver finds; quoted in the extra. */
  reactions: Schema.Array(Line),
  /** Lines added to the thought pool for as long as the choice stands. */
  thoughts: Schema.Array(Line),
});

/** A perk the next lab starts with. `amount` is the perk's size: hype points, training percent, or dollars. */
const Perk = Schema.Struct({ id: Schema.Literals(["founder", "loyal", "seed"]), label: S, blurb: S, amount: N });

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
      memo: Schema.Struct({
        era: N,
        /** Days from the rumour to the card (the Memo event's `daysAgo` says the same; a test holds them together). */
        countdownDays: N,
        rumour: S,
        /** One line per day left, from the day it lands (0) up. */
        countdown: Schema.Array(S),
        race: MemoFork,
        slow: MemoFork,
      }),
      newLab: Schema.Struct({
        perks: Schema.Array(Perk),
        /** The next lab's subtitle, from Lab #2 on; past the list, `sequel` with {n}. */
        sequels: Schema.Array(S),
        sequel: S,
        loyal: Schema.Struct({ role: S, thought: S, fallback: S }),
        opening: S,
      }),
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
