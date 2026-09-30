import { describe, expect, it } from "vitest";
import { formatMoney } from "../sim/format";
import { money } from "./kit/format";

describe("kit.money", () => {
  it("agrees with the game's own formatMoney", () => {
    for (const n of [0, 5, 999, 1_000, 1_234, 9_999, 10_000, 27_431, 999_999, 1_000_000, 4_040_000, 4_336_720, 2_500_000_000, -27_000, -4_500_000, 0.4, 12.5]) {
      expect(money(n), String(n)).toBe(formatMoney(n));
    }
  });
});
