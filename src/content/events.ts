// Choice-driven event cards. Data only: a new arc is a new entry here, never an engine change.
// Templates in text: {lab} {model} {rival} {cash}. Parody only.
import type { BuildingKind } from "./buildings";
import type { Tone, WalkerKind } from "../sim/types";
import { ERAS } from "./eras";
import { cardEvents } from "../sim/disasters/pack";
import { LEAPFROG } from "./leapfrog";
import { COLLUSION } from "../sim/collusion/pack";

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
  | { type: "leapfrog"; action: LeapfrogAction };

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
  /** One to three. */
  choices: EventChoice[];
  /** Presentation: a full-screen era title card, the auction room, or Leapfrog's forced response and launch livestream. Anything else is the plain card. */
  kind?: "era" | "auction" | "response" | "stream";
  /** The stripe text at the top of the card, when it isn't the tone's ("Breaking", "Developing", ...). */
  stripe?: string;
}

export const EVENT_COOLDOWN_DAYS = 60;

export const EVENTS: EventDef[] = [
  {
    id: "waterDiscourse",
    title: "Viral post: every prompt drinks a bottle of water",
    body: "A screenshot claims each chatbot reply drinks a whole bottle of water. It has four million shares and zero citations. There are people at your gate now, with signs.",
    tone: "bad",
    // The stat only climbs once there is compute to be angry about. Day 60 (two minutes at 1x) keeps the card
    // off a brand-new campus, so the toy gets a little time before the world pushes back.
    when: { all: [{ stat: "waterDiscourse", atLeast: 30 }, { stat: "day", atLeast: 60 }] },
    choices: [
      {
        label: "Publish a 90-page water report",
        hint: "−$150K · discourse −20",
        effects: [
          { type: "cash", amount: -150_000 },
          { type: "discourse", add: -20 },
          { type: "news", text: "{lab} publishes rigorous water report; nobody reads past the abstract", tone: "joke" },
        ],
      },
      {
        label: "Build a Transparency Fountain",
        hint: "−$300K · discourse −35 · hype +5 · free Fountain",
        effects: [
          { type: "cash", amount: -300_000 },
          { type: "discourse", add: -35 },
          { type: "hype", amount: 5 },
          { type: "place", kind: "fountain", near: "gate" },
          { type: "news", text: "{lab} unveils Transparency Fountain: water you can see through, unlike the report", tone: "good" },
          { type: "thought", kind: "researcher", text: "I drank from the Transparency Fountain. It tasted like accountability.", count: 2 },
        ],
      },
      {
        label: "Say nothing, ship faster",
        hint: "hype +3 · discourse +10 · they will notice",
        effects: [
          { type: "hype", amount: 3 },
          { type: "discourse", add: 10 },
          { type: "flag", name: "ignoredWater" },
          { type: "news", text: "{lab} declines to comment on water, comments on everything else at length", tone: "joke" },
        ],
      },
    ],
  },
  {
    id: "drumCircle",
    title: "Protesters now have a drum circle",
    body: "It started as three people and a bongo. It is now a full ensemble with a lead vocalist, a merch table, and a rhythm section your servers can feel. The sign-making station has a waiting list.",
    tone: "joke",
    when: { all: [{ flag: "ignoredWater", daysAgo: 20 }, { stat: "waterDiscourse", atLeast: 40 }] },
    choices: [
      {
        label: "Send an intern with a tambourine",
        hint: "−$100K · discourse −25",
        effects: [
          { type: "cash", amount: -100_000 },
          { type: "discourse", add: -25 },
          { type: "flag", name: "ignoredWater", clear: true },
          { type: "news", text: "{lab} sends intern with tambourine to negotiate; deal reached, key change agreed", tone: "joke" },
        ],
      },
      {
        label: "Join the drum circle",
        hint: "hype +6 · discourse +5",
        effects: [
          { type: "hype", amount: 6 },
          { type: "discourse", add: 5 },
          { type: "flag", name: "ignoredWater", clear: true },
          { type: "news", text: "{lab} leadership spotted at drum circle: CEO on cowbell, Chief Scientist on 'ambient'", tone: "good" },
          { type: "thought", kind: "researcher", text: "I've never been so in sync with my team. It's a bad sign.", count: 3 },
        ],
      },
      {
        label: "Call it a listening session",
        hint: "−$40K · discourse −12",
        effects: [
          { type: "cash", amount: -40_000 },
          { type: "discourse", add: -12 },
          { type: "flag", name: "ignoredWater", clear: true },
          { type: "news", text: "{lab} rebrands protest as 'listening session'; sessions now have catering", tone: "joke" },
        ],
      },
    ],
  },
];

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
// Release Leapfrog's cards live in its pack (mods/base-leapfrog); they only ever open once its systems set their flags.
EVENTS.push(...LEAPFROG.events);
// FLT-17: the cards the disasters open (mods/base-disasters). They wait for their offer flag like the Race's cards do.
EVENTS.push(...cardEvents());
// FLT-18: ordinary cards, dormant until the pack's machine sets their offer flags.
EVENTS.push(...COLLUSION.content.events.add as EventDef[]);

export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
