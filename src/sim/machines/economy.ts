// The lab's money status (FLT-86): solvent -> offered -> funded, three times at most, then overdrawn -> bankrupt.
// Pure. The driver (sim/economy.ts) does the income/expense arithmetic, opens the cards and books the terms.
//
// The night cash goes below $0 the board offers an emergency round (a card; the game waits for the answer). The
// player signs it (SIGNED), giving up equity or dignity. After the last round, below $0 means the overdraft: 30 days
// to get back above $0, or bankrupt, which is the end (Acqui-hired, or the goals' loss when the endings are off).
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { MAX_ROUNDS, OVERDRAFT_DAYS } from "../../content/bridgeRounds";
import type { Stored } from "./run";

export const EconomyContext = Schema.Struct({
  /** Day of the last emergency round, or null if the board has never had to. */
  lastBailout: Schema.NullOr(Schema.Number),
  /** Emergency rounds signed so far, 0 to MAX_ROUNDS. */
  rounds: Schema.Number,
  /** The share of the lab (and of its revenue) still yours, 0 to 100. Equity rounds cut it. */
  stake: Schema.Number,
  /** While overdrawn: the day the bank calls Macrohard. Null otherwise. */
  overdraftDay: Schema.NullOr(Schema.Number),
});
export type EconomyContext = typeof EconomyContext.Type;

export const FRESH_ECONOMY: EconomyContext = { lastBailout: null, rounds: 0, stake: 100, overdraftDay: null };

export const economyMachine = setupEffect({
  schemas: {
    context: EconomyContext,
    input: EconomyContext,
    events: {
      /** The day's books are closed: `cash` is the balance after income and expenses. */
      DAY: Schema.Struct({ cash: Schema.Number, day: Schema.Number }),
      /** The player signed the round on the card: `equity` points of the lab given up (0 if they paid in dignity). */
      SIGNED: Schema.Struct({ day: Schema.Number, equity: Schema.Number }),
    },
    emitted: {
      /** Round `round` (1-based) is on the table: the driver opens its card. */
      OFFER: Schema.Struct({ round: Schema.Number }),
      /** Round `round` is signed: the driver wires the money in and books the terms. */
      FUNDED: Schema.Struct({ round: Schema.Number }),
      /** Cash recovered before the offer was signed: the driver takes the card off the table. */
      WITHDRAWN: Schema.Struct({}),
      /** No rounds left and below $0: the bank's clock starts, `deadline` is the day it runs out. */
      OVERDRAWN: Schema.Struct({ deadline: Schema.Number }),
      /** Back above $0 while overdrawn. */
      RECOVERED: Schema.Struct({}),
      /** The clock ran out. */
      BANKRUPT: Schema.Struct({}),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "solvent",
  states: {
    /** Cash is at or above zero. */
    solvent: { on: { DAY: settle } },
    /** A round is on the table (its card is up, or waits for the screen). */
    offered: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.cash >= 0) {
            enq.emit({ type: "WITHDRAWN" });
            return { target: "solvent", context };
          }
          return { target: "offered", context };
        },
        SIGNED: ({ context, event }, enq) => {
          const rounds = context.rounds + 1;
          enq.emit({ type: "FUNDED", round: rounds });
          return { target: "funded", context: { ...context, rounds, lastBailout: event.day, stake: Math.max(0, context.stake - event.equity) } };
        },
      },
    },
    /** A round landed; from the next close it behaves like solvent (another round if cash is still below $0). */
    funded: { on: { DAY: settle } },
    /** No rounds left, below $0, and the bank's clock is running. */
    overdrawn: {
      on: {
        DAY: ({ context, event }, enq) => {
          if (event.cash >= 0) {
            enq.emit({ type: "RECOVERED" });
            return { target: "solvent", context: { ...context, overdraftDay: null } };
          }
          if (event.day >= (context.overdraftDay ?? event.day)) {
            enq.emit({ type: "BANKRUPT" });
            return { target: "bankrupt", context };
          }
          return { target: "overdrawn", context };
        },
      },
    },
    /** The bank called Macrohard. The endings (or the goals) end the game. */
    bankrupt: { type: "final" },
  },
});

export type EconomyStored = Stored<typeof economyMachine>;

/** Solvent and funded handle the daily close alike: below $0 is the next round, or the overdraft once they're gone. */
function settle(
  { context, event }: { context: EconomyContext; event: { cash: number; day: number } },
  enq: { emit: (e: { type: "OFFER"; round: number } | { type: "OVERDRAWN"; deadline: number }) => void },
) {
  if (event.cash >= 0) return { target: "solvent", context };
  if (context.rounds < MAX_ROUNDS) {
    enq.emit({ type: "OFFER", round: context.rounds + 1 });
    return { target: "offered", context };
  }
  const deadline = event.day + OVERDRAFT_DAYS;
  enq.emit({ type: "OVERDRAWN", deadline });
  return { target: "overdrawn", context: { ...context, overdraftDay: deadline } };
}
