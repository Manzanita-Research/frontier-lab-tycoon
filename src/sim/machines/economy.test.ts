// The economy machine on its own: transition() only.
import { initialStored, step } from "./run";
import { BAILOUT_AMOUNT, economyMachine } from "./economy";

const fresh = () => initialStored(economyMachine, { lastBailout: null });
const close = (stored: ReturnType<typeof fresh>, cash: number, day: number) => step(economyMachine, stored, { type: "DAY", cash, day });

describe("economy machine", () => {
  it("starts solvent with no bridge round on record", () => {
    expect(fresh()).toEqual({ value: "solvent", context: { lastBailout: null } });
  });

  it("stays solvent while cash is at or above zero", () => {
    expect(close(fresh(), 0, 5).stored.value).toBe("solvent");
    expect(close(fresh(), 1_000_000, 5).effects).toEqual([]);
  });

  it("wires a bridge round in when cash goes negative, and remembers the day", () => {
    const r = close(fresh(), -300_000, 7);
    expect(r.effects).toEqual([{ type: "BAILOUT", amount: BAILOUT_AMOUNT }]);
    expect(r.stored).toEqual({ value: "bailout", context: { lastBailout: 7 } });
  });

  it("warns instead of bailing out again inside the cooldown, then rescues once it is over", () => {
    const bailed = close(fresh(), -1, 10).stored;
    const warn = close(bailed, -50_000, 20);
    expect(warn.stored).toEqual({ value: "runwayWarning", context: { lastBailout: 10 } });
    expect(warn.effects).toEqual([]);
    expect(close(warn.stored, -50_000, 30).effects).toEqual([]); // day 30 - 10 = 20: not yet more than 20
    expect(close(warn.stored, -50_000, 31).stored).toEqual({ value: "bailout", context: { lastBailout: 31 } });
  });

  it("recovers to solvent when the books turn positive", () => {
    const warn = close(close(fresh(), -1, 10).stored, -5, 12).stored;
    expect(close(warn, 40_000, 13).stored.value).toBe("solvent");
  });

  it("is bankrupt when even a round leaves cash under the floor, or none is due and cash is under it", () => {
    expect(close(fresh(), -4_500_000, 3).stored.value).toBe("bankrupt");
    const recent = close(fresh(), -1, 3).stored;
    expect(close(recent, -2_500_000, 4).stored.value).toBe("bankrupt");
    expect(close(fresh(), -2_500_000, 3).stored.value).toBe("bailout"); // round brings it to -0.5M: survives
  });
});
