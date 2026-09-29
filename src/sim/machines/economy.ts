// The lab's money status: solvent -> runwayWarning -> bailout, and bankrupt when even a bridge round can't save it.
// Pure. The driver (sim/economy.ts) does the income/expense arithmetic and applies the emitted BAILOUT.
import { Schema } from "effect";
import { setupEffect } from "@xstate/effect";
import { SCENARIO } from "../../content/goals";
import type { Stored } from "./run";

/** What the board wires in when the account goes negative. */
export const BAILOUT_AMOUNT = 2_000_000;
/** Days between bridge rounds: the investors always have a few questions first. */
export const BAILOUT_COOLDOWN_DAYS = 20;

export const EconomyContext = Schema.Struct({
  /** Day of the last emergency round, or null if the board has never had to. */
  lastBailout: Schema.NullOr(Schema.Number),
});
export type EconomyContext = typeof EconomyContext.Type;

export const economyMachine = setupEffect({
  schemas: {
    context: EconomyContext,
    input: EconomyContext,
    events: {
      /** The day's books are closed: `cash` is the balance after income and expenses. */
      DAY: Schema.Struct({ cash: Schema.Number, day: Schema.Number }),
    },
    emitted: {
      /** The board wires `amount` in; the driver books it and writes the headline. */
      BAILOUT: Schema.Struct({ amount: Schema.Number }),
    },
  },
}).createMachine({
  context: ({ input }) => input,
  initial: "solvent",
  states: {
    /** Cash is at or above zero. */
    solvent: { on: { DAY: settle } },
    /** Cash is negative and the last emergency round is too recent for another. */
    runwayWarning: { on: { DAY: settle } },
    /** An emergency round landed on the most recent day. */
    bailout: { on: { DAY: settle } },
    /** Below the scenario's floor even after a round; the goals machine ends the game if the day closes there. */
    bankrupt: { on: { DAY: settle } },
  },
});

export type EconomyStored = Stored<typeof economyMachine>;

/** Every status handles the daily close the same way: decide on a bridge round, then classify the balance. */
function settle(
  { context, event }: { context: EconomyContext; event: { cash: number; day: number } },
  enq: { emit: (e: { type: "BAILOUT"; amount: number }) => void },
) {
  const due = event.cash < 0 && event.day - (context.lastBailout ?? -99) > BAILOUT_COOLDOWN_DAYS;
  if (due) enq.emit({ type: "BAILOUT", amount: BAILOUT_AMOUNT });
  const cash = due ? event.cash + BAILOUT_AMOUNT : event.cash;
  const target = cash < SCENARIO.brokeBelow ? "bankrupt" : due ? "bailout" : cash < 0 ? "runwayWarning" : "solvent";
  return { target, context: due ? { lastBailout: event.day } : context };
}
