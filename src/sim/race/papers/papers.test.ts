import type { AnyStateMachine } from "xstate";
import { getAdjacencyMap } from "xstate/graph";
import { readDebugParams } from "../../../debug";
import { createSimHandle } from "../../../app/sim";
import { makeSnapshot } from "../../../app/hud";
import { initialStored, step } from "../../machines/run";
import { createRng } from "../../rng";
import { createTestCampus as createInitialState } from "../../testkit";
import { applyNow, tick } from "../../tick";
import { dailyWalkers } from "../../walkers";
import { answer, createTestCampus } from "../../testkit";
import { stagePapers } from "./demo";
import { P, PAPERS_PACK } from "./content";
import { dailyPapers, disablePapers, enablePapers, publishPaper, setPublicationPolicy } from "./driver";
import { policyMachine } from "./policy";
import { publicationMachine, quietPaperDay, type PublicationStored } from "./publication";
import { papersView } from "./view";
// Pinned v6 graph typing does not model emitted events; same adapter as machines/graph.test.ts.
function graph(machine: AnyStateMachine, options: Record<string, unknown>) {
  return getAdjacencyMap(machine as never, options as never) as unknown as Record<string, { state: { value: string } }>;
}
const fresh = () => initialStored(publicationMachine, { importance: 2, value: 2, submittedDay: null,
  publishedDay: null, dueDay: null, scoopedBy: "", scoopedDay: null, award: "", citations: 0, critiqueDay: null });
const day = (n: number, scoopRival = "", award = "") => ({ type: "DAY" as const, day: n, scoopRival, award, citationGain: 2, scoopValue: P.scoopValue, critiqueValue: P.critiqueValue });
const submit = { day: 10, reviewDays: 60, critiqueDay: null };
function lab() {
  const s = createInitialState(42);
  enablePapers(s);
  const rng = createRng(s.rngState);
  setPublicationPolicy(s, "Closed", rng);
  s.models.push("Frontier-2");
  dailyPapers(s, rng);
  return { s, rng };
}

describe("publication statecharts", () => {
  it("preprint is immediate, can be criticized once, then keeps accumulating citations", () => {
    const r = step(publicationMachine, fresh(), { type: "PREPRINT", ...submit, critiqueDay: 13 });
    expect(r.effects).toEqual([{ type: "PUBLISHED", review: false }]);
    expect(r.stored.context.publishedDay).toBe(10);
    const c = step(publicationMachine, r.stored, day(13));
    expect(c.effects).toEqual([{ type: "CRITIQUED" }]);
    expect(c.stored.value).toBe("criticized");
    expect(c.stored.context.value).toBe(1.5);
    const later = step(publicationMachine, c.stored, day(14));
    expect(later.effects).toEqual([]);
    expect(later.stored.context.citations).toBe(4);
  });
  it("review waits exactly 60 days, scoop only the day before and halves the value", () => {
    let p = step(publicationMachine, fresh(), { type: "REVIEW", ...submit }).stored;
    expect(p.context.dueDay).toBe(70);
    p = step(publicationMachine, p, day(68, "sirocco")).stored;
    expect(p.context.scoopedBy).toBe("");
    const scoop = step(publicationMachine, p, day(69, "sirocco"));
    expect(scoop.effects).toEqual([{ type: "SCOOPED", rival: "sirocco" }]);
    expect(scoop.stored.context.value).toBe(1);
    const accepted = step(publicationMachine, scoop.stored, day(70, "", "Golden Footnote"));
    expect(accepted.effects).toEqual([{ type: "PUBLISHED", review: true }]);
    expect(accepted.stored.context.award).toBe("");
    expect(accepted.stored.context.citations).toBe(0);
  });
  it("a reviewed unscooped paper reaches an award; terminal publication cannot be resubmitted", () => {
    const p = step(publicationMachine, fresh(), { type: "REVIEW", ...submit }).stored;
    const a = step(publicationMachine, p, day(70, "", "Golden Footnote"));
    expect(a.stored.value).toBe("awarded");
    expect(a.effects).toEqual([{ type: "PUBLISHED", review: true }, { type: "AWARDED", award: "Golden Footnote" }]);
    expect(step(publicationMachine, a.stored, { type: "PREPRINT", ...submit }).stored).toEqual(a.stored);
  });
  it("xstate/graph reaches every publication state and each policy", () => {
    const map = graph(publicationMachine, { input: fresh().context,
      events: [{ type: "PREPRINT", ...submit, critiqueDay: 13 }, { type: "REVIEW", ...submit }, day(13), day(69, "sirocco"), day(70), day(70, "", "Golden Footnote")],
      serializeState: (s: { value: unknown; context: ReturnType<typeof fresh>["context"] }) => JSON.stringify([s.value, s.context.dueDay, s.context.critiqueDay, s.context.scoopedBy]), limit: 200,
    });
    expect(new Set(Object.values(map).map((n) => n.state.value))).toEqual(new Set(Object.keys(publicationMachine.states)));
    const pm = graph(policyMachine, { input: { publishPressure: 0 }, events: (["Open", "Selective", "Closed"] as const).map((policy) => ({ type: "SET", policy })), serializeState: (s: { value: unknown }) => String(s.value) });
    expect(new Set(Object.values(pm).map((n) => n.state.value))).toEqual(new Set(["Open", "Selective", "Closed"]));
  });
  it("the quiet day (no transition(), FLT-39) answers as the machine does, whenever it answers", () => {
    let quiet = 0;
    for (const value of ["draft", "review", "published", "criticized", "awarded"] as const)
      for (const dueDay of [null, 10, 70])
        for (const critiqueDay of [null, 9, 13])
          for (const scoopedBy of ["", "sirocco"]) {
            const stored: PublicationStored = { value, context: { ...fresh().context, value: 0.8, citations: 5, dueDay, critiqueDay, scoopedBy } };
            for (const d of [8, 9, 10, 13, 69, 70, 71])
              for (const scoopRival of ["", "sirocco"])
                for (const award of ["", "Golden Footnote"]) {
                  const event = { day: d, scoopRival, scoopValue: 0.5, award, citationGain: 3, critiqueValue: 0.4 };
                  const got = quietPaperDay(stored, event);
                  if (!got) continue;
                  quiet++;
                  const want = step(publicationMachine, stored, { type: "DAY", ...event });
                  expect(want.effects).toEqual([]);
                  expect(got).toStrictEqual(want.stored);
                }
          }
    expect(quiet).toBeGreaterThan(300);
  });
});

describe("papers integration", () => {
  it("off consumes no RNG and preserves World; disable leaves its history frozen", () => {
    const s = createInitialState(1);
    const before = JSON.stringify(s);
    const rng = createRng(s.rngState);
    dailyPapers(s, rng);
    expect(JSON.stringify(s)).toBe(before);
    expect(rng.state()).toBe(s.rngState);
    enablePapers(s);
    disablePapers(s);
    const disabled = JSON.stringify(s);
    dailyPapers(s, rng);
    expect(JSON.stringify(s)).toBe(disabled);
    expect(s.recruitingPull).toBeUndefined();
  });
  it("retains closed drafts, discovers each source once, exposes recruiting and publication-pressure hooks", () => {
    const { s, rng } = lab();
    s.race.era = { value: "era2", context: { peak: 2 } };
    dailyPapers(s, rng);
    dailyPapers(s, rng);
    expect(s.papers!.list.map((p) => p.source)).toEqual(["run:1", "research:era:2"]);
    expect(s.papers!.published).toBe(0);
    expect(s.recruitingPull).toBe(P.policyPull.Closed);
    expect(s.papers!.policy.context.publishPressure).toBeGreaterThan(0);
    setPublicationPolicy(s, "Open", rng);
    dailyPapers(s, rng);
    expect(s.papers!.published).toBe(2);
    expect(s.recruitingPull).toBeGreaterThan(P.policyPull.Open);
  });
  it("Selective reviews strong sources, keeps weaker drafts, and policy changes do not cancel review", () => {
    const { s, rng } = lab();
    s.race.era = { value: "era2", context: { peak: 2 } };
    setPublicationPolicy(s, "Selective", rng);
    dailyPapers(s, rng);
    expect(s.papers!.list[0]!.machine.value).toBe("draft");
    expect(s.papers!.list[1]!.machine.value).toBe("review");
    expect(papersView(s).papers[1]!.daysLeft).toBe(60);
    setPublicationPolicy(s, "Closed", rng);
    s.day = 60;
    dailyPapers(s, rng);
    expect(s.papers!.published).toBe(1);
  });
  it("publishes through commands while paused, exactly once; spill scales by importance and uses rival SHOCK", () => {
    const { s } = lab();
    const before = s.race.rivals.map((r) => r.context.capability);
    applyNow(s, [{ type: "publishPaper", id: 1, route: "preprint" }]);
    const ps = s.papers!;
    expect(ps.published).toBe(1);
    s.race.rivals.forEach((r, i) => expect(r.context.capability - before[i]!).toBeCloseTo(P.spillPerImportance));
    expect(ps.knowledgeSpill).toBeCloseTo(P.spillPerImportance * before.length);
    applyNow(s, [{ type: "publishPaper", id: 1, route: "review" }, { type: "publishPaper", id: 999, route: "review" }]);
    expect(ps.published).toBe(1);
    expect(s.tick).toBe(0);
    expect(s.news.some((n) => n.text.includes("arXive"))).toBe(true);
  });
  it("scoop and award copy comes from pack data and snapshot is detached JSON with visible timer", () => {
    const { s, rng } = lab();
    publishPaper(s, 1, "review", rng);
    const snap = makeSnapshot(s);
    expect(snap.papers.policy).toBe("Closed");
    expect(snap.papers.papers[0]!.daysLeft).toBe(60);
    expect(JSON.parse(JSON.stringify(snap.papers))).toEqual(snap.papers);
    const p = s.papers!.list[0]!;
    p.machine = { ...p.machine, context: { ...p.machine.context, citations: 123 } };
    expect(snap.papers.papers[0]!.citations).toBe(0);
    expect(PAPERS_PACK.content?.headlines?.add?.find((n) => n.trigger === "papers:scoop")?.text).toContain("18 hours");
  });
  it("JSON save/reload resumes deterministically, including review countdown and dice", () => {
    const { s, rng } = lab();
    publishPaper(s, 1, "review", rng);
    s.rngState = rng.state();
    const loaded = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 1500; i++) { tick(s, answer(s)); tick(loaded, answer(loaded)); }
    expect(s.papers!.published).toBeGreaterThan(0);
    expect(loaded).toEqual(s);
  });
  it("staged moments use the driver for scoop and award, expose headline records, and replay identically", () => {
    for (const moment of ["paper-drop", "paper-scoop", "paper-award"] as const) {
      const s = createInitialState(3), replay = createInitialState(3);
      stagePapers(s, moment); stagePapers(replay, moment);
      expect(replay).toEqual(s);
      const ps = s.papers!;
      expect(s.news.at(-1)!.text).toMatch(moment === "paper-scoop" ? /18 hours/ : moment === "paper-award" ? /wins/ : /arXive/);
      if (moment === "paper-scoop") {
        const p = ps.list.find((p) => p.machine.context.scoopedBy)!;
        expect(ps.scoops).toBe(1);
        expect(p.machine.context.value).toBe(p.machine.context.importance * P.scoopValue);
        expect(papersView(s).papers.find((v) => v.id === p.id)!.daysLeft).toBe(1);
        s.day++;
        dailyPapers(s, createRng(s.rngState));
        expect(ps.knowledgeSpill).toBeCloseTo(p.machine.context.value * P.spillPerImportance * s.race.rivals.length);
      } else if (moment === "paper-award") {
        expect(ps.awards).toBe(1);
        expect(ps.reputation).toBeCloseTo((P.reviewReputation + P.awardReputation) * ps.list[0]!.machine.context.value);
        expect(papersView(s).papers[0]!.award).toBeTruthy();
      }
    }
  });
  it("papers waits for Scrutiny in a new lab and reset, with ?papers=off supported", () => {
    const sim = createSimHandle(readDebugParams("?papers=on&leapfrog=off"));
    expect(sim.world.papers).toBeUndefined();
    sim.reset(2);
    expect(sim.world.papers).toBeUndefined();
    expect(createSimHandle(readDebugParams("?papers=off")).world.papers).toBeUndefined();
  });
  it("the tiny recruitingPull hook brings more and more-focused real applicants for identical gate trials", () => {
    const trials = (pull: number) => {
      let count = 0, focus = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const s = createTestCampus(seed); // a working campus: applicants come for a hall, and the first-run opening has none (FLT-16)
        s.walkers = s.walkers.filter((w) => w.kind !== "researcher");
        s.vibes.value = 700;
        s.recruitingPull = pull;
        dailyWalkers(s, createRng(seed));
        const applicants = s.walkers.filter((w) => w.kind === "researcher");
        count += applicants.length;
        focus += applicants.reduce((n, w) => n + w.focus, 0);
      }
      return { count, focus: focus / count };
    };
    const open = trials(P.policyPull.Open), closed = trials(P.policyPull.Closed);
    expect(open.count).toBeGreaterThan(closed.count);
    expect(open.focus).toBeGreaterThan(closed.focus);
  });
});
