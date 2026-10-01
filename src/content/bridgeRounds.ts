// FLT-86: the emergency rounds, the overdraft and the warnings that come first. Data only; the economy machine
// (sim/machines/economy.ts) decides when, the driver (sim/economy.ts) books the terms.
//
// Three rounds, each smaller and dearer than the last, each a card with two ways to pay: equity (the investors take a
// cut of every dollar of revenue from then on) or dignity (Hype). After the third the bank gives you 30 days above $0,
// then it calls Macrohard.
import type { EventDef } from "./events";

export interface BridgeRound {
  /** What the board wires in. */
  amount: number;
  /** Points of the lab the equity choice gives away: revenue is multiplied by what you keep. */
  equity: number;
  /** Hype the dignity choice costs. */
  hype: number;
  /** The dignity choice also counts as an incident on the Vibes (a podcast that went badly). */
  incident: number;
  /** The toast once it's signed. `{left}` is the rounds left, in words. */
  signed: string;
  /** The ticker line. */
  news: string;
}

export const BRIDGE_ROUNDS: readonly BridgeRound[] = [
  {
    amount: 2_000_000,
    equity: 10,
    hype: 10,
    incident: 0.5,
    signed: "Round 1 of 3 signed: +$2M. {left} left, and the terms only get worse.",
    news: "{lab} closes 'opportunistic' bridge round; sources describe the opportunity as 'payroll'",
  },
  {
    amount: 1_500_000,
    equity: 15,
    hype: 15,
    incident: 1,
    signed: "Round 2 of 3 signed: +$1.5M. {left} left. The next one is on a yacht.",
    news: "{lab} raises a down round at a valuation investors describe as 'a vibe'",
  },
  {
    amount: 1_000_000,
    equity: 20,
    hype: 20,
    incident: 1.5,
    signed: "Round 3 of 3 signed: +$1M. That was the last round. Next time cash hits $0, it's the bank.",
    news: "{lab} takes 'strategic capital' from a man who would only confirm he owns a yacht",
  },
];

export const MAX_ROUNDS = BRIDGE_ROUNDS.length;
/** Days the bank lets the account sit below $0 once the rounds are gone. */
export const OVERDRAFT_DAYS = 30;

const WORDS = ["No rounds", "One round", "Two rounds", "Three rounds"];
export const roundsLeftText = (left: number) => WORDS[left] ?? `${left} rounds`;

/** The pick flags the bridge cards set; the driver books them (sim/economy.ts). */
export const BRIDGE_PICK = "pick:bridge:";
export const bridgeCardId = (round: number) => `bridge${round}`;
export const OVERDRAFT_CARD = "overdraft";

const flag = (name: string) => ({ type: "flag", name }) as const;
const clear = (name: string) => ({ type: "flag", name, clear: true }) as const;
const money = (n: number) => `$${n >= 1e6 ? `${n / 1e6}M` : `${n / 1e3}K`}`;

const CARDS: readonly { title: string; stripe: string; body: string; equity: string; dignity: string }[] = [
  {
    title: "Emergency bridge round",
    stripe: "Round 1 of 3",
    body: "{lab} is out of money. The board has found $2M \"between the couch cushions of a sovereign fund\" and would like to talk terms. There are three of these in any lab's life, and each one is worse than the last.",
    equity: "Give up 10% of the lab",
    dignity: "Do the podcast tour",
  },
  {
    title: "Down round",
    stripe: "Round 2 of 3",
    body: "Out of money again. The term sheet is in Comic Sans and the valuation is in pencil. $1.5M, and the investors have \"a few small asks\" that are not small. After this there is one round left.",
    equity: "Give up 15% of the lab",
    dignity: "Apologise on four podcasts",
  },
  {
    title: "The last round",
    stripe: "Round 3 of 3",
    body: "An investor is calling from a yacht. The line is bad. He says $1M, he says \"last time\" twice, and something about a seaplane. There is no round 4: next time the account hits $0, the bank takes over.",
    equity: "Give up 20% of the lab",
    dignity: "Livestream from his yacht",
  },
];

const roundCard = (n: number): EventDef => {
  const r = BRIDGE_ROUNDS[n - 1]!;
  const c = CARDS[n - 1]!;
  const offer = `offer:${bridgeCardId(n)}`;
  return {
    id: bridgeCardId(n),
    stripe: c.stripe,
    title: c.title,
    body: c.body,
    tone: "bad",
    // The economy machine opens it itself the night cash goes below $0 (sim/economy.ts); the flag only says it is due.
    when: { flag: offer, daysAgo: 0 },
    cooldown: 99_999,
    choices: [
      { label: c.equity, hint: `+${money(r.amount)} · investors take ${r.equity}% of all revenue from now on`, effects: [flag(`${BRIDGE_PICK}equity`), clear(offer)] },
      { label: c.dignity, hint: `+${money(r.amount)} · hype −${r.hype} · the vibes take a hit`, effects: [flag(`${BRIDGE_PICK}dignity`), clear(offer)] },
    ],
  };
};

export const BRIDGE_EVENTS: EventDef[] = [
  ...BRIDGE_ROUNDS.map((_, i) => roundCard(i + 1)),
  {
    id: OVERDRAFT_CARD,
    stripe: "No rounds left",
    title: "The bank would like a word",
    body: "{lab} is below $0 and the investors have stopped picking up. The bank will let the account sit in the red for 30 days. On day 31 it calls Macrohard, and Macrohard has always wanted a lab with a kombucha tap.",
    tone: "bad",
    when: { flag: `offer:${OVERDRAFT_CARD}`, daysAgo: 0 },
    cooldown: 0,
    choices: [
      { label: "Get back above $0", hint: `${OVERDRAFT_DAYS} days · bulldoze for refunds, let staff go, sell something`, effects: [clear(`offer:${OVERDRAFT_CARD}`)] },
    ],
  },
];

/** The warning that comes first: under two months of runway, said with what happens at $0. */
export function runwayNudge(roundsLeft: number): string {
  if (roundsLeft <= 0) return `Under 2 months of runway and no rounds left: at $0 the bank gives you ${OVERDRAFT_DAYS} days, then calls Macrohard.`;
  return `Under 2 months of runway. At $0 the board offers an emergency round (${roundsLeftText(roundsLeft).toLowerCase()} left, worse terms each time). Or bulldoze for a 50% refund, or let staff go.`;
}

/** The warning while the account is overdrawn, every day until it isn't. */
export function overdraftWarning(daysLeft: number): string {
  return daysLeft <= 1
    ? "Overdrawn: get above $0 by midnight or the bank calls Macrohard."
    : `Overdrawn: ${daysLeft} days to get back above $0, then the bank calls Macrohard.`;
}

/** The toast the day the overdraft starts and the day it ends. */
export const OVERDRAWN_TOAST = `No rounds left. The bank has given you ${OVERDRAFT_DAYS} days above $0.`;
export const RECOVERED_TOAST = "Back above $0. The bank hangs up, disappointed.";
