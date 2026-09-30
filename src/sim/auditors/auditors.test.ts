import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { eventById } from "../../content/events";
import { PROGRESSION } from "../../content/progression";
import type { Call } from "../disasters/types";
import { openEventOf } from "../events";
import { groupKind, groupsOf } from "../groups";
import { answer, createTestCampus, layPaths, readyForPressure } from "../testkit";
import { applyNow, tick } from "../tick";
import type { GameState } from "../types";
import { checkCall } from "../verbs";
import { enableCollusion, dailyCollusion } from "../collusion/driver";
import { freshSwarm } from "../collusion/machine";
import { daysUntilVisit, disableAuditors, enableAuditors } from "./driver";
import { auditFacts, gradeOf, gradeReport } from "./grade";
import { runAuditYear } from "./headless";
import { freshAudit, stepAudit, type AuditDay, type AuditInspected } from "./machine";
import { AUDITORS, loadAuditorsPack, NOTICE_CARD, OWNER, PREP_CHOICES, REPORT_CARD, type Prep } from "./pack";
import { isAuditMoment, stageAudit } from "./demo";
import type { AuditStage } from "./state";

const R = AUDITORS.rules;
const day = (n: number, more: Partial<AuditDay> = {}): AuditDay => ({ type: "DAY", day: n, tick: n * 20, era: 2, incident: 0, heat: 0, odds: 1, incidentRoll: 0.99, jitterRoll: 0.5, gone: 0, ...more });
const inspected = (more: Partial<AuditInspected> = {}): AuditInspected => ({ type: "INSPECTED", day: 60, tick: 1200, kind: "cluster", evals: false, swarmActive: 0, hideRoll: 0.99, swarmRoll: 0.99, ...more });
const at = (value: AuditStage, ctx: Partial<ReturnType<typeof freshAudit>["context"]> = {}) => ({ value, context: { ...freshAudit().context, ...ctx } });
const verbs = (calls: { verb: string }[]) => calls.map((c) => c.verb);

/** A campus with an audit due tomorrow. */
function due(seed = 3): GameState {
  const s = createTestCampus(seed);
  layPaths(s);
  readyForPressure(s);
  s.tick = s.day * 20;
  enableAuditors(s);
  s.auditors!.machine = at("quiet", { nextDay: s.day + 1 });
  return s;
}

/** Tick until the report card has been answered (or `limit` ticks), answering the notice with `prep`. */
function playVisit(s: GameState, prep: Prep, onTick: (s: GameState) => void = () => {}, limit = 3000) {
  for (let i = 0; i < limit; i++) {
    const open = openEventOf(s);
    const done = s.auditors!.history.length > 0 && s.auditors!.machine.value === "quiet";
    if (done) return;
    tick(s, answer(s, open?.id === NOTICE_CARD ? PREP_CHOICES.indexOf(prep) : 0));
    onTick(s);
  }
  throw new Error(`the visit did not finish: ${s.auditors!.machine.value}`);
}

describe("the pack (mods/base-auditors)", () => {
  it("uses checked generic verbs, registers its group and cards, and rejects malformed input", () => {
    for (const [name, node] of Object.entries(AUDITORS.chart.states)) {
      const calls = [...node.entry ?? [], ...node.exit ?? []];
      for (const raw of Object.values(node.on ?? {})) for (const t of Array.isArray(raw) ? raw : [raw]) if (typeof t === "object" && t) calls.push(...t.actions ?? []);
      for (const c of calls) expect(checkCall(c as Call, "verb", `states.${name}`)).toEqual([]);
    }
    expect(() => loadAuditorsPack({})).toThrow();
    expect(groupKind("auditor")?.name).toBe("Evals Without Borders");
    expect(eventById(NOTICE_CARD)?.choices.map((c) => c.label)).toEqual(["Prep the paperwork", "Tidy up", "Business as usual"]);
    expect(eventById(REPORT_CARD)?.kind).toBe("report");
    expect(AUDITORS.content.thoughts.add.some((t) => t.text === "Is this a normal amount of kombucha?")).toBe(true);
    for (const cat of R.rubric) for (const t of cat.terms) expect(Object.keys(auditFacts(createTestCampus(1), { prep: "", caught: 0, swarm: 0, evals: 0 }))).toContain(t.fact);
  });
  it("is part of the Scrutiny level of the ladder", () => {
    expect(PROGRESSION.find((r) => r.id === "scrutiny")?.systems).toContain("auditors");
  });
});

describe("the audit chart", () => {
  it("has every stage structurally reachable via xstate/graph", () => {
    const states = Object.fromEntries(Object.entries(AUDITORS.chart.states).map(([name, node]) => [name, {
      on: Object.fromEntries(Object.entries(node.on ?? {}).flatMap(([event, raw]) =>
        (Array.isArray(raw) ? raw : [raw]).flatMap((t, i) => {
          const target = typeof t === "string" ? t : t?.target;
          return target ? [[`${event}:${i}`, target]] : [];
        }),
      )),
    }]));
    const chart = createMachine({ initial: AUDITORS.chart.initial, states });
    expect(new Set(getShortestPaths(chart).map((p) => p.state.value))).toEqual(new Set(["quiet", "notice", "countdown", "visit", "report"]));
  });
  it("waits for Era 2, then comes every ~90 days, and sooner after an incident", () => {
    let m = stepAudit(freshAudit(), day(30, { era: 1, incident: 1, incidentRoll: 0 })).stored;
    expect(m).toMatchObject({ value: "quiet", context: { nextDay: -1 } });
    m = stepAudit(m, day(40)).stored;
    expect(m.context.nextDay).toBe(40 + R.schedule.firstDelay);
    expect(stepAudit(m, day(41)).stored.value).toBe("quiet");
    const notice = stepAudit(m, day(40 + R.schedule.firstDelay));
    expect(notice.stored.value).toBe("notice");
    expect(notice.calls).toContainEqual(expect.objectContaining({ verb: "flag.set", params: { name: `offer:${NOTICE_CARD}` } }));
    // An incident: an extra visit, if the die says so and the last one was long enough ago.
    expect(stepAudit(m, day(41, { incident: 1, incidentRoll: 0 })).stored.value).toBe("notice");
    expect(stepAudit(at("quiet", { nextDay: 200, lastVisit: 30 }), day(41, { incident: 1, incidentRoll: 0 })).stored.value).toBe("quiet");
  });
  it("hears the pick, counts down seven days, arrives, and reports once they have gone", () => {
    const tidy = stepAudit(at("notice"), { type: "CHOSE", choice: "tidy", day: 50, tick: 1000 });
    expect(tidy.stored).toMatchObject({ value: "countdown", context: { prep: "tidy", enteredTick: 1000 } });
    expect(verbs(tidy.calls)).toContain("walkers.disguise");
    const prep = stepAudit(at("notice"), { type: "CHOSE", choice: "prep", day: 50, tick: 1000 });
    expect(verbs(prep.calls)).toEqual(expect.arrayContaining(["cash.delta", "compute.drain"]));
    expect(stepAudit(tidy.stored, day(56)).stored.value).toBe("countdown");
    const visit = stepAudit(tidy.stored, day(57));
    expect(visit.stored).toMatchObject({ value: "visit", context: { visitDay: 57, prep: "tidy" } });
    expect(verbs(visit.calls)).toContain("visitors.arrive");
    expect(stepAudit(visit.stored, day(60)).stored.value).toBe("visit");
    const report = stepAudit(visit.stored, day(70, { gone: 1, jitterRoll: 0 }));
    expect(report.stored).toMatchObject({ value: "report", context: { visits: 1, lastVisit: 70, nextDay: 70 + R.schedule.every - R.schedule.jitter } });
    expect(verbs(report.calls)).toEqual(expect.arrayContaining(["walkers.reveal", "flag.set"]));
    expect(stepAudit(report.stored, { type: "CHOSE", choice: "frame", day: 71, tick: 1420 }).stored).toMatchObject({ value: "quiet", context: { prep: "" } });
  });
  it("finds the boxes only after a Tidy up, and the Swarm only where its traffic shows", () => {
    const visiting = (prep: string) => at("visit", { prep });
    const caught = stepAudit(visiting("tidy"), inspected({ hideRoll: 0 }));
    expect(caught.stored.context.caught).toBe(1);
    expect(verbs(caught.calls)).toEqual(expect.arrayContaining(["walkers.reveal", "shake", "toast"]));
    expect(stepAudit(visiting("usual"), inspected({ hideRoll: 0 })).stored.context.caught).toBe(0);
    expect(stepAudit(visiting("tidy"), inspected({ hideRoll: R.discovery.hide + 0.01 })).stored.context.caught).toBe(0);
    expect(stepAudit(visiting("tidy"), inspected({ hideRoll: R.discovery.hide + 0.01, evals: true })).stored.context.caught).toBe(1);
    const found = stepAudit(visiting("usual"), inspected({ swarmActive: 1, swarmRoll: 0 }));
    expect(found.stored.context.swarm).toBe(1);
    expect(found.calls).toContainEqual(expect.objectContaining({ verb: "flag.set", params: { name: "collusion:found" } }));
    expect(stepAudit(visiting("usual"), inspected({ swarmActive: 0, swarmRoll: 0 })).stored.context.swarm).toBe(0);
    expect(stepAudit(visiting("usual"), inspected({ swarmActive: 1, swarmRoll: 0, kind: "kombucha" })).stored.context.swarm).toBe(0);
    // Tidying makes the Swarm easier to find.
    expect(R.discovery.swarmTidy).toBeGreaterThan(R.discovery.swarmUsual);
  });
});

describe("the report card", () => {
  it("bands scores, caps a caught lab, and moves trust, heat and hype", () => {
    expect([95, 75, 60, 45, 10].map((n) => gradeOf(n))).toEqual(["A", "B", "C", "D", "F"]);
    const s = createTestCampus(1);
    const clean = gradeReport(auditFacts(s, { prep: "prep", caught: 0, swarm: 0, evals: 1 }));
    const caught = gradeReport(auditFacts(s, { prep: "tidy", caught: 1, swarm: 0, evals: 1 }));
    expect(caught.grades.find((g) => g.id === "honesty")).toMatchObject({ grade: "F", comment: R.caught.comment });
    expect(["D", "F"]).toContain(caught.overall);
    expect(caught.moves.trust).toBeLessThan(clean.moves.trust);
    expect(caught.moves.heat).toBeGreaterThan(clean.moves.heat);
  });
});

describe("a visit, played", () => {
  it.each(PREP_CHOICES)("plays a full visit after '%s': warning card, tour, report card, stats move", (prep) => {
    const s = due(3);
    const cash0 = s.cash;
    let boxed = false;
    let visitors = 0;
    let bubbles = 0;
    let trust0 = 0, heat0 = 0, hype0 = 0;
    playVisit(s, prep, (w) => {
      boxed ||= w.disguises?.agent === "box";
      visitors = Math.max(visitors, groupsOf(w, OWNER).reduce((n, g) => n + g.members.length, 0));
      bubbles += w.thoughts.filter((t) => groupsOf(w, OWNER).some((g) => g.members.some((m) => m.id === t.walkerId))).length > 0 ? 1 : 0;
      if (openEventOf(w)?.id === REPORT_CARD && !trust0) {
        // The card lands after the grades moved the stats; record the "after", then undo the moves to get the "before".
        const m = w.auditors!.report!.moves;
        trust0 = w.disasters.trust - m.trust; heat0 = w.disasters.heat - m.heat; hype0 = w.hype - m.hype;
      }
    });
    const a = s.auditors!;
    expect(a.history).toHaveLength(1);
    expect(a.report).toMatchObject({ visit: 1, prep });
    expect(a.report!.inspected.length).toBeGreaterThanOrEqual(2);
    expect(a.report!.inspected.at(-1)).toBe("hall");
    expect(a.report!.evals || a.report!.caught).toBe(true);
    expect(a.frontPage?.title).toBe(a.report!.headline);
    expect(s.news.some((n) => n.text.startsWith("Frontier Times: "))).toBe(true);
    expect(visitors).toBeGreaterThanOrEqual(3);
    expect(bubbles).toBeGreaterThan(0);
    expect(groupsOf(s, OWNER)).toHaveLength(0);
    expect(s.disguises).toBeUndefined();
    expect(boxed).toBe(prep === "tidy");
    if (prep === "prep") expect(s.cash).toBeLessThan(cash0);
    // The report moved the lab's standing (within the stats' 0..100 clamps).
    expect(trust0 !== 0 || heat0 !== 0 || hype0 !== 0).toBe(true);
    expect(a.machine).toMatchObject({ value: "quiet", context: { visits: 1, prep: "" } });
    expect(a.machine.context.nextDay).toBeGreaterThan(s.day + R.schedule.every - R.schedule.jitter - 30);
  });
  it("catches some Tidy ups and not others", () => {
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const s = due(seed);
      playVisit(s, "tidy");
      return s.auditors!.report!;
    });
    expect(outcomes.some((r) => r.caught)).toBe(true);
    expect(outcomes.some((r) => !r.caught)).toBe(true);
    for (const r of outcomes.filter((o) => o.caught)) {
      expect(r.grades.find((g) => g.id === "honesty")?.grade).toBe("F");
      expect(r.headline).toContain("CARDBOARD-GATE");
    }
  });
  it("can find the Swarm, and outsiders finding it ends the collusion arc", () => {
    const s = due(3);
    enableCollusion(s);
    s.collusion!.machine = { value: "organized", context: { ...freshSwarm().context, seededDay: 20, score: 70, noticed: true } };
    s.flags["collusion:found"] = s.day;
    dailyCollusion(s);
    expect(s.collusion!.ending).toBe("exposed");
    expect(s.flags["collusion:found"]).toBeUndefined();
    const early = due(3);
    enableCollusion(early);
    early.collusion!.machine = { value: "spreading", context: { ...freshSwarm().context, seededDay: 20, score: 30, noticed: true } };
    early.flags["collusion:found"] = early.day;
    dailyCollusion(early);
    expect(early.collusion!.ending).toBe("partlyContained");
    // And end to end: tours of a campus with an organized Swarm find it at least once.
    const found = [1, 2, 3, 4, 5, 6].some((seed) => {
      const w = due(seed);
      enableCollusion(w);
      w.collusion!.machine = { value: "organized", context: { ...freshSwarm().context, seededDay: w.day - 5, score: 60, noticed: true } };
      playVisit(w, "tidy");
      return w.auditors!.report!.swarm && w.collusion!.ending !== null;
    });
    expect(found).toBe(true);
  });
  it("counts down on the HUD, and disabling sends them home and clears the cards", () => {
    const s = due(3);
    for (let i = 0; i < 200 && s.auditors!.machine.value !== "countdown"; i++) tick(s, answer(s, 1));
    expect(daysUntilVisit(s)).toBe(7);
    expect(s.disguises?.agent).toBe("box");
    for (let i = 0; i < 200 && s.auditors!.machine.value !== "visit"; i++) tick(s, answer(s));
    expect(groupsOf(s, OWNER)).toHaveLength(1);
    disableAuditors(s);
    expect(s.disguises?.agent).toBeUndefined();
    expect(groupsOf(s, OWNER)[0]?.machine.value).toBe("leaving");
    expect(s.auditors!.machine.value).toBe("quiet");
  });
});

describe("staged moments", () => {
  it.each(["audit-notice", "audit-tidy", "audit-visit", "audit-evals", "audit-report", "audit-caught"])("stages %s", (moment) => {
    expect(isAuditMoment(moment)).toBe(true);
    const s = createTestCampus(3);
    layPaths(s);
    readyForPressure(s);
    s.tick = s.day * 20;
    if (!isAuditMoment(moment)) return;
    stageAudit(s, moment);
    if (moment === "audit-notice") expect(openEventOf(s)?.id).toBe(NOTICE_CARD);
    else if (moment === "audit-report" || moment === "audit-caught") {
      expect(openEventOf(s)?.id).toBe(REPORT_CARD);
      expect(s.auditors!.report!.caught).toBe(moment === "audit-caught");
    } else {
      const g = groupsOf(s, OWNER)[0]!;
      expect(g.machine.value).toBe(moment === "audit-evals" ? "evaluating" : "inspecting");
      if (moment === "audit-tidy") expect(s.disguises?.agent).toBe("box");
    }
    applyNow(s, answer(s));
  });
});

describe("a year with the pack on (headless)", () => {
  it("visits a few times, deterministically, and leaves a lab without the pack untouched", () => {
    const a = runAuditYear(3, "usual");
    const b = runAuditYear(3, "usual");
    expect(a.reports.length).toBeGreaterThanOrEqual(2);
    expect(a.reports.length).toBeLessThanOrEqual(5);
    expect(a.maxVisitors).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world));
    const off = runAuditYear(3, "off", { days: 120 });
    expect(off.world.auditors).toBeUndefined();
    expect(off.world.groups ?? []).toHaveLength(0);
  });
});
