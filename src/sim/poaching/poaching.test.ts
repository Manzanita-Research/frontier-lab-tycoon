import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { dramaLetter, eventById } from "../../content/events";
import { fillTemplate } from "../format";
import { RIVAL_DEFS } from "../../content/rivals";
import { createTestCampus, answer, readyForPressure } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import { dailyEvents, openEventOf } from "../events";
import { checkCall } from "../verbs";
import { structuralChart } from "../machines/packChart";
import { boardView } from "../race/arena";
import type { Call } from "../disasters/types";
import type { GameState } from "../types";
import { disablePoaching, enablePoaching, offerPoach, poachingVars } from "./driver";
import { CARD, CHOICES, loadPoachingPack, POACHING } from "./pack";
import { runDefectionYear } from "../defection/headless";

const R = POACHING.rules;
const from = (id: string) => { const r = RIVAL_DEFS.find((x) => x.id === id)!; return { from: r.id, name: r.name, short: r.short }; };
const byId = (s: GameState, id: number) => s.walkers.find((w) => w.id === id);

/** A lab with the pack on and a recruiter's offer on the desk. */
function staged(poacher = "metameta", seed = 3) {
  const s = createTestCampus(seed);
  readyForPressure(s);
  enablePoaching(s);
  s.day = 80;
  s.tick = 80 * TICKS_PER_DAY;
  expect(offerPoach(s, from(poacher))).toBe(true);
  dailyEvents(s);
  expect(openEventOf(s)?.id).toBe(CARD);
  return s;
}
const pick = (s: GameState, key: (typeof CHOICES)[number]) => applyNow(s, answer(s, CHOICES.indexOf(key)));
function runDaysAnswering(s: GameState, days: number) {
  for (let i = 0; i < days * TICKS_PER_DAY; i++) tick(s, openEventOf(s) ? answer(s, 0) : []);
}

describe("the Poaching War chart", () => {
  it("reaches every stage (xstate/graph, guards dropped)", () => {
    const paths = getShortestPaths(createMachine(structuralChart(POACHING.chart)));
    expect(new Set(paths.map((p) => p.state.value))).toEqual(new Set(Object.keys(POACHING.chart.states)));
  });
  it("uses checked generic verbs, and the loader rejects a malformed pack", () => {
    for (const [name, node] of Object.entries(POACHING.chart.states)) {
      const calls = [...node.entry ?? [], ...node.exit ?? []];
      for (const raw of Object.values(node.on ?? {})) for (const t of Array.isArray(raw) ? raw : [raw]) if (typeof t === "object" && t) calls.push(...t.actions ?? []);
      for (const c of calls) expect(checkCall(c as Call, "verb", `states.${name}`)).toEqual([]);
    }
    expect(() => loadPoachingPack({ id: "base-poaching" })).toThrow();
    expect(eventById(CARD)?.choices).toHaveLength(3);
  });
});

describe("an offer", () => {
  it("MetaMeta goes after 2 to 4 of your least happy researchers, who start thinking about it", () => {
    const s = staged();
    const offer = s.poaching!.offer!;
    expect(offer.targets.length).toBeGreaterThanOrEqual(R.targets.big[0]!);
    expect(offer.targets.length).toBeLessThanOrEqual(R.targets.big[1]!);
    for (const id of offer.targets) expect(s.thoughts.find((t) => t.walkerId === id)?.text).toMatch(/^⚡/);
    const vars = poachingVars(s);
    expect(vars.poacher).toBe("MetaMeta Superintelligence Labs");
    expect(vars.poachCount).toBe(String(offer.targets.length));
    // The card's hints quote the chart's own numbers, nested guards included.
    expect(vars.vibesNeeded).toBe("550");
  });
  it("a smaller lab asks for one or two", () => {
    const s = staged("sirocco");
    expect(s.poaching!.offer!.targets.length).toBeLessThanOrEqual(R.targets.other[1]!);
  });
  it("match: pays each of them, and they stay", () => {
    const s = staged();
    const n = s.poaching!.offer!.targets.length;
    const cash = s.cash;
    pick(s, "match");
    expect(s.cash).toBe(cash - 250_000 * n);
    expect(s.poaching!.machine.value).toBe("quiet");
    for (const id of s.poaching!.offer!.targets) expect(byId(s, id)!.machine.value).not.toBe("quitting");
    expect(s.thoughts.some((t) => s.poaching!.offer!.targets.includes(t.walkerId) && t.text.startsWith("⚡"))).toBe(false);
    expect(s.poaching!.tally.matched).toBe(n);
  });
  it("remind them of the mission: free when the Vibes are good, a walk-out when they are not", () => {
    const good = staged();
    good.vibes.value = 600;
    pick(good, "remind");
    expect(good.poaching!.machine.value).toBe("quiet");
    expect(good.poaching!.tally.stayed).toBe(good.poaching!.offer!.targets.length);
    const bad = staged();
    bad.vibes.value = 300;
    pick(bad, "remind");
    expect(bad.poaching!.machine.value).toBe("walkout");
  });
  it("let them go: boxes at the gate, a poached count, and sometimes a neo lab with a manifesto", () => {
    let founded = false;
    for (let k = 0; k < 10 && !founded; k++) {
      const s = staged();
      s.poaching!.rngState = (s.poaching!.rngState + k * 7919) >>> 0;
      const targets = s.poaching!.offer!.targets;
      const poached = s.race.poached;
      pick(s, "letgo");
      for (const id of targets) expect(byId(s, id)!.machine.value).toBe("quitting");
      expect(s.race.poached).toBe(poached + targets.length);
      expect(s.poaching!.tally.lost).toBe(targets.length);
      if (!s.poaching!.founding) continue;
      runDaysAnswering(s, R.found.delayDays + 1);
      const lab = s.neoLabs!.labs.find((l) => l.origin === "poaching")!;
      expect(lab.mood).toBe("hostile");
      expect(boardView(s).find((r) => r.id === lab.id)?.neo?.manifesto).toBe(lab.manifesto);
      founded = true;
    }
    expect(founded).toBe(true);
  });
  it("one offer at a time, then a rest; with the pack off, the old one-at-a-time poach runs", () => {
    const s = staged();
    expect(offerPoach(s, from("metameta"))).toBe(false);
    pick(s, "match");
    expect(offerPoach(s, from("metameta"))).toBe(false);
    s.day += R.restDays;
    expect(offerPoach(s, from("metameta"))).toBe(true);
    disablePoaching(s);
    expect(offerPoach(s, from("metameta"))).toBe(false);
  });
  it("never takes the lab below the floor", () => {
    const s = createTestCampus(3);
    enablePoaching(s);
    const keep = new Set(s.walkers.filter((w) => w.kind === "researcher").slice(0, R.targets.floor).map((w) => w.id));
    s.walkers = s.walkers.filter((w) => w.kind !== "researcher" || keep.has(w.id));
    expect(offerPoach(s, from("metameta"))).toBe(false);
  });
});

describe("a year of it", () => {
  it("letting everyone go costs researchers and seeds neo labs; matching costs money instead", () => {
    const letgo = runDefectionYear(2, "counter", "letgo");
    const match = runDefectionYear(2, "counter", "match");
    expect(letgo.poaching!.offers).toBeGreaterThan(0);
    expect(letgo.poaching!.lost).toBeGreaterThan(0);
    expect(match.poaching!.lost).toBe(0);
    expect(match.poaching!.matched).toBeGreaterThan(0);
  });
});

describe("FLT-56: each lab poaches in its own voice", () => {
  it("every built-in rival and every neo lab has its own letter, filled in with no placeholders left", () => {
    const letters = new Set<string>();
    for (const r of RIVAL_DEFS) {
      const s = staged(r.id);
      const vars = poachingVars(s);
      expect(vars.poacherId).toBe(r.id);
      const l = dramaLetter(CARD, vars.poacherId)!;
      expect(l.poacher).toBe(r.id);
      const text = [l.from, l.subject, ...l.lines, l.sign].map((x) => fillTemplate(x, vars)).join("\n");
      expect(text).not.toMatch(/\{\w+\}/);
      letters.add(l.subject);
    }
    expect(letters.size).toBe(RIVAL_DEFS.length);
    expect(dramaLetter(CARD, "neo:3")?.poacher).toBe("neo");
    expect(dramaLetter(CARD)?.poacher).toBeUndefined();
    expect(dramaLetter(CARD, "somebody-new")?.poacher).toBeUndefined();
  });
});
