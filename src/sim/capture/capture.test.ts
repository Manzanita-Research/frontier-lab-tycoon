import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { createSimHandle } from "../../app/sim";
import { eventById } from "../../content/events";
import { readDebugParams } from "../../debug";
import { openEventOf } from "../events";
import { answer, createTestCampus } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import { checkChart, structural, type Beat } from "../circus/chart";
import { rivalRules } from "../race/rules";
import type { GameState } from "../types";
import { disableCapture, draftClause, leakOdds } from "./driver";
import { runSenateYear } from "./headless";
import { CAPTURE_STATS, freshBill, stepBill } from "./machine";
import { CAPTURE, DRAFT_CARD, EXPOSED_CARD, loadCapturePack } from "./pack";
import { stageSenate, SENATE_MOMENTS, wakeSenate } from "./demo";
import { captureView } from "./view";

const beat = (type: Beat["type"], day: number, more: Partial<Beat> = {}): Beat => ({ type, day, tick: day * TICKS_PER_DAY, roll: 0, stats: {}, ...more });
/** Run days, answering every card with its first choice. */
function run(s: GameState, days: number) {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) {
    const open = openEventOf(s);
    tick(s, open ? answer(s) : []);
  }
}

describe("the Regulatory Capture pack", () => {
  it("names only real verbs, guards and states, and every stage is reachable", () => {
    expect(checkChart(CAPTURE.chart, CAPTURE_STATS)).toEqual([]);
    const chart = createMachine(structural(CAPTURE.chart));
    expect(new Set(getShortestPaths(chart).map((p) => p.state.value))).toEqual(new Set(Object.keys(CAPTURE.chart.states)));
    expect(() => loadCapturePack({})).toThrow();
    for (const c of CAPTURE.rules.clauses) expect(checkChart({ id: c.id, initial: "a", states: { a: { entry: c.effects } } } as never)).toEqual([]);
  });
  it("has five clauses, two allowed, and both cards are bill cards", () => {
    expect(CAPTURE.rules.clauses).toHaveLength(5);
    expect(CAPTURE.rules.pick).toBe(2);
    expect(eventById(DRAFT_CARD)?.kind).toBe("bill");
    expect(eventById(EXPOSED_CARD)?.kind).toBe("bill");
  });
});

describe("the capture chart (pure)", () => {
  it("is invited only after a hearing, with Capture high, and keeps at most two real clauses", () => {
    const quiet = freshBill(0);
    expect(stepBill(quiet, beat("DAY", 20, { stats: { hearings: 0, capture: 90 } })).stored.value).toBe("quiet");
    expect(stepBill(quiet, beat("DAY", 20, { stats: { hearings: 1, capture: 10 } })).stored.value).toBe("quiet");
    const invited = stepBill(quiet, beat("DAY", 20, { stats: { hearings: 1, capture: 15 } })).stored;
    expect(invited.value).toBe("invited");
    const floor = stepBill(invited, beat("CHOSE", 20, { choice: "send", data: { clauses: ["kombucha", "nonsense", "review", "permit"] } })).stored;
    expect(floor.value).toBe("floor");
    expect(floor.context.clauses).toEqual(["kombucha", "review"]);
    expect(stepBill(floor, beat("DAY", 21, { stats: { voted: 1, ayes: 1 } })).stored.value).toBe("failed");
    const law = stepBill(floor, beat("DAY", 21, { stats: { voted: 1, ayes: 2 } })).stored;
    expect(law.value).toBe("law");
    const exposed = stepBill(law, beat("DAY", 40, { stats: { leaked: 1 } }));
    expect(exposed.stored.value).toBe("exposed");
    expect(exposed.calls.map((c) => c.verb)).toEqual(expect.arrayContaining(["auditor.note", "auditor.odds", "effects.end", "trust.delta"]));
    expect(stepBill(law, beat("DAY", 21 + 180)).stored.value).toBe("sunset");
  });
});

describe("the bill in play", () => {
  it("the draft takes two clauses (a third is a toast), and only while the staffer waits", () => {
    const s = createTestCampus(1);
    stageSenate(s, "bill");
    expect(openEventOf(s)?.id).toBe(DRAFT_CARD);
    expect(s.bill!.draft).toEqual(["threshold", "permit"]);
    const toasts = s.toasts.length;
    expect(draftClause(s, "kombucha", true)).toBe(false);
    expect(s.toasts.length).toBe(toasts + 1);
    applyNow(s, [{ type: "draftClause", clause: "permit", on: false }, { type: "draftClause", clause: "kombucha", on: true }]);
    expect(captureView(s).clauses.filter((c) => c.on).map((c) => c.id)).toEqual(["threshold", "kombucha"]);
    applyNow(s, answer(s, 0));
    expect(s.bill!.machine.value).toBe("floor");
    expect(draftClause(s, "review", true)).toBe(false);
  }, 20_000);

  it("signed, the clauses change how the rivals race: labs behind you grow slower, open labs ship closed", () => {
    const s = createTestCampus(1);
    stageSenate(s, "bill-law");
    expect(s.bill!.machine.value).toBe("law");
    const behind = s.race.rivals.filter((r) => r.context.capability < s.capability).map((r) => r.context.id);
    const open = ["anthro", "openish", "metameta"];
    expect(behind.length).toBeGreaterThan(0);
    for (const r of s.race.rivals) {
      const rules = rivalRules(s, r.context);
      expect(rules.growth).toBe(behind.includes(r.context.id) ? 0.55 : 1);
      expect(rules.closed).toBe(open.includes(r.context.id));
    }
    expect(rivalRules(s, s.race.rivals.find((r) => r.context.id === "sirocco")!.context).pace).toBe(0.6);
    // The same year twice: once under the law, once with it struck. The pack is put to sleep in both, so only the law differs.
    const law = structuredClone(s), free = structuredClone(s);
    for (const w of [law, free]) w.bill!.enabled = false;
    free.disasters.effects = free.disasters.effects.filter((e) => e.owner !== "capture");
    const before = Object.fromEntries(s.race.rivals.map((r) => [r.context.id, { cap: r.context.capability, releases: r.context.releases }]));
    const gained = (w: GameState, ids: string[]) => w.race.rivals.filter((r) => ids.includes(r.context.id)).reduce((n, r) => n + r.context.capability - before[r.context.id]!.cap, 0);
    // Every open lab's release over the year, open or closed: the last one alone is a coin toss (FLT-56 moved it).
    const watch = (w: GameState) => {
      const seen = Object.fromEntries(w.race.rivals.map((r) => [r.context.id, r.context.releases]));
      const shipped: boolean[] = [];
      for (let d = 0; d < 180; d++) {
        run(w, 1);
        for (const r of w.race.rivals) {
          if (!open.includes(r.context.id) || r.context.releases === seen[r.context.id]) continue;
          seen[r.context.id] = r.context.releases;
          shipped.push(r.context.open);
        }
      }
      return shipped;
    };
    const shippedLaw = watch(law);
    const shippedFree = watch(free);
    expect(gained(law, behind)).toBeLessThan(gained(free, behind) * 0.8);
    expect(shippedLaw.length).toBeGreaterThan(0);
    expect(shippedLaw.every((o) => !o)).toBe(true);
    expect(shippedFree.some((o) => o)).toBe(true);
  }, 30_000);

  it("backfires: the file properties leak, the law is struck, trust and the auditors' Honesty grade take the hit", () => {
    const s = createTestCampus(1);
    stageSenate(s, "bill-law");
    expect(leakOdds(s)).toBeGreaterThan(0);
    const trust = s.disasters.trust;
    s.flags["capture:leak"] = s.day;
    run(s, 1);
    expect(s.bill!.machine.value).toBe("exposed");
    expect(openEventOf(s)?.id).toBe(EXPOSED_CARD);
    expect(s.disasters.effects.filter((e) => e.owner === "capture" && e.kind.startsWith("rival"))).toEqual([]);
    expect(s.disasters.trust).toBeLessThan(trust);
    expect(s.auditorNotes?.at(-1)).toMatchObject({ grade: "honesty", amount: -1, owner: "capture" });
    expect(s.news.some((n) => n.text.startsWith("LEAKED"))).toBe(true);
    applyNow(s, answer(s, 0));
    expect(s.bill!.machine.value).toBe("fallout");
    expect(s.bill!.history.at(-1)).toMatchObject({ outcome: "exposed", clauses: ["threshold", "permit"] });
  }, 20_000);

  it("off: the law is struck and the pack goes quiet", () => {
    const s = createTestCampus(1);
    stageSenate(s, "bill-law");
    disableCapture(s);
    expect(s.bill!.machine.value).toBe("quiet");
    expect(s.disasters.effects.some((e) => e.owner === "capture")).toBe(false);
    expect(captureView(s).enabled).toBe(false);
  }, 20_000);
});

describe("a year of the Senate (headless, every card answered)", () => {
  it("a lobbying lab writes law, and journalists find out", () => {
    const r = runSenateYear(1, { clauses: ["threshold", "permit"], lobby: true });
    expect(r.outcome).not.toBe("lost");
    expect(r.day).toBe(365);
    expect(r.cards.some((c) => c.id === DRAFT_CARD)).toBe(true);
    expect(r.bill!.history.some((h) => h.outcome === "exposed")).toBe(true);
    expect(r.world.auditorNotes?.length).toBeGreaterThan(0);
  }, 30_000);
  it("a lab that shreds every draft never writes law", () => {
    const r = runSenateYear(1, { clauses: [], lobby: false });
    expect(r.bill!.history.length).toBeGreaterThan(0);
    for (const h of r.bill!.history) expect(h.outcome).toBe("declined");
    expect(r.world.auditorNotes ?? []).toEqual([]);
  }, 30_000);
  it("is deterministic for a seed", () => {
    const once = () => { const r = runSenateYear(2, { clauses: ["kombucha", "review"], lobby: true, exposed: 2 }); return JSON.stringify([r.cards, r.bill, r.promises, r.world.news, r.world.race]); };
    expect(once()).toBe(once());
  }, 40_000);
});

describe("the review links", () => {
  it("stages each moment with its card on screen, and ?capture=off / ?promises=off keep the packs asleep", () => {
    const card = (moment: string) => openEventOf(createSimHandle(readDebugParams(`?moment=${moment}`)).world)?.id;
    expect(card("bill")).toBe(DRAFT_CARD);
    expect(card("bill-exposed")).toBe(EXPOSED_CARD);
    expect(card("vote")).toBe("promises-whip");
    expect(card("rollcall")).toBe("promises-rollcall");
    expect(createSimHandle(readDebugParams("?moment=bill-law")).world.bill?.machine.value).toBe("law");
    const off = createSimHandle(readDebugParams("?capture=off&promises=off")).world;
    expect(off.flags.captureOff).toBe(1);
    expect(off.flags.promisesOff).toBe(1);
    expect(SENATE_MOMENTS).toHaveLength(5);
    const w = createTestCampus(1);
    wakeSenate(w);
    expect(w.bill?.enabled && w.promises?.enabled).toBe(true);
  }, 40_000);
});
