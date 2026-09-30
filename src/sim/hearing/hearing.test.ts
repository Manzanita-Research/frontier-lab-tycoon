import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { eventById } from "../../content/events";
import { createTestCampus, answer, readyForPressure } from "../testkit";
import { openEventOf } from "../events";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import { checkChart, structural } from "../circus/chart";
import { enableHearing, disableHearing } from "./driver";
import { freshHearing, HEARING_STATS, stepHearing } from "./machine";
import { GAVEL_CARD, HEARING, loadHearingPack } from "./pack";
import { hearingView } from "./view";
import type { Beat } from "../circus/chart";
import type { GameState } from "../types";
import { CARD_GAP_DAYS } from "../../content/cardPacing";

const R = HEARING.rules;
const PICK = { earnest: 0, slick: 1, chaotic: 2 } as const;
const beat = (type: Beat["type"], day: number, more: Partial<Beat> = {}): Beat => ({ type, day, tick: day * TICKS_PER_DAY, roll: 0, stats: {}, ...more });

function staged(seed = 3) {
  const s = createTestCampus(seed);
  readyForPressure(s);
  s.progression = { value: "complete", context: { level: 5 } };
  enableHearing(s);
  return s;
}
/** Run ticks until `until` holds, answering any card that is not a hearing card with its first choice. */
function runUntil(s: GameState, until: (s: GameState) => boolean, days = 30) {
  for (let i = 0; i < days * TICKS_PER_DAY && !until(s); i++) {
    const open = openEventOf(s);
    tick(s, open && !open.id.startsWith("hearing-") ? answer(s) : []);
  }
}
/** Summon the lab (a subpoena filed today) and wait for the first question. */
function summon(s: GameState) {
  s.flags["subpoena:test"] = s.day;
  runUntil(s, (s) => s.hearing!.machine.value === "inSession" && openEventOf(s)?.id.startsWith("hearing-") === true);
  expect(s.hearing!.machine.value).toBe("inSession");
}
/** Answers each question; between them the committee recesses (FLT-54's card budget) until the next one is on the table. */
function testify(s: GameState, picks: (keyof typeof PICK)[]) {
  const days: number[] = [];
  for (const p of picks) {
    const c = s.hearing!.machine.context;
    if (s.hearing!.machine.value === "inSession" && openEventOf(s)?.id !== c.docket[c.answers.length]) runUntil(s, (s) => openEventOf(s)?.id === c.docket[c.answers.length]);
    expect(openEventOf(s)?.id).toBe(c.docket[c.answers.length]);
    days.push(s.day);
    applyNow(s, answer(s, PICK[p]));
  }
  return days;
}

describe("the Hearing pack", () => {
  it("names only real verbs, guards and states, and every stage is reachable", () => {
    expect(checkChart(HEARING.chart, HEARING_STATS)).toEqual([]);
    expect(checkChart(HEARING.chart)).toContainEqual(expect.stringContaining('unknown stat "sessionTrust"'));
    const chart = createMachine(structural(HEARING.chart));
    expect(new Set(getShortestPaths(chart).map((p) => p.state.value))).toEqual(new Set(Object.keys(HEARING.chart.states)));
    expect(() => loadHearingPack({})).toThrow();
  });
  it("has a question card per question, three answers each, and three senators with a question apiece", () => {
    for (const [id, q] of Object.entries(R.questions)) {
      expect(eventById(id)?.kind).toBe("hearing");
      expect(eventById(id)?.choices).toHaveLength(3);
      expect(R.senators.some((sen) => sen.id === q.senator)).toBe(true);
    }
    for (const sen of R.senators) expect(Object.values(R.questions).filter((q) => q.senator === sen.id).length).toBeGreaterThanOrEqual(2);
    expect(eventById(GAVEL_CARD)?.choices).toHaveLength(1);
  });
});

describe("the hearing chart (pure)", () => {
  const docket = ["hearing-cloud", "hearing-taxes", "hearing-followers"];
  function session(picks: string[]) {
    let s = stepHearing(freshHearing(0), beat("DAY", 1, { stats: { summons: 1 }, data: { docket, topic: "t", trigger: "debut" } })).stored;
    expect(s.value).toBe("summoned");
    s = stepHearing(s, beat("DAY", 3)).stored;
    expect(s.value).toBe("summoned");
    s = stepHearing(s, beat("DAY", 4)).stored;
    expect(s.value).toBe("inSession");
    const calls: string[] = [];
    for (const p of picks) {
      const r = stepHearing(s, beat("CHOSE", 4, { choice: p }));
      s = r.stored;
      calls.push(...r.calls.map((c) => c.verb));
    }
    return { s, calls };
  }
  it.each([
    [["chaotic", "chaotic", "earnest"], "viral"],
    [["slick", "slick", "slick"], "captured"],
    [["earnest", "earnest", "earnest"], "commended"],
    [["earnest", "slick", "chaotic"], "grilled"],
  ])("%j ends %s", (picks, verdict) => {
    const { s, calls } = session(picks);
    expect(s.value).toBe(verdict);
    expect(s.context.answers).toEqual(picks);
    expect(calls).toContain("flag.set");
  });
  it("ignores a stray pick and waits for all three answers", () => {
    const { s } = session(["earnest", "nonsense", "earnest"]);
    expect(s.value).toBe("inSession");
    expect(s.context.answers).toEqual(["earnest", "earnest"]);
  });
  it("goes quiet again after the cooldown", () => {
    let { s } = session(["earnest", "earnest", "earnest"]);
    s = stepHearing(s, beat("DAY", 30)).stored;
    expect(s.value).toBe("commended");
    s = stepHearing(s, beat("DAY", 60)).stored;
    expect(s.value).toBe("quiet");
  });
});

describe("a hearing in the game", () => {
  it("stays quiet while the ladder is below Level 5, even when subpoenaed", () => {
    const s = staged();
    s.progression = { value: "growing", context: { level: 4 } };
    s.flags["subpoena:test"] = s.day;
    runUntil(s, () => false, 10);
    expect(s.hearing!.machine.value).toBe("quiet");
  });
  it("summons, asks three questions a recess apart, moves both meters and bangs the gavel", () => {
    const s = staged();
    const trust = s.disasters.trust, capture = s.capture ?? 0;
    summon(s);
    const view = hearingView(s);
    expect(view.stage).toBe("inSession");
    expect(view.current?.senator).toBe(R.questions[view.current!.card]!.senator);
    expect(eventById(openEventOf(s)!.id)?.kind).toBe("hearing");
    const days = testify(s, ["earnest", "slick", "earnest"]);
    // One card per CARD_GAP_DAYS at 1×: the Senate takes its time, and so does everything else.
    for (let i = 1; i < days.length; i++) expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(CARD_GAP_DAYS);
    expect(s.hearing!.machine.value).not.toBe("inSession");
    expect(openEventOf(s)?.id).toBe(GAVEL_CARD);
    expect(s.hearing!.history).toHaveLength(1);
    expect(s.disasters.trust).not.toBe(trust);
    expect(s.capture).toBeGreaterThan(capture);
    applyNow(s, answer(s));
    expect(openEventOf(s)).toBeNull();
    expect(s.flags["hearing:adjourned"]).toBe(s.day);
  });
  it("an all-chaotic session goes viral and buys hype", () => {
    const s = staged(5);
    const hype = s.hype;
    summon(s);
    testify(s, ["chaotic", "chaotic", "chaotic"]);
    expect(s.hearing!.machine.value).toBe("viral");
    expect(s.hype).toBeGreaterThan(hype);
  });
  it("is deterministic for a seed", () => {
    const run = () => {
      const s = staged(7);
      summon(s);
      testify(s, ["slick", "slick", "earnest"]);
      return JSON.stringify([s.hearing, s.disasters.trust, s.capture, s.hype, s.news.slice(-5)]);
    };
    expect(run()).toBe(run());
  });
  it("switching off closes an open question and goes quiet", () => {
    const s = staged();
    summon(s);
    disableHearing(s);
    expect(openEventOf(s)).toBeNull();
    expect(s.hearing!.machine.value).toBe("quiet");
  });
});
