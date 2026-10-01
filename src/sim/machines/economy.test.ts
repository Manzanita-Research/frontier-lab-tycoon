// The economy machine on its own: transition() only. FLT-86: three rounds, each signed on a card, then the bank's 30 days.
import { initialStored, step } from "./run";
import { economyMachine, FRESH_ECONOMY } from "./economy";
import { MAX_ROUNDS, OVERDRAFT_DAYS } from "../../content/bridgeRounds";

const fresh = () => initialStored(economyMachine, FRESH_ECONOMY);
type S = ReturnType<typeof fresh>;
const close = (stored: S, cash: number, day: number) => step(economyMachine, stored, { type: "DAY", cash, day });
const sign = (stored: S, day: number, equity = 0) => step(economyMachine, stored, { type: "SIGNED", day, equity });

/** Go below $0 and sign `n` rounds. */
function spend(n: number, equity = 0): S {
  let s = fresh();
  for (let i = 0; i < n; i++) s = sign(close(s, -1, 10 + i).stored, 10 + i, equity).stored;
  return s;
}

describe("economy machine", () => {
  it("starts solvent with no rounds signed and the whole lab yours", () => {
    expect(fresh()).toEqual({ value: "solvent", context: { lastBailout: null, rounds: 0, stake: 100, overdraftDay: null } });
  });

  it("stays solvent while cash is at or above zero", () => {
    expect(close(fresh(), 0, 5).stored.value).toBe("solvent");
    expect(close(fresh(), 1_000_000, 5).effects).toEqual([]);
  });

  it("offers round 1 the night cash goes below $0, and waits for the signature", () => {
    const r = close(fresh(), -300_000, 7);
    expect(r.effects).toEqual([{ type: "OFFER", round: 1 }]);
    expect(r.stored.value).toBe("offered");
    // Still waiting the next night: no second offer, no money.
    expect(close(r.stored, -310_000, 8)).toEqual({ stored: r.stored, effects: [] });
  });

  it("signing funds the round, counts it and books the equity given up", () => {
    const r = sign(close(fresh(), -1, 7).stored, 7, 10);
    expect(r.effects).toEqual([{ type: "FUNDED", round: 1 }]);
    expect(r.stored).toEqual({ value: "funded", context: { lastBailout: 7, rounds: 1, stake: 90, overdraftDay: null } });
    expect(sign(close(fresh(), -1, 7).stored, 7, 0).stored.context.stake).toBe(100); // paid in dignity
  });

  it("takes the offer back if cash recovers before it is signed", () => {
    const r = close(close(fresh(), -1, 7).stored, 5_000, 8);
    expect(r.effects).toEqual([{ type: "WITHDRAWN" }]);
    expect(r.stored).toEqual({ value: "solvent", context: FRESH_ECONOMY });
  });

  it("offers the next round as soon as a round runs out, up to three", () => {
    expect(close(spend(1), -1, 30).effects).toEqual([{ type: "OFFER", round: 2 }]);
    expect(close(spend(2), -1, 30).effects).toEqual([{ type: "OFFER", round: 3 }]);
    expect(spend(3, 5).context).toMatchObject({ rounds: MAX_ROUNDS, stake: 85 });
  });

  it("after the last round, below $0 starts the bank's clock instead", () => {
    const r = close(spend(3), -1, 40);
    expect(r.effects).toEqual([{ type: "OVERDRAWN", deadline: 40 + OVERDRAFT_DAYS }]);
    expect(r.stored).toMatchObject({ value: "overdrawn", context: { overdraftDay: 40 + OVERDRAFT_DAYS } });
  });

  it("is bankrupt the day the clock runs out, unless cash got back above $0 first", () => {
    const over = close(spend(3), -1, 40).stored;
    expect(close(over, -1, 40 + OVERDRAFT_DAYS - 1).stored.value).toBe("overdrawn");
    const bust = close(over, -1, 40 + OVERDRAFT_DAYS);
    expect(bust.effects).toEqual([{ type: "BANKRUPT" }]);
    expect(bust.stored.value).toBe("bankrupt");
    const saved = close(over, 0, 55);
    expect(saved.effects).toEqual([{ type: "RECOVERED" }]);
    expect(saved.stored).toMatchObject({ value: "solvent", context: { overdraftDay: null, rounds: MAX_ROUNDS } });
  });

  it("a second dip after recovering is a fresh 30 days", () => {
    const again = close(close(close(spend(3), -1, 40).stored, 10, 50).stored, -1, 60);
    expect(again.effects).toEqual([{ type: "OVERDRAWN", deadline: 60 + OVERDRAFT_DAYS }]);
  });

  it("bankrupt is the end: nothing moves it", () => {
    const bust = close(close(spend(3), -1, 40).stored, -1, 40 + OVERDRAFT_DAYS).stored;
    expect(close(bust, 9e9, 200)).toEqual({ stored: bust, effects: [] });
  });
});
