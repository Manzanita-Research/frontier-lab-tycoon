import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { eventById } from "../../content/events";
import { openEventOf } from "../events";
import { answer, createTestCampus } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import { checkChart, structural, type Beat } from "../circus/chart";
import { createRng } from "../rng";
import type { GameState } from "../types";
import { runSenateYear } from "../capture/headless";
import { stageSenate } from "../capture/demo";
import { castVotes, lobbySenator } from "./driver";
import { freshPromises, motionOf, PROMISES_STATS, stepPromises } from "./machine";
import { loadPromisesPack, PROMISES, ROLLCALL_CARD, SENATORS, truthLabel, WHIP_CARD } from "./pack";
import { promisesView } from "./view";

const beat = (type: Beat["type"], day: number, more: Partial<Beat> = {}): Beat => ({ type, day, tick: day * TICKS_PER_DAY, roll: 0, stats: {}, ...more });

describe("the Promise Tracker pack", () => {
  it("names only real verbs, guards and states, and every stage is reachable", () => {
    expect(checkChart(PROMISES.chart, PROMISES_STATS)).toEqual([]);
    const chart = createMachine(structural(PROMISES.chart));
    expect(new Set(getShortestPaths(chart).map((p) => p.state.value))).toEqual(new Set(Object.keys(PROMISES.chart.states)));
    expect(() => loadPromisesPack({})).toThrow();
  });
  it("reuses The Hearing's three senators, and every motion has a promise from each", () => {
    expect(SENATORS.map((s) => s.id)).toEqual(["blusterworth", "quimby", "brickman"]);
    for (const m of PROMISES.rules.motions) for (const sen of SENATORS) expect(m.promises[sen.id]?.line).toBeTruthy();
    expect(eventById(WHIP_CARD)?.kind).toBe("vote");
    expect(eventById(ROLLCALL_CARD)?.kind).toBe("vote");
    expect(truthLabel(null)).toBe("Unrated");
    expect(truthLabel(0)).toBe("Pants Ablaze");
    expect(truthLabel(100)).toBe("Gospel");
  });
});

describe("the promises chart (pure)", () => {
  it("wakes after a hearing, campaigns, and keeps score: a vote against a promise is a broken one", () => {
    let s = stepPromises(freshPromises(0), beat("DAY", 1, { stats: { hearings: 1 } })).stored;
    expect(s.value).toBe("recess");
    s = stepPromises(s, beat("DAY", 2, { stats: { tabled: 1 }, data: { motion: "bill", title: "The Test Act" } })).stored;
    expect(s.value).toBe("campaign");
    expect(s.context.motion).toBe("bill");
    const lobby = stepPromises(s, beat("CHOSE", 3, { choice: "lobby:quimby" }));
    expect(lobby.stored.context.lobbied).toEqual(["quimby"]);
    expect(lobby.calls.map((c) => c.verb)).toEqual(["cash.delta", "capture.delta", "heat.delta"]);
    expect(stepPromises(lobby.stored, beat("CHOSE", 3, { choice: "lobby:quimby" })).calls).toEqual([]);
    s = stepPromises(lobby.stored, beat("DAY", 7)).stored;
    expect(s.value).toBe("rollCall");
    // The bill: Blusterworth and Quimby promised nay, Brickman both ways.
    const r = stepPromises(s, beat("DAY", 8, { data: { votes: { blusterworth: "nay", quimby: "aye", brickman: "aye" } } })).stored;
    expect(r.value).toBe("passed");
    expect(r.context.records.blusterworth).toMatchObject({ kept: 1, broken: 0 });
    expect(r.context.records.quimby).toMatchObject({ kept: 0, broken: 1 });
    expect(r.context.records.quimby!.log[0]).toMatchObject({ said: "nay", voted: "aye", kept: false, lobbied: true });
    expect(r.context.records.brickman).toMatchObject({ kept: 1, broken: 0 });
  });
});

describe("lobbying", () => {
  /** The whip card up, nobody lobbied yet: the senator least likely to vote the lab's way. */
  function whip(seed = 1) {
    const s = createTestCampus(seed);
    stageSenate(s, "vote");
    const lobbied = s.promises!.machine.context.lobbied[0]!;
    // Rewind the lobbying the moment did, so the fork starts clean.
    s.promises!.machine.context.lobbied = [];
    return { s, target: lobbied };
  }
  function toRollCall(s: GameState) {
    applyNow(s, answer(s, 0));
    for (let i = 0; i < 10 * TICKS_PER_DAY && !["passed", "failed"].includes(s.promises!.machine.value); i++) {
      const open = openEventOf(s);
      tick(s, open ? answer(s) : []);
    }
    return s.promises!.machine.context.records;
  }

  it("flips a vote: the same roll call, lobbied and not", () => {
    let flips = 0;
    for (const seed of [1, 2, 3, 4]) {
      const { s, target } = whip(seed);
      const m = motionOf(s.promises!.machine.context.motion)!;
      const bought = structuredClone(s), free = structuredClone(s);
      const cash = bought.cash;
      expect(lobbySenator(bought, target)).toBe(true);
      expect(bought.cash).toBe(cash - PROMISES.rules.senators[target]!.lobby);
      expect(promisesView(bought).senators.find((x) => x.id === target)).toMatchObject({ lobbied: true, leaning: m.labSide });
      const a = toRollCall(bought)[target]!.log.at(-1)!;
      const b = toRollCall(free)[target]!.log.at(-1)!;
      expect(a).toMatchObject({ motion: m.id, voted: m.labSide, lobbied: true });
      expect(b.motion).toBe(m.id);
      if (b.voted !== m.labSide) flips++;
    }
    expect(flips).toBeGreaterThan(0);
  }, 60_000);

  it("a lobbied senator always votes the lab's way, whatever the dice", () => {
    const s = createTestCampus(1);
    const m = motionOf("pause")!;
    for (let seed = 1; seed < 50; seed++) {
      const votes = castVotes(s, createRng(seed), m, ["blusterworth"]);
      expect(votes.blusterworth).toBe(m.labSide);
    }
  });

  it("is refused in recess, twice over, or short of cash", () => {
    const { s, target } = whip();
    s.cash = 0;
    expect(lobbySenator(s, target)).toBe(false);
    s.cash = 1e7;
    expect(lobbySenator(s, target)).toBe(true);
    expect(lobbySenator(s, target)).toBe(false);
    s.promises!.machine = { ...s.promises!.machine, value: "recess" };
    expect(lobbySenator(s, "quimby")).toBe(false);
  }, 20_000);
});

describe("a year of promises (headless)", () => {
  it("promises and actions diverge: senators keep some, break some, and the Truth-o-meters part ways", () => {
    const r = runSenateYear(1, { clauses: ["threshold", "permit"], lobby: true });
    const v = promisesView(r.world);
    expect(v.held).toBeGreaterThanOrEqual(8);
    const broken = v.senators.reduce((n, x) => n + x.broken, 0);
    const kept = v.senators.reduce((n, x) => n + x.kept, 0);
    expect(broken).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
    expect(new Set(v.senators.map((x) => x.truthLabel)).size).toBeGreaterThan(1);
    expect(r.lobbied).toBeGreaterThan(0);
  }, 30_000);
  it("votes move the regulatory heat", () => {
    const moved = PROMISES.rules.motions.flatMap((m) => [...m.pass, ...m.fail]).filter((c) => typeof c !== "string" && c.type === "heat.delta");
    expect(moved.length).toBeGreaterThan(0);
  });
});
