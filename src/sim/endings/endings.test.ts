// FLT-11: every ending's trigger path, played. The Race and Slow Down forks are a full scripted playthrough (the bot
// from src/sim/bot.ts) into Era 4, where The Memo opens; the other three are staged on a test campus.
import { SCENARIO } from "../../content/goals";
import { eventById } from "../../content/events";
import { playBot } from "../bot";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { eraOfState } from "../race/race";
import { brokeTonight, createTestCampus, perfBudget } from "../testkit";
import { TICKS_PER_DAY, tick } from "../tick";
import type { GameState } from "../types";
import type { Command } from "../commands";
import { createInitialState } from "../state";
import { chartOf, endingHalts, validateEndings } from "./driver";
import { ENDINGS, MEMO_RACE, MEMO_SLOW } from "./pack";
import { enableEndings } from "./state";
import { runSenateYear } from "../capture/headless";

/** Tick until `done` (or the budget runs out), answering every card: The Memo with `memo`, the rest with the first choice. */
function play(s: GameState, days: number, memo = 0, done: (s: GameState) => boolean = (w) => outcomeOf(w) === "ended", extra: (s: GameState) => Command[] = () => []) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    tick(s, open ? [{ type: "chooseEvent", eventId: open.id, choiceIndex: open.id === "memo" ? memo : 0 }] : extra(s));
  }
}

const staged = (seed = 1) => {
  const s = createTestCampus(seed);
  enableEndings(s);
  return s;
};

describe("the pack (mods/base-endings)", () => {
  it("passes the Vocabulary check: every guard, verb and stat is known", () => {
    expect(validateEndings()).toEqual([]);
  });

  it("ships the five endings whose triggers exist, each chart reaching its front page", () => {
    expect(ENDINGS.map((e) => e.id)).toEqual(["captured", "acquihired", "takeover", "regulated", "pivot"]);
    for (const e of ENDINGS) {
      const chart = chartOf(e);
      const seen = new Set<string>([chart.initial]);
      const queue = [chart.initial];
      while (queue.length) {
        const node = chart.states[queue.shift()!]!;
        for (const t of [node.on?.TICK ?? []].flat()) if (t.target && !seen.has(t.target)) (seen.add(t.target), queue.push(t.target));
      }
      expect([...seen].sort(), e.id).toEqual(Object.keys(chart.states).sort());
      expect([...seen].some((n) => chart.states[n]!.type === "final"), e.id).toBe(true);
    }
  });

  it("offers The Memo as an ordinary card with two boxes: Race and Slow Down", () => {
    expect(eventById("memo")!.choices.map((c) => c.label)).toEqual(["Race", "Slow Down"]);
  });
});

describe("The Memo and its fork (a full scripted playthrough)", () => {
  // One bot run into Era 4 (days ~1,000), stopped the moment The Memo is on screen; each fork continues from a copy.
  const out: { state?: GameState } = {};
  let report: ReturnType<typeof playBot>;
  beforeAll(() => {
    report = playBot(1, { keepPlaying: true, days: SCENARIO.deadlineDay + 200, setup: enableEndings, out, until: (s) => openEventOf(s)?.id === "memo" });
  }, 30_000);

  it("is won first, then The Memo opens in Era 4, and only then", () => {
    const s = out.state!;
    expect(report.outcome).toBe("won");
    expect(openEventOf(s)?.id).toBe("memo");
    expect(eraOfState(s)).toBeGreaterThanOrEqual(4);
    expect(s.endings!.eraDays.length).toBe(4);
    expect(s.endings!.run).toBeNull();
  });

  it("Race, while ahead (or once you catch up), ends in The Takeover: the autopilot builds, and play goes on", () => {
    const s = structuredClone(out.state!);
    const buildings = s.buildings.length;
    play(s, 400, 0);
    const e = s.endings!;
    expect(s.flags[MEMO_RACE]).toBeDefined();
    expect(e.id).toBe("takeover");
    expect(outcomeOf(s)).toBe("ended");
    expect(e.look.managedBy).toMatch(/^Frontier-\d+$/);
    expect(e.look.thanks).toBe("Thanks for playing. We'll take it from here.");
    expect(e.autopilot.placed).toBeGreaterThanOrEqual(3);
    expect(s.buildings.length).toBeGreaterThan(buildings);
    // Keep watching: time goes on, and so does the autopilot.
    expect(endingHalts(s)).toBe(false);
    const day = s.day;
    const placed = e.autopilot.placed;
    play(s, 5, 0, () => false);
    expect(s.day).toBe(day + 5);
    expect(e.autopilot.placed).toBeGreaterThan(placed);
  }, 20_000);

  it("the player's own building is politely declined while the autopilot drives", () => {
    const s = structuredClone(out.state!);
    play(s, 400, 0, (w) => w.endings!.autopilot.on);
    const paths = s.grid.paths.filter(Boolean).length;
    s.toasts.length = 0;
    tick(s, [{ type: "placePath", x: 0, z: 0 }]);
    expect(s.grid.paths.filter(Boolean).length).toBe(paths);
    expect(s.toasts.at(-1)!.text).toMatch(/^Frontier-\d+: I've got this\.$/);
  }, 20_000);

  it("Slow Down ends as a Regulated Utility: beige, stickered, and still open", () => {
    const s = structuredClone(out.state!);
    play(s, 60, 1);
    const e = s.endings!;
    expect(s.flags[MEMO_SLOW]).toBeDefined();
    expect(e.id).toBe("regulated");
    expect(e.look).toMatchObject({ beige: true, stickers: true });
    expect(outcomeOf(s)).toBe("ended");
    expect(endingHalts(s)).toBe(false);
  });
});

describe("the staged endings", () => {
  it("bankruptcy is Acqui-hired (not the old loss): the Macrohard sticker goes on, then time stops", () => {
    const s = staged();
    brokeTonight(s); // every round spent and the bank's 30 days up
    play(s, 30);
    expect(s.endings!.id).toBe("acquihired");
    expect(s.endings!.look.acquired).toBe("Macrohard");
    expect(s.goals.value).toBe("tracking");
    expect(endingHalts(s)).toBe(true);
    const t = s.tick;
    play(s, 3, 0, () => false);
    expect(s.tick).toBe(t);
  });

  it("a maxed Capture meter is Captured: you become the regulator and your office moves off campus", () => {
    const s = staged();
    s.capture = 100;
    play(s, 30);
    expect(s.endings!.id).toBe("captured");
    expect(s.endings!.look).toMatchObject({ captured: true, officeMoved: true });
    expect(endingHalts(s)).toBe(false);
  });

  it("Captured fires from FLT-22's own meter: a lab that lobbies and writes the bill fills it at the hearings", () => {
    // No meter set by hand: #58's Senate loop (slick witness, the staffer's draft, every wrong-way senator lobbied).
    const r = runSenateYear(2, { clauses: ["kombucha", "review"], lobby: true, endings: true }, 600);
    expect(r.world.capture).toBe(100);
    expect(r.world.endings!.id).toBe("captured");
    expect(r.outcome).toBe("ended");
    expect(r.day).toBeLessThan(600);
    // An honest witness who shreds every draft never gets there.
    const honest = runSenateYear(2, { clauses: [], lobby: false, endings: true }, 600);
    expect(honest.world.capture ?? 0).toBeLessThan(100);
    expect(honest.world.endings!.id ?? null).not.toBe("captured");
  }, 120_000);

  it("no Capture meter (the pack asleep, or an old save) never triggers Captured", () => {
    const s = staged();
    expect(s.capture).toBeUndefined();
    s.day = 900;
    play(s, 20, 0, () => false);
    expect(s.endings!.run).toBeNull();
  });

  it("the deadline without a win is The Pivot, a front page instead of the old game-over", () => {
    const s = createInitialState(1);
    enableEndings(s);
    // An absent player runs out of money long before the deadline, and since FLT-86 the board only bails a lab out
    // three times (then it's Acqui-hired). A lab that never spends a dollar reaches the deadline.
    s.cash = 1e9;
    play(s, SCENARIO.deadlineDay + 20);
    expect(s.endings!.id).toBe("pivot");
    expect(outcomeOf(s)).toBe("ended");
    expect(s.goals.value).toBe("tracking");
    expect(endingHalts(s)).toBe(true);
  }, 20_000);

  it("the endings switched off leave the old game exactly as it was", () => {
    const s = createTestCampus(1);
    brokeTonight(s); // every round spent and the bank's 30 days up
    play(s, 3, 0, (w) => outcomeOf(w) === "lost");
    expect(outcomeOf(s)).toBe("lost");
    expect(s.endings).toBeUndefined();
  });
});

describe("determinism and cost", () => {
  it("two runs of the same staged ending are identical", () => {
    const run = () => {
      const s = staged(3);
      s.capture = 100;
      play(s, 30);
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });

  it("the daily check is cheap", () => {
    const s = staged();
    s.day = 500;
    const t0 = performance.now();
    play(s, 60, 0, () => false);
    const perDay = (performance.now() - t0) / 60;
    // The whole day, walkers and all; the endings' share is a handful of stat reads.
    expect(perDay).toBeLessThan(perfBudget(20));
  });
});
