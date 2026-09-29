// Choice-driven event cards. Data only: a new arc is a new entry here, never an engine change.
// Templates in text: {lab} {model} {rival} {cash}. Parody only.
import type { BuildingKind } from "./buildings";
import type { Tone, WalkerKind } from "../sim/types";

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
  | { type: "place"; kind: BuildingKind; near: "gate" };

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
}

export const EVENT_COOLDOWN_DAYS = 60;

export const EVENTS: EventDef[] = [
  {
    id: "waterDiscourse",
    title: "Viral post: every prompt drinks a bottle of water",
    body: "A screenshot claims each chatbot reply drinks a whole bottle of water. It has four million shares and zero citations. There are people at your gate now, with signs.",
    tone: "bad",
    // The discourse stat only climbs once there is compute to be angry about; day 30 keeps the card off a brand-new campus.
    when: { all: [{ stat: "waterDiscourse", atLeast: 30 }, { stat: "day", atLeast: 30 }] },
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

export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);
