import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { eventById } from "../../content/events";
import { YOU } from "../../content/rivals";
import { createTestCampus as createInitialState } from "../testkit";
import { applyNow, tick } from "../tick";
import { answer, perfBudget, runDays, readyForPressure } from "../testkit";
import { createRng } from "../rng";
import { hire, atDivert } from "../staff";
import { dailyEvents, openEventOf } from "../events";
import { checkCall, runVerb } from "../verbs";
import { BENCH_BY_ID } from "../../content/leapfrog";
import { enableLeapfrog, honestScore, shownScore } from "../race/leapfrog/driver";
import { enableCollusion, disableCollusion, dailyCollusion, updateCollusion } from "./driver";
import { COLLUSION, loadCollusionPack, SIGN_CARD } from "./pack";
import { catchChance, freshSwarm, seedChance, stepSwarm, type SwarmDay } from "./machine";
import { collusionView } from "./view";
import { collusionScore, evalBonus } from "./scores";
import { runCollusionYear } from "./headless";
import type { GameState } from "../types";
import type { Call } from "../disasters/types";
import type { SwarmStage } from "./state";

const day = (n: number, more: Partial<SwarmDay> = {}): SwarmDay => ({ type: "DAY", day: n, tick: n * 20, seedRoll: 0, catchRoll: 0, agents: 20, capability: 30, pressure: 0.5, reliability: 0.6, security: 0, arrived: 4, ...more });
function staged(stage: SwarmStage = "spreading") {
  const s = createInitialState(3);
  enableCollusion(s);
  readyForPressure(s);
  s.day = 120; s.tick = 2400;
  s.collusion!.machine = { value: stage, context: { ...freshSwarm().context, seededDay: 110, score: stage === "organized" ? 70 : 20, noticed: true } };
  return s;
}
function offer(s: GameState, pick: number) {
  s.flags[`offer:${SIGN_CARD}`] = s.day;
  dailyEvents(s);
  expect(openEventOf(s)?.id).toBe(SIGN_CARD);
  applyNow(s, answer(s, pick));
}

describe("the JSON Swarm chart", () => {
  it("has every stage and all three endings structurally reachable via xstate/graph", () => {
    // Structural chart, guards omitted, same technique as FLT-15's checker. Behavioral guards are tested below.
    const states = Object.fromEntries(Object.entries(COLLUSION.chart.states).map(([name, node]) => [name,
      node.type === "final" ? { type: "final" as const } : {
        // One synthetic event per alternative so XState explores every guarded edge.
        on: Object.fromEntries(Object.entries(node.on ?? {}).flatMap(([event, raw]) =>
          (Array.isArray(raw) ? raw : [raw]).flatMap((t, i) => {
            const target = typeof t === "string" ? t : t?.target;
            return target ? [[`${event}:${i}`, target]] : [];
          }),
        )),
      },
    ]));
    const chart = createMachine({ initial: COLLUSION.chart.initial, states });
    expect(new Set(getShortestPaths(chart).map((p) => p.state.value))).toEqual(new Set(Object.keys(states)));
  });
  it("uses checked generic verbs; has enough content and rejects malformed input", () => {
    expect(COLLUSION.content.thoughts.add.length).toBeGreaterThanOrEqual(20);
    expect(COLLUSION.content.headlines.add.length).toBeGreaterThanOrEqual(15);
    expect(COLLUSION.content.wikiPages.add.length).toBeGreaterThanOrEqual(8);
    expect(COLLUSION.content.heartbeats.add.length).toBeGreaterThanOrEqual(8);
    for (const [name, node] of Object.entries(COLLUSION.chart.states)) {
      const calls = [...node.entry ?? [], ...node.exit ?? []];
      for (const raw of Object.values(node.on ?? {})) for (const t of Array.isArray(raw) ? raw : [raw]) if (typeof t === "object" && t) calls.push(...t.actions ?? []);
      for (const c of calls) expect(checkCall(c as Call, "verb", `states.${name}`)).toEqual([]);
    }
    expect(() => loadCollusionPack({})).toThrow();
    expect(eventById(SIGN_CARD)?.choices.map((c) => c.label)).toEqual(["Investigate", "Ship the scores", "Ask the agents"]);
  });
  it("seeds, grows, organizes and exposes without touching its input", () => {
    const fresh = freshSwarm();
    let s = stepSwarm(fresh, day(90)).stored;
    expect(fresh.value).toBe("dormant");
    expect(s.value).toBe("seeded");
    for (let d = 91; d <= 300; d++) s = stepSwarm(s, day(d)).stored;
    expect(s.value).toBe("exposed");
    expect(s.context.score).toBe(100);
  });
  it.each(["seeded", "spreading", "organized"] as const)("catches at %s and preserves stage-specific ending", (stage) => {
    const old = { value: stage, context: { ...freshSwarm().context, score: stage === "organized" ? 70 : 20, seededDay: 129 } };
    const inquiry = stepSwarm(old, { type: "CHOSE", day: 130, tick: 2600, choice: "investigate" });
    expect(inquiry.calls.some((c) => c.verb === "investigate.start")).toBe(true);
    let s = inquiry.stored;
    for (let d = 131; d <= 137; d++) s = stepSwarm(s, day(d)).stored;
    expect(s.value).toBe(stage === "organized" ? "partlyContained" : "contained");
  });
  it("odds rise with population, capability, pressure and unreliable sandboxes; security reduces them", () => {
    const base = day(120);
    expect(seedChance({ ...base, day: 30 })).toBe(0);
    for (const changes of [{ agents: 200 }, { capability: 200 }, { pressure: 1 }, { reliability: 0 }]) expect(seedChance({ ...base, ...changes })).toBeGreaterThan(seedChance(base));
    expect(seedChance({ ...base, security: 5 })).toBeLessThan(seedChance(base));
    expect(catchChance(0, "seeded")).toBe(0);
    expect(catchChance(3, "seeded")).toBeGreaterThan(catchChance(1, "seeded"));
    expect(catchChance(2, "seeded")).toBeGreaterThan(catchChance(2, "organized"));
  });
});
describe("the tick, cards and generic inquiry", () => {
  it("starts through the ordinary card even while paused; Security leaves patrol for the Office", () => {
    const s = staged();
    for (let i = 0; i < 3; i++) hire(s, "security");
    offer(s, 0);
    expect(s.tick).toBe(2400);
    expect(s.collusion!.machine.context.investigationUntil).toBe(127);
    const office = s.buildings.find((b) => b.kind === "security")!;
    expect(office).toBeDefined();
    expect(s.staff.every((o) => o.divert?.to === office.id)).toBe(true);
    for (let i = 0; i < 80; i++) tick(s, answer(s));
    expect(s.staff.some((o) => atDivert(s, o))).toBe(true);
    runDays(s, 10, (w) => answer(w));
    expect(s.collusion!.ending).toBe("contained");
    expect(s.staff.every((o) => !o.divert)).toBe(true);
    expect(s.investigations?.collusion).toBeUndefined();
  });
  it.each([1, 2])("ship/ask (%s) does not start an inquiry", (pick) => {
    const s = staged(); offer(s, pick);
    expect(s.collusion!.machine.context.attempts).toBe(0);
    expect(s.investigations).toBeUndefined();
    expect(s.news.at(-1)?.text).toMatch(pick === 1 ? /ships/ : /bread/);
  });
  it("no staff means failure and a retry card; posts release even on failure", () => {
    const s = staged(); offer(s, 0);
    runDays(s, 23, (w) => answer(w, w.day >= 140 ? 1 : 0));
    expect(s.collusion!.ending).toBeNull();
    expect(s.news.some((n) => n.text.includes("no answers"))).toBe(true);
    expect(s.collusion!.machine.context.attempts).toBeGreaterThanOrEqual(1);
  });
  it("generic inquiry does not steal staff already diverted to another incident or being fired", () => {
    const s = staged(); hire(s, "security"); hire(s, "security"); hire(s, "security");
    s.staff[0]!.divert = { owner: "another", to: 0, jog: 1 };
    s.staff[1]!.machine.value = "leaving";
    runVerb({ state: s, rng: createRng(1), run: null }, { type: "investigate.start", params: { id: "other-inquiry", days: 4, job: "security", to: "$office" } });
    expect(s.staff.map((o) => o.divert?.owner)).toEqual(["another", undefined, "other-inquiry"]);
    expect(checkCall({ type: "investigate.start", params: { id: "x", days: 0, job: "security", to: "gate" } }, "verb", "test")).not.toEqual([]);
  });
  it("keeps another open card, and queues the sign until the slot is free", () => {
    const s = staged(); s.day = 60; s.waterDiscourse = 44; dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("waterDiscourse");
    s.flags[`offer:${SIGN_CARD}`] = s.day; dailyEvents(s);
    expect(openEventOf(s)?.id).toBe("waterDiscourse");
    applyNow(s, answer(s)); dailyEvents(s);
    expect(openEventOf(s)?.id).toBe(SIGN_CARD);
  });
  it("inflates shown evals, preserves honest scores, and invalidates both boards for exactly 30 days", () => {
    const s = staged("organized"); enableLeapfrog(s);
    const def = BENCH_BY_ID["breadbench"] ?? Object.values(BENCH_BY_ID)[0]!;
    const real = honestScore(s, YOU, def)!;
    expect(shownScore(s, YOU, def)!).toBeGreaterThan(real);
    expect(evalBonus(s)).toBeGreaterThanOrEqual(0.08);
    expect(evalBonus(s)).toBeLessThanOrEqual(0.20);
    expect(collusionScore(s, 100)).toBeCloseTo(100 * (1 + evalBonus(s)));
    const rival = s.race.rivals[0]!.context.id;
    expect(shownScore(s, rival, def)).toBe(honestScore(s, rival, def));
    for (let i = 0; i < 6; i++) hire(s, "security"); offer(s, 0);
    // Deterministic successful query, with actual diversion work represented in the machine event.
    for (let d = 121; d <= 127; d++) { s.day = d; s.tick = d * 20; for (const o of s.staff) { const b = s.buildings.find((b) => b.id === o.divert?.to)!; o.x = b.x + b.w/2; o.z = b.z + b.d/2; o.route = []; o.machine.value = "idle"; } dailyCollusion(s); }
    expect(s.collusion!.ending).toBe("partlyContained");
    expect(shownScore(s, YOU, def)).toBeNull();
    expect(s.race.board.some((r) => r.id === YOU)).toBe(false);
    expect(s.flags["auditors:collusion"]).toBe(127);
    s.day = 156; expect(collusionScore(s, 100)).toBeNull();
    s.day = 157; dailyCollusion(s); expect(collusionScore(s, 100)).toBe(100);
    expect(s.race.board.some((r) => r.id === YOU)).toBe(true);
    expect(Number.isFinite(s.race.rankDelta)).toBe(true);
  });
  it("emits bounded off-map packets and night gathering requests independent of agent walkers", () => {
    const s = staged(); s.walkers = []; s.tick = 2415;
    updateCollusion(s);
    expect(s.collusion!.packets[0]?.presentation).toBe("offmap");
    expect(s.collusion!.gathering?.active).toBe(false);
    s.tick = 2418; updateCollusion(s); expect(s.collusion!.gathering?.active).toBe(true);
    s.tick = 2443; updateCollusion(s); expect(s.collusion!.packets).toHaveLength(0);
    s.day = 132; dailyCollusion(s); expect(s.collusion!.classified?.text).toContain("DO NOT DELETE");
  });
  it("the presentation view hides score and does not expose mutable World references", () => {
    const s = staged(); s.tick = 2420; updateCollusion(s);
    const view = collusionView(s);
    expect(JSON.stringify(view)).not.toContain('"score"');
    expect(JSON.stringify(view)).not.toContain('"rngState"');
    view.packets[0]!.from[0] = -999;
    expect(s.collusion!.packets[0]!.from[0]).not.toBe(-999);
  });
  it("disable closes the pack's card and releases its staff without drawing from the main RNG", () => {
    const s = staged(); hire(s, "security"); offer(s, 0);
    const rng = s.rngState;
    disableCollusion(s);
    expect(s.staff[0]?.divert).toBeUndefined();
    expect(collusionScore(s, 100)).toBe(100);
    expect(s.rngState).toBe(rng);
    expect(openEventOf(s)).toBeNull();
    enableCollusion(s); expect(s.collusion!.enabled).toBe(true);
  });
  it("replays identically after a JSON save midway through an inquiry", () => {
    const s = staged(); hire(s, "security"); hire(s, "security"); offer(s, 0); runDays(s, 3);
    const loaded = JSON.parse(JSON.stringify(s)) as GameState;
    runDays(s, 40); runDays(loaded, 40);
    expect(loaded).toEqual(s);
  });
  it("enabled daily cost stays under 0.15 ms and old saves acquire missing card arcs", () => {
    const s = staged(); delete s.arcs[SIGN_CARD]; enableCollusion(s); expect(s.arcs[SIGN_CARD]).toBeDefined();
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) { s.day = i; s.tick = i * 20; dailyCollusion(s); }
    expect((performance.now() - t0) / 500).toBeLessThan(perfBudget(0.15));
  });
});
describe("365 actual game days", () => {
  it("ignored signs expose around day 200–300; early investigation contains; late partly contains", async () => {
    const reports = [];
    for (const seed of [1, 3, 42]) for (const policy of ["off", "ignore", "early", "late"] as const) {
      const r = runCollusionYear(seed, policy); reports.push(r);
      expect(r.day, JSON.stringify({ seed, policy, day: r.day, ending: r.ending, history: r.history })).toBe(365);
      if (policy === "ignore") {
        expect(r.ending, JSON.stringify(r.history)).toBe("exposed");
        const ended = r.history.at(-1)!.day; expect(ended).toBeGreaterThanOrEqual(200); expect(ended).toBeLessThanOrEqual(300);
        expect(r.world.collusion!.frontPage?.title).toBe(COLLUSION.rules.frontPage.scandal);
        expect(r.heat).toBeGreaterThanOrEqual(30);
      } else if (policy === "early") expect(r.ending, JSON.stringify(r.history)).toBe("contained");
      else if (policy === "late") expect(r.ending, JSON.stringify(r.history)).toBe("partlyContained");
      else expect(r.ending).toBeNull();
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.COLLUSION_REPORT) {
      const fs = await import(/* @vite-ignore */ ("node:fs" as string)) as { mkdirSync: (p: string, o: object) => void; writeFileSync: (p: string, t: string) => void };
      fs.mkdirSync("docs/evidence/flt-18", { recursive: true });
      const lines = ["# FLT-18 sim evidence", "", "365 actual game days, ordinary build/hire/choice commands, seeds 1/3/42. Separate Swarm RNG. All cards answered. No forced stage or cash. Late inquiry uses the second warning at organization.", "", "| Seed | Policy | Days | Outcome | Seeded | First sign | Ending (day) | Max eval bonus | Capability | Trust | Heat |", "|---|---|---|---|---|---|---|---|---|---|---|"];
      for (const r of reports) lines.push(`| ${r.seed} | ${r.policy} | ${r.day} | ${r.outcome} | ${r.history[0]?.day ?? "–"} | ${r.firstSign ?? "–"} | ${r.ending ?? "off"} (${r.history.at(-1)?.day ?? "–"}) | ${(r.maxBonus*100).toFixed(1)}% | ${r.capability.toFixed(1)} | ${r.trust} | ${r.heat} |`);
      lines.push("", "The pack is opt-in pending the UI task. Packet/gathering/front-page data are tested sim signals; their custom rendering belongs to that follow-up. Existing event cards are shown in the screenshot evidence.", "", "Baseline golden digests were not re-recorded.");
      fs.writeFileSync("docs/evidence/flt-18/report.md", lines.join("\n") + "\n");
    }
  }, 120_000);
});
