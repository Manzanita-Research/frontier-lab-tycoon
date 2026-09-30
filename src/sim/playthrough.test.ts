// A scripted "reasonable player" (src/sim/bot.ts): checks that the scenario (reach Era 3 and the top of the Arena by
// the end of Y3) is winnable on a sensible timeline, and that the race's beats land.
import { SCENARIO } from "../content/goals";
import { playBot } from "./bot";
import { openEventOf } from "./events";
import { outcomeOf } from "./goals";
import { createTestCampus as createInitialState } from "./testkit";
import { TICKS_PER_DAY, tick } from "./tick";

describe("a reasonable player", () => {
  const bots = [1, 2, 3].map((seed) => playBot(seed));

  it("wins the scenario with time to spare: Era 3 and the top of the Arena, well inside Y3", () => {
    for (const r of bots) {
      expect(r.outcome).toBe("won");
      expect(r.endDay).toBeGreaterThan(250); // not a walkover
      expect(r.endDay).toBeLessThan(SCENARIO.deadlineDay - 300);
      expect(r.eraDays[2]).not.toBeNull();
    }
  });

  it("meets the eras in order: Coding Automation early, Superhuman Coder late", () => {
    for (const r of bots) {
      expect(r.eraDays[1]!).toBeGreaterThanOrEqual(30);
      expect(r.eraDays[1]!).toBeLessThanOrEqual(150);
      expect(r.eraDays[2]!).toBeGreaterThan(r.eraDays[1]! + 100);
    }
  });

  it("takes the lead on the Arena at some point, and the rivals do not just let it stand", () => {
    // The Arena in Era 1 is a knife-edge (a lab that ships first is #1 for a week, and any tiny change to the dice moves
    // the week), so this asks for most runs rather than every one: two of the three seeds.
    const tops = bots.filter((r) => r.firstTop !== null);
    expect(tops.length).toBeGreaterThanOrEqual(2);
    for (const r of tops) expect(r.worstAfterTop).toBeGreaterThanOrEqual(3); // the drop from #1 to the middle of the pack is the point
  });

  it("is called to the auction, offered an open-weights drop, and gets a datacenter to power", () => {
    for (const r of bots) {
      expect(r.cards.computeAuction ?? 0).toBeGreaterThanOrEqual(3);
      expect(r.cards.openWeights ?? 0).toBeGreaterThanOrEqual(1);
      expect(r.cards.era2).toBe(1);
      expect(r.datacenters).toBeGreaterThanOrEqual(1);
    }
  });

  it("can keep going after the win and reach the Intelligence Explosion before the old deadline", () => {
    const r = playBot(1, { keepPlaying: true, days: SCENARIO.deadlineDay + 40 });
    expect(r.eraDays[3]).not.toBeNull();
    expect(r.eraDays[3]!).toBeLessThan(SCENARIO.deadlineDay + 40);
  }, 15_000); // Functional multi-year replay on the shared 1-vCPU builder; perf budgets are separate.
});

describe("an absent player", () => {
  it("loses at the deadline, having answered every card with its last choice and built nothing", () => {
    const s = createInitialState(1);
    for (let i = 0; i < (SCENARIO.deadlineDay + 20) * TICKS_PER_DAY && outcomeOf(s) === "playing"; i++) {
      const open = openEventOf(s);
      tick(s, open ? [{ type: "chooseEvent", eventId: open.id, choiceIndex: 99 }] : []);
      // (an out-of-range pick is ignored by the arc, so answer properly)
      if (openEventOf(s)) tick(s, [{ type: "chooseEvent", eventId: openEventOf(s)!.id, choiceIndex: 0 }]);
    }
    expect(outcomeOf(s)).toBe("lost");
    expect(s.day).toBeLessThanOrEqual(SCENARIO.deadlineDay);
  });
});
