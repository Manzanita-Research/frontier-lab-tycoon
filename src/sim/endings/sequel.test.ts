// FLT-57: no dead ends. Every ending leads somewhere, the two that stop time found a new lab with one perk, The Memo
// counts down and leaves an aftermath, Captured fires from the Capture meter, and Escaped has a hook but no fake.
import { SCENARIO } from "../../content/goals";
import { eventById } from "../../content/events";
import { THOUGHTS } from "../../content/thoughts";
import { BAILOUT_AMOUNT } from "../machines/economy";
import { openEventOf } from "../events";
import { activeConditions } from "../thoughts";
import { createInitialState } from "../state";
import { createRng } from "../rng";
import { answer, createTestCampus } from "../testkit";
import { createMidgameScenario } from "../scenarios/midgame";
import { TICKS_PER_DAY, tick } from "../tick";
import type { GameState } from "../types";
import { VERBS, runVerb } from "../verbs";
import { ENDING_STATS } from "./driver";
import { applyLineage, labNumberOf, lineagePace, loyalCandidate, nextLabName, refoundView, sequelSuffix, trainingPace } from "./lineage";
import { dailyMemo, memoView, offerMemo } from "./memo";
import { ENDING_RULES, ENDINGS } from "./pack";
import { enableEndings } from "./state";
import { endingsView } from "./view";

function play(s: GameState, days: number, memo = 0, done: (s: GameState) => boolean = () => false) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    tick(s, open ? [{ type: "chooseEvent", eventId: open.id, choiceIndex: open.id === "memo" ? memo : 0 }] : []);
  }
}

const staged = (seed = 1) => {
  const s = createTestCampus(seed);
  enableEndings(s);
  return s;
};

/** The curated mid-game campus (cards open there: a model is out, the money comes in), with the endings on. */
const midgame = () => {
  const s = createMidgameScenario();
  enableEndings(s);
  return s;
};

/** A lab that went bust: Acqui-hired, front page out, time stopped. */
function acquihired(seed = 1) {
  const s = staged(seed);
  s.cash = SCENARIO.brokeBelow - BAILOUT_AMOUNT - 100_000;
  play(s, 30, 0, (w) => w.endings!.endedDay !== null);
  expect(s.endings!.id).toBe("acquihired");
  return s;
}

describe("every ending ends with a next action", () => {
  it("Acqui-hired and The Pivot found a new lab; the endings that keep going say so", () => {
    const next = Object.fromEntries(ENDINGS.map((e) => [e.id, e.next.action]));
    expect(next).toEqual({ captured: "keepPlaying", acquihired: "refound", takeover: "keepPlaying", regulated: "keepPlaying", pivot: "refound" });
    // A button that says "keep playing" only where time really does go on.
    for (const e of ENDINGS) expect(e.next.action === "keepPlaying", e.id).toBe(e.keepPlaying);
  });

  it("the Acqui-hired front page offers three perks, named for this lab", () => {
    const s = acquihired();
    const v = endingsView(s)!;
    expect(v.ending!.next).toMatchObject({ action: "refound", label: "Found a new lab" });
    expect(v.refound!.labNumber).toBe(2);
    expect(v.refound!.name).toBe(`${s.labName} 2: This Time It's Aligned`);
    expect(v.refound!.perks.map((p) => p.id)).toEqual(["founder", "loyal", "seed"]);
    expect(v.refound!.perks[1]!.blurb).toContain(loyalCandidate(s)!.name);
    expect(v.refound!.perks[2]!.blurb).toContain("$2M");
  });
});

describe("Found a new lab", () => {
  const next = (prev: GameState, perk: "founder" | "loyal" | "seed", seed = 7) => {
    const s = createInitialState(seed);
    enableEndings(s);
    applyLineage(s, prev, perk);
    return s;
  };

  it("names the sequel, numbers it, and skips the coach", () => {
    const prev = acquihired();
    const s = next(prev, "seed");
    expect(s.labName).toBe(`${prev.labName} 2: This Time It's Aligned`);
    expect(labNumberOf(s)).toBe(2);
    expect(s.lineage).toMatchObject({ lab: 2, founder: prev.labName, perk: "seed", from: { lab: prev.labName, ending: "acquihired" } });
    expect(s.coach?.value ?? "skipped").toBe("skipped");
    expect(s.news.at(-1)!.text).toBe(`${s.labName} opens its doors. Same founder, new gate, fresh kombucha`);
    expect(endingsView(s)!.summary.split("\n")[0]).toContain("Lab #2");
    // Lab #3 keeps the founder's name, not the sequel's.
    const third = next(s, "founder", 8);
    expect(third.labName).toBe(`${prev.labName} 3: Return Of The Founder`);
    expect(nextLabName(third)).toBe(`${prev.labName} 4: Back In Stealth Mode`);
    expect(sequelSuffix(40)).toBe("40: We Mean It This Time");
  });

  it("each perk does what it says", () => {
    const prev = acquihired();
    const plain = createInitialState(7);
    expect(next(prev, "founder").hype).toBe(Math.min(100, plain.hype + 25));
    expect(next(prev, "seed").cash).toBe(plain.cash + 2_000_000);
    const loyal = next(prev, "loyal");
    const who = loyal.walkers.find((w) => w.id === loyal.lineage!.loyal!.id)!;
    expect(who.name).toBe(loyalCandidate(prev)!.name);
    expect(who.role).toBe("Followed you here");
    expect(loyal.thoughts.find((t) => t.walkerId === who.id)!.text).toBe("I followed you here. Don't make it weird.");
    expect(lineagePace(loyal)).toBeCloseTo(1.1);
    // Only while they stay.
    loyal.walkers = loyal.walkers.filter((w) => w !== who);
    expect(lineagePace(loyal)).toBe(1);
  });

  it("draws no dice: the new seed's World is the one a first lab on that seed gets, bar the perk", () => {
    const prev = acquihired();
    const s = next(prev, "seed");
    const plain = createInitialState(7);
    expect(s.rngState).toBe(plain.rngState);
    expect(s.walkers.map((w) => [w.x, w.z])).toEqual(plain.walkers.map((w) => [w.x, w.z]));
  });

  it("a first lab has no lineage, and training runs at the usual pace", () => {
    const s = staged();
    expect(s.lineage).toBeUndefined();
    expect(labNumberOf(s)).toBe(1);
    expect(trainingPace(s)).toBe(1);
    expect(refoundView(s).name).toBe(`${s.labName} 2: This Time It's Aligned`);
  });
});

describe("The Memo: a countdown, then an aftermath", () => {
  it("the card lands the day the countdown runs out", () => {
    expect(eventById("memo")!.when).toMatchObject({ flag: "offer:memo", daysAgo: ENDING_RULES.memo.countdownDays });
    expect(ENDING_RULES.memo.countdown.length).toBe(ENDING_RULES.memo.countdownDays + 1);
  });

  it("counts down one line a day from the rumour to the card", () => {
    const s = midgame();
    play(s, 1);
    offerMemo(s);
    expect(s.news.at(-1)!.text).toBe(`A memo is going round ${s.labName}. Nobody has read page two yet`);
    const seen: [number, string][] = [];
    // The train's packs open their own cards in these days: answer them, and stop only at the Memo.
    const memoOpen = () => openEventOf(s)?.id === "memo";
    for (let d = 0; d < 12 && !memoOpen(); d++) {
      const m = memoView(s)!;
      seen.push([m.daysLeft, m.line]);
      for (let i = 0; i < TICKS_PER_DAY && !memoOpen(); i++) tick(s, answer(s));
    }
    // If another card holds the desk on the due day, the Memo waits on day 0 ("It's on your desk.") until it is free.
    const onTime = seen.filter(([d]) => d > 0);
    expect(onTime.map(([d]) => d)).toEqual([5, 4, 3, 2, 1]);
    expect(seen.slice(onTime.length).every(([d]) => d === 0)).toBe(true);
    expect(onTime.at(-1)![1]).toBe("It's on your desk tomorrow.");
    expect(seen[0]![1]).toBe("Page one is a chart.");
    expect(openEventOf(s)?.id).toBe("memo");
  });

  for (const [choice, index] of [["race", 0], ["slow", 1]] as const) {
    it(`${choice}: three named staff react, the extra goes to press, and it lingers`, () => {
      const s = midgame();
      play(s, 1);
      offerMemo(s);
      play(s, 12, index, (w) => w.endings!.memo !== undefined); // FLT-54: the card budget can hold it a few days on "It's on your desk."
      const e = s.endings!;
      expect(e.memo!.choice).toBe(choice);
      const fork = ENDING_RULES.memo[choice];
      expect(e.memo!.reactions.map((r) => r.text)).toEqual(fork.reactions.map((r) => r.text));
      for (const r of e.memo!.reactions) {
        const who = s.walkers.find((w) => w.name === r.name)!;
        expect(who.kind).toBe(r.kind);
        expect(s.thoughts.some((t) => t.walkerId === who.id && t.text === r.text)).toBe(true);
      }
      expect(s.news.some((n) => n.text === fork.extra.headline.replace("{lab}", s.labName))).toBe(true);
      const v = memoView(s)!;
      expect(v).toMatchObject({ phase: "answered", choice, chip: fork.chip });
      expect(v.extra!.headline).toContain(s.labName);
      // The lingering effect: training pace, the protest, and the thoughts.
      expect(trainingPace(s)).toBe(fork.training);
      s.waterDiscourse = 20;
      dailyMemo(s);
      expect(s.waterDiscourse).toBeCloseTo(20 * fork.discourse);
      expect(activeConditions(s).has(choice === "race" ? "memoRace" : "memoSlow")).toBe(true);
      expect(THOUGHTS.filter((t) => t.when === (choice === "race" ? "memoRace" : "memoSlow")).length).toBe(fork.thoughts.length);
    });
  }

  it("Slow Down sends the protesters home over a few days", () => {
    const s = midgame();
    s.waterDiscourse = 60;
    play(s, 1);
    offerMemo(s);
    play(s, 12, 1, (w) => w.endings!.memo !== undefined);
    const before = s.waterDiscourse;
    play(s, 10, 1);
    expect(s.waterDiscourse).toBeLessThan(before - 15);
  });
});

describe("Captured and Escaped", () => {
  it("Captured fires once the Capture meter is full (moved by FLT-22's `capture.delta` where it exists)", () => {
    const s = staged();
    if (VERBS["capture.delta"]) for (let i = 0; i < 10; i++) runVerb({ state: s, rng: createRng(1), run: null }, { type: "capture.delta", params: { amount: 10 } });
    else (s as { capture?: number }).capture = 100;
    expect(ENDING_STATS.capture!(s)).toBe(100);
    play(s, 20, 0, (w) => w.endings!.endedDay !== null);
    expect(s.endings!.id).toBe("captured");
    expect(endingsView(s)!.ending!.next.label).toBe("Keep regulating");
  });

  it("Escaped has a hook (`escapedAhead`) and no fake ending: nothing sets it yet", () => {
    const s = staged();
    expect(ENDING_STATS.escapedAhead!(s)).toBe(0);
    expect(ENDINGS.some((e) => e.id === "escaped")).toBe(false);
    (s as { escape?: { rank: number } }).escape = { rank: 3 };
    expect(ENDING_STATS.escapedAhead!(s)).toBe(0);
    (s as { escape?: { rank: number } }).escape = { rank: 1 };
    expect(ENDING_STATS.escapedAhead!(s)).toBe(1);
  });
});
