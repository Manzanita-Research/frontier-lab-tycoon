// Choice-driven event cards. Data only: a new arc is a new entry here, never an engine change.
// Templates in text: {lab} {model} {rival} {cash}. Parody only.
import type { BuildingKind } from "./buildings";
import type { Tone, WalkerKind } from "../sim/types";
import { ERAS } from "./eras";
import { cardEvents } from "../sim/disasters/pack";
import { LEAPFROG } from "./leapfrog";
import { COLLUSION } from "../sim/collusion/pack";
import { HEARING } from "../sim/hearing/pack";
import { YACHT } from "../sim/yacht/pack";
import { DEFECTION, type Letter } from "../sim/defection/pack";
import { POACHING } from "../sim/poaching/pack";
import { AUDITORS } from "../sim/auditors/pack";
import { PROMISES } from "../sim/promises/pack";
import { CAPTURE } from "../sim/capture/pack";
import { FACTIONS_PACK, WATER_PACK } from "./factions";
import { ENDINGS_PACK } from "../sim/endings/pack";

/** What has to be true for an event to fire. `all` combines conditions. */
export type Condition =
  | { stat: "waterDiscourse" | "hype" | "cash" | "capability" | "day"; atLeast: number }
  /** A flag set at least this many days ago (see the `flag` effect). */
  | { flag: string; daysAgo: number }
  | { all: Condition[] };

export type Effect =
  | { type: "cash"; amount: number }
  | { type: "hype"; amount: number }
  /** Water discourse: `add` nudges it, `set` pins it. */
  | { type: "discourse"; add?: number; set?: number }
  /** Same lever in headcount terms: four points of discourse per protester. */
  | { type: "protesters"; add?: number; set?: number }
  /** Sets the flag to today's day number, or clears it. */
  | { type: "flag"; name: string; clear?: boolean }
  | { type: "news"; text: string; tone?: Tone }
  /** A burst of thought bubbles over `count` random walkers. */
  | { type: "thought"; text: string; count: number; kind?: WalkerKind }
  /** Free scenery next to the gate. */
  | { type: "place"; kind: BuildingKind; near: "gate" }
  /** One of the Race's moves (sim/race/actions.ts): a bid, a round, a price cut. */
  | { type: "race"; action: RaceAction }
  /** Release Leapfrog (FLT-27): a push (negative: a slump) to your share of the news cycle, and a nudge to trust. */
  | { type: "voice"; amount: number }
  | { type: "trust"; amount: number }
  /** The forced-response card's three answers (sim/race/leapfrog/actions.ts). */
  | { type: "leapfrog"; action: LeapfrogAction }
  /** Factions (FLT-33): nudge one faction's meter (−100 to 100), or how two factions feel about each other. */
  | { type: "faction"; id: string; amount: number }
  | { type: "relation"; a: string; b: string; amount: number };

export type LeapfrogAction = "shipNow" | "hold" | "leak";

export type RaceAction = "cutPrices" | "openRelease" | "safetyConcerns" | "bidLow" | "bidMid" | "bidAll" | "raise" | "raiseCircular";

export interface EventChoice {
  label: string;
  /** One line of what it does, shown under the label. */
  hint: string;
  effects: Effect[];
}

export interface EventDef {
  id: string;
  title: string;
  body: string;
  tone: Tone;
  when: Condition;
  /** Days before the same event may fire again. Defaults to EVENT_COOLDOWN_DAYS. */
  cooldown?: number;
  /** One to three (a pack's drama card may have four). */
  choices: EventChoice[];
  /** Presentation: a full-screen era title card, the auction room, Leapfrog's forced response and launch livestream, The Hearing's witness table (FLT-21), the yacht's leaked group chat (FLT-24), a drama card's document (FLT-26, FLT-20) the auditors' report card (FLT-19), the bill FLT-22 drafts or FLT-23's roll call. Anything else is the plain card. */
  kind?: "era" | "auction" | "response" | "stream" | "hearing" | "leak" | "drama" | "report" | "bill" | "vote";
  /** The stripe text at the top of the card, when it isn't the tone's ("Breaking", "Developing", ...). */
  stripe?: string;
  /**
   * A card for the first minutes (FLT-76): it opens on Level 1, before the ladder opens the rest, once its `when` holds,
   * without waiting for the pressure the other cards wait for. Never again after Level 1.
   */
  early?: true;
}

export const EVENT_COOLDOWN_DAYS = 60;

/**
 * The Water Discourse cards (the viral post, the drum circle, then FLT-25's documentary crew and counter-protest)
 * live in mods/base-water; they come first, as they always have. Then the Race, Leapfrog, the disasters, the Swarm,
 * and last the factions' cards (mods/base-factions), which only open when a faction's arc asks for one.
 */
export const EVENTS: EventDef[] = [...WATER_PACK.events];

const flagged = (name: string): Condition => ({ flag: name, daysAgo: 0 });
const done = (name: string): Effect => ({ type: "flag", name, clear: true });

/**
 * The Race's cards. The sim sets an `offer:*` flag when one is due (sim/race/race.ts) and the choices clear it;
 * a card with the flag set waits its turn like any other, one at a time. {braces} are filled from the race's
 * variables: {dropRival} {dropModel} {gap} {valuation} {revenue} {raise} {rank} {topRival} {bidLow} {bidMid} {bidAll}.
 */
const ERA_THOUGHTS: Record<number, [string, string]> = {
  2: ["I replaced an intern. The intern is fine. I checked. Twice.", "I used to write code. Now I approve code. It's the same job, but sadder."],
  3: ["I wrote 40,000 lines before standup. Standup is postponed indefinitely.", "I've been promoted to 'Reviewer'. I review nothing. It's a lot of work."],
  4: ["I am fine. This is fine. The curve is fine.", "I asked it to slow down. It said 'sure' and did not."],
};

const eraCard = (n: 2 | 3 | 4): EventDef => {
  const era = ERAS[n - 1]!;
  return {
    id: `era${n}`,
    kind: "era",
    stripe: `Era ${n} of 4`,
    title: `ERA ${n}: ${era.name.toUpperCase()}`,
    body: era.oneLiner,
    tone: n === 4 ? "bad" : "good",
    when: flagged(`offer:era${n}`),
    cooldown: 99_999,
    choices: [
      {
        label: era.cta,
        hint: era.changes.join(" · "),
        effects: [
          { type: "hype", amount: n === 4 ? 2 : 5 },
          { type: "thought", kind: "agent", text: ERA_THOUGHTS[n]![0], count: 2 },
          { type: "thought", kind: "researcher", text: ERA_THOUGHTS[n]![1], count: 2 },
          done(`offer:era${n}`),
        ],
      },
    ],
  };
};

const RACE_EVENTS: EventDef[] = [
  {
    id: "openWeights",
    stripe: "Open-weights drop",
    title: "{dropRival} just dropped a free model that matches yours",
    body: "{dropModel} is on a torrent, on the leaderboard and, as of this morning, in your customers' browser tabs. It is {gap} from yours and it costs nothing. Revenue per token just fell 30% for a month, and the CFO would like a word.",
    tone: "bad",
    // A day's delay: the leaderboard shuffles and the screen shakes first, then the card slams in.
    when: { flag: "offer:openWeights", daysAgo: 1 },
    cooldown: 20,
    choices: [
      {
        label: "Cut prices",
        hint: "revenue −15% for good · ends the −30% · hype +5",
        effects: [
          { type: "race", action: "cutPrices" },
          { type: "hype", amount: 5 },
          { type: "news", text: "{lab} cuts API prices 'to stay competitive', a phrase that has never once been true", tone: "neutral" },
          done("offer:openWeights"),
        ],
      },
      {
        label: "Release last year's model as “open”",
        hint: "hype +12 · {dropRival} loses momentum · the −30% stays",
        effects: [
          { type: "race", action: "openRelease" },
          { type: "hype", amount: 12 },
          { type: "news", text: "{lab} open-sources last year's model; the license includes the phrase 'in spirit'", tone: "joke" },
          { type: "thought", kind: "researcher", text: "We open-sourced the model. Legal reviewed the word 'open' for six hours.", count: 2 },
          done("offer:openWeights"),
        ],
      },
      {
        label: "Raise safety concerns",
        hint: "hype −3 · sets the flag for the Capture arc · the −30% stays",
        effects: [
          { type: "race", action: "safetyConcerns" },
          { type: "hype", amount: -3 },
          { type: "news", text: "{lab} raises 'serious safety concerns' about free models; the free models raise concerns about {lab}'s prices", tone: "joke" },
          done("offer:openWeights"),
        ],
      },
    ],
  },
  eraCard(2),
  eraCard(3),
  eraCard(4),
  {
    id: "fundingRound",
    stripe: "Funding round",
    title: "Investors offer {lab} a round at {valuation}",
    body: "You are #{rank} on the Arena, the vibes are up and the runway is short. The term sheet arrives in a font chosen to look inevitable. 'It's about the future,' says the cover note, 'and also about the next quarter.'",
    tone: "good",
    when: flagged("offer:funding"),
    cooldown: 30,
    choices: [
      {
        label: "Sign the term sheet",
        hint: "+{raise} · hype +5",
        effects: [
          { type: "race", action: "raise" },
          { type: "hype", amount: 5 },
          { type: "news", text: "{lab} raises at {valuation} valuation on {revenue} revenue; 'it's about the future'", tone: "good" },
          done("offer:funding"),
        ],
      },
      {
        label: "Make it circular",
        hint: "60% of {raise} · hype +10 · the investor is also your customer",
        effects: [
          { type: "race", action: "raiseCircular" },
          { type: "hype", amount: 10 },
          { type: "news", text: "{lab} closes a round in which the investor buys credits from {lab} in order to invest in {lab}", tone: "joke" },
          done("offer:funding"),
        ],
      },
      {
        label: "Decline: “we're default alive”",
        hint: "hype +6 · no cash · the board has questions",
        effects: [
          { type: "hype", amount: 6 },
          { type: "news", text: "{lab} declines a round, says it is 'default alive'; the board asks what that means", tone: "joke" },
          done("offer:funding"),
        ],
      },
    ],
  },
  {
    id: "computeAuction",
    kind: "auction",
    stripe: "Compute auction",
    title: "Compute auction: 40,000 GPUs, some of them working",
    body: "Lot 9 is a Datacenter-sized pile of chips, a substation and a gift shop. {topRival} and two shell companies already have their paddles up. Win it and you unlock the Datacenter (+60 compute a day, needs a power plant), with one on the house.",
    tone: "joke",
    when: flagged("offer:auction"),
    cooldown: 20,
    choices: [
      { label: "Bid low", hint: "{bidLow} · the room will laugh", effects: [{ type: "race", action: "bidLow" }, done("offer:auction")] },
      { label: "Bid mid", hint: "{bidMid} · about even odds", effects: [{ type: "race", action: "bidMid" }, done("offer:auction")] },
      { label: "Bid all-in", hint: "{bidAll} · empties the vault, probably wins", effects: [{ type: "race", action: "bidAll" }, done("offer:auction")] },
    ],
  },
];

EVENTS.push(...RACE_EVENTS);

/**
 * FLT-76: the first decision. PLAY IT reached Level 3 in under four minutes without choosing anything, so while the first
 * model trains, somebody asks about the logo. Cheap, small, and nothing rides on it (except everything, says Marketing).
 */
EVENTS.push({
  id: "theLogo",
  early: true,
  stripe: "Brand emergency",
  title: "Your first model needs a logo",
  body: "Marketing (one person, who is also Facilities) has three options and a deadline they made up. Slide 2 of the investor deck has a hole in it the exact shape of a logo.",
  tone: "neutral",
  // Two days after the first path: the Hall is up and the first model is training.
  when: { flag: "firstPath", daysAgo: 2 },
  cooldown: 99_999,
  choices: [
    {
      label: "The swirl",
      hint: "free · hype +1 · it looks like everyone else's, which is the point",
      effects: [
        { type: "hype", amount: 1 },
        { type: "news", text: "{lab} unveils its logo: a swirl. Industry observers confirm it is a swirl." },
      ],
    },
    {
      label: "A swirlier swirl",
      hint: "−$8K · hype +4 · the designer has been up for two days",
      effects: [
        { type: "cash", amount: -8_000 },
        { type: "hype", amount: 4 },
        { type: "news", text: "{lab}'s new logo is a swirl with more swirl in it. The designer is said to be resting." },
        { type: "thought", kind: "researcher", text: "The new logo looks like a cinnamon roll having a breakthrough.", count: 2 },
      ],
    },
    {
      label: "An asterisk",
      hint: "free · hype +2 · terms and conditions apply",
      effects: [
        { type: "hype", amount: 2 },
        { type: "news", text: "{lab} picks an asterisk for a logo. Readers search the page for the footnote. There is no footnote." },
      ],
    },
  ],
});
// Release Leapfrog's cards live in its pack (mods/base-leapfrog); they only ever open once its systems set their flags.
EVENTS.push(...LEAPFROG.events);

/**
 * FLT-76 (an FLT-54 follow-up): days 106 to 116 after Level 5 were the quiet stretch, after the last of Scrutiny's
 * staggered wake-ups. A minor beat for it: if the desk is busy (or the game is at 10×) the lab skips the offsite by itself
 * and says so on the ticker, so it never holds anything up.
 */
EVENTS.push({
  id: "offsite",
  stripe: "Calendar invite",
  title: "The leadership offsite",
  body: "It has been a hundred days since the outside world started paying attention. HR has booked a cabin, a facilitator and a trust fall that nobody asked for. The facilitator has already sent a pre-read.",
  tone: "neutral",
  when: { flag: "scrutinyDay", daysAgo: 106 },
  cooldown: 99_999,
  choices: [
    {
      label: "Skip it",
      hint: "free · nothing happens, which is the dream",
      effects: [{ type: "news", text: "{lab} cancels its leadership offsite. A spokesperson calls it \"a bit much\"." }],
    },
    {
      label: "Go to the cabin",
      hint: "−$40K · hype +3 · trust +2",
      effects: [
        { type: "cash", amount: -40_000 },
        { type: "hype", amount: 3 },
        { type: "trust", amount: 2 },
        { type: "thought", kind: "researcher", text: "Leadership went to a cabin. Leadership came back with a vision board.", count: 2 },
      ],
    },
    {
      label: "Send the model instead",
      hint: "free · hype +5 · trust −3",
      effects: [
        { type: "hype", amount: 5 },
        { type: "trust", amount: -3 },
        { type: "news", text: "{lab} sends its model to the leadership offsite. It wins the trust fall. Nobody catches it." },
      ],
    },
  ],
});
// FLT-17: the cards the disasters open (mods/base-disasters). They wait for their offer flag like the Race's cards do.
EVENTS.push(...cardEvents());
// FLT-18: ordinary cards, dormant until the pack's machine sets their offer flags.
EVENTS.push(...COLLUSION.content.events.add as EventDef[]);
// The Circus packs (FLT-21, FLT-24): their cards only open when their own machine asks.
EVENTS.push(...HEARING.content.events.add as EventDef[]);
EVENTS.push(...YACHT.content.events.add as EventDef[]);
// FLT-26 and FLT-20: the drama cards (a resignation letter, a manifesto, a recruiter's offer), dormant until their packs set the flags.
EVENTS.push(...DEFECTION.content.events.add as EventDef[], ...POACHING.content.events.add as EventDef[]);
// FLT-19: Evals Without Borders' notice and report card (mods/base-auditors), behind their offer flags like the rest.
EVENTS.push(...AUDITORS.content.events.add as EventDef[]);
// FLT-23 and FLT-22: the Senate's whip and roll-call cards and the bill's cards (mods/base-promises, mods/base-capture).
EVENTS.push(...PROMISES.content.events.add as EventDef[]);
EVENTS.push(...CAPTURE.content.events.add as EventDef[]);
// FLT-33 and FLT-25: the factions' and the Water Discourse's cards.
EVENTS.push(...FACTIONS_PACK.events);
// FLT-11: The Memo (mods/base-endings), dormant until the endings driver sets `offer:memo` in Era 4.
EVENTS.push(...ENDINGS_PACK.content.events.add as EventDef[]);

export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
/** How each drama card looks on screen (the letter, the email, the manifesto): templates from the packs, by card id. */
export const DRAMA_LETTERS: ReadonlyMap<string, Letter> = new Map([...DEFECTION.content.letters.add, ...POACHING.content.letters.add].filter((l) => !l.poacher).map((l) => [l.card, l]));
/** The same, in one lab's voice (FLT-56): by `card/poacher`, where the poacher is a rival id or "neo". */
const VOICED_LETTERS: ReadonlyMap<string, Letter> = new Map([...DEFECTION.content.letters.add, ...POACHING.content.letters.add].filter((l) => l.poacher).map((l) => [`${l.card}/${l.poacher}`, l]));

/** The letter for a drama card, in the voice of the lab sending it if it has one (`from` is a rival or neo lab id). */
export function dramaLetter(card: string, from?: string): Letter | undefined {
  const voice = from ? (VOICED_LETTERS.get(`${card}/${from}`) ?? (from.startsWith("neo:") ? VOICED_LETTERS.get(`${card}/neo`) : undefined)) : undefined;
  return voice ?? DRAMA_LETTERS.get(card);
}
