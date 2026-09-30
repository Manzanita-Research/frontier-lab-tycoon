import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { getShortestPaths } from "xstate/graph";
import { eventById } from "../../content/events";
import { createTestCampus } from "../testkit";
import { answer, readyForPressure } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import { openEventOf } from "../events";
import { inspectWalker } from "../inspect";
import { checkCall } from "../verbs";
import { structuralChart } from "../machines/packChart";
import { boardView } from "../race/arena";
import { createInitialState } from "../state";
import { updateProgression } from "../progression";
import { PROGRESSION } from "../../content/progression";
import type { Call } from "../disasters/types";
import type { GameState, Walker } from "../types";
import { applyDefectionChoices, candidates, dailyDefection, enableDefection, disableDefection, scoreDelta } from "./driver";
import { CARD, CHOICES, DEFECTION, loadDefectionPack, MANIFESTO_CARD } from "./pack";
import { runDefectionYear } from "./headless";
import { stageDrama, type DramaMoment } from "./demo";
import defectionJson from "../../../mods/base-defection/mod.json";
import poachingJson from "../../../mods/base-poaching/mod.json";

const R = DEFECTION.rules;
const researchers = (s: GameState) => s.walkers.filter((w) => w.kind === "researcher");
const byId = (s: GameState, id: number) => s.walkers.find((w) => w.id === id);

/** A working lab with the pack on and one senior researcher the VCs are about to notice. */
function staged(seed = 3, reason?: string): { s: GameState; star: Walker } {
  const s = createTestCampus(seed);
  readyForPressure(s);
  enableDefection(s);
  s.day = 60;
  s.tick = 60 * TICKS_PER_DAY;
  const star = researchers(s)[0]!;
  star.stats.joined = 0;
  s.defection!.scores[star.id] = R.thresholds.courtScore + 10;
  dailyDefection(s);
  if (reason && s.defection!.subject) s.defection!.subject.reason = reason;
  return { s, star };
}
/** Tick until `done` (answering any other card with its first choice), or fail after `days`. */
function until(s: GameState, done: (s: GameState) => boolean, days = 40, pick: (id: string) => number = () => 0) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    tick(s, open && !done(s) ? answer(s, pick(open.id)) : []);
  }
  expect(done(s)).toBe(true);
}
const cardOpen = (id: string) => (s: GameState) => openEventOf(s)?.id === id;
const pick = (s: GameState, key: (typeof CHOICES)[number]) => applyNow(s, answer(s, CHOICES.indexOf(key)));

describe("the Defection chart", () => {
  it("reaches every stage (xstate/graph, guards dropped)", () => {
    const chart = structuralChart(DEFECTION.chart);
    const paths = getShortestPaths(createMachine(chart));
    expect(new Set(paths.map((p) => p.state.value))).toEqual(new Set(Object.keys(DEFECTION.chart.states)));
  });
  it("uses checked generic verbs, and the loader rejects a malformed pack", () => {
    for (const [name, node] of Object.entries(DEFECTION.chart.states)) {
      const calls = [...node.entry ?? [], ...node.exit ?? []];
      for (const raw of Object.values(node.on ?? {})) for (const t of Array.isArray(raw) ? raw : [raw]) if (typeof t === "object" && t) calls.push(...t.actions ?? []);
      for (const c of calls) expect(checkCall(c as Call, "verb", `states.${name}`)).toEqual([]);
    }
    expect(() => loadDefectionPack({})).toThrow();
    expect(eventById(CARD)?.choices.map((c) => c.label)).toEqual(["Counter-offer", "Equity", "Make them Head of Safety", "Let them go gracefully"]);
  });
  it("parody names only: every lab-name template and manifesto is made up", () => {
    const words = [...DEFECTION.names.friendly, ...DEFECTION.names.hostile, ...DEFECTION.manifestos.friendly, ...DEFECTION.manifestos.hostile].join(" ");
    for (const real of ["OpenAI", "Anthropic", "Google", "DeepMind", "Meta ", "xAI", "Mistral", "Microsoft", "Thinking Machines", "SSI"]) expect(words).not.toContain(real);
  });
  it("parody names only: nothing either pack says names a real app or site", () => {
    const text = JSON.stringify([defectionJson, poachingJson]);
    for (const real of ["Slack", "LinkedIn", "tweet", "Twitter", "WordPad", "Notepad", "Outlook\"", "Zoom", "Gmail"]) expect(text, real).not.toContain(real);
  });
});

describe("the hidden score", () => {
  const base = { happiness: 0.5, seniority: 1, passedOver: 0, rivalHype: 100, era: 1, bumps: 0 };
  it("rises with low morale, seniority, being passed over, rival hype and the era; content people cool off", () => {
    expect(scoreDelta(base)).toBeGreaterThan(0);
    expect(scoreDelta({ ...base, happiness: 0.3 })).toBeGreaterThan(scoreDelta(base));
    expect(scoreDelta({ ...base, seniority: 0 })).toBeLessThan(scoreDelta(base));
    expect(scoreDelta({ ...base, passedOver: 2 })).toBeGreaterThan(scoreDelta(base));
    expect(scoreDelta({ ...base, era: 3 })).toBeGreaterThan(scoreDelta({ ...base, era: 2 }));
    expect(scoreDelta({ ...base, happiness: 0.8 })).toBeLessThan(0);
  });
  it("rises faster after a counter-offer", () => {
    expect(scoreDelta({ ...base, bumps: 1 })).toBeCloseTo(scoreDelta(base) * (1 + R.score.bump));
  });
});

describe("the warning signs", () => {
  it("a VC walks in, they talk by the Kombucha Bar, the inspector notices, and a domain gets registered", () => {
    const { s, star } = staged();
    expect(s.defection!.machine.value).toBe("courted");
    expect(s.defection!.subject?.id).toBe(star.id);
    const meeting = s.meetings?.[0];
    expect(meeting).toBeDefined();
    const vc = byId(s, meeting!.guestId)!;
    expect(vc.role).toBe("Venture Capitalist");
    expect(meeting!.lines).toHaveLength(2);
    until(s, (x) => x.meetings?.[0]?.phase === "talking", 6);
    const [a, b] = [byId(s, star.id)!, byId(s, vc.id)!];
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThanOrEqual(1.01);
    expect(inspectWalker(s, star.id)!.history[2]).toMatch(/^Seen with VCs by the Kombucha Bar/);
    until(s, (x) => x.day >= 60 + R.signs.headlineDay, 5);
    expect(s.news.some((n) => /registered a domain|building something new/.test(n.text))).toBe(true);
  });
  it("a researcher whose morale is fixed cools off: no card, and they stay", () => {
    const { s, star } = staged();
    s.defection!.scores[star.id] = R.thresholds.coolScore - 1;
    tick(s);
    until(s, (x) => x.defection!.machine.value === "watching", 2);
    expect(s.defection!.subject).toBeNull();
    expect(byId(s, star.id)?.machine.value).not.toBe("quitting");
    expect(s.toasts.some((t) => t.text.includes("seems happier"))).toBe(true);
  });
});

describe("the card", () => {
  it("a player who ignores the warnings loses a senior researcher, followers, capability, and gets a new rival on the Arena", () => {
    const { s, star } = staged(3);
    // Ignore every sign: no morale fixes; the card comes on its own and the player lets them go.
    until(s, cardOpen(CARD));
    const capability = s.capability;
    expect(s.day - 60).toBeGreaterThanOrEqual(R.signs.minWarnDays);
    const team = s.defection!.subject!.team;
    pick(s, "goodbye");
    const x = s.defection!.exit!;
    expect(x.founderId).toBe(star.id);
    expect(x.followers.length).toBeGreaterThanOrEqual(R.exit.minFollowers);
    expect(x.followers.length).toBeLessThanOrEqual(R.exit.maxFollowers);
    for (const id of x.followerIds) expect(team).toContain(id);
    // Box, gate: they walk out together.
    for (const id of [star.id, ...x.followerIds]) expect(byId(s, id)?.machine.value).toBe("quitting");
    expect(s.capability).toBeLessThan(capability * (1 - R.exit.minLoss / 100) + 1e-9);
    expect(s.capability).toBeGreaterThanOrEqual(capability * (1 - R.exit.maxLoss / 100) - 1e-9);
    until(s, cardOpen(MANIFESTO_CARD), 4);
    const lab = s.neoLabs!.labs[0]!;
    expect(lab.founder).toBe(star.name);
    expect(lab.mood).toBe("friendly");
    expect(s.race.board.some((r) => r.id === lab.id)).toBe(true);
    const row = boardView(s).find((r) => r.id === lab.id)!;
    expect(row.neo?.manifesto).toBe(lab.manifesto);
    expect(row.score).toBeLessThan(boardView(s).find((r) => r.you)!.score);
    expect(eventById(MANIFESTO_CARD)!.title).toContain("{neoName}");
  });
  it("counter-offer: costs cash, resets the score, and the clock runs faster next time", () => {
    const { s, star } = staged();
    until(s, cardOpen(CARD));
    const cash = s.cash;
    pick(s, "counter");
    expect(s.cash).toBe(cash - 1_500_000);
    expect(s.defection!.scores[star.id]).toBe(0);
    expect(s.defection!.bumps[star.id]).toBe(1);
    expect(s.defection!.machine.value).toBe("watching");
    expect(byId(s, star.id)?.machine.value).not.toBe("quitting");
  });
  it("equity: revenue a little lighter for six months, and the whole team cheers up", () => {
    const { s, star } = staged();
    until(s, cardOpen(CARD));
    const team = [star.id, ...s.defection!.subject!.team].map((id) => byId(s, id)!).filter(Boolean);
    const before = team.map((w) => w.energy);
    pick(s, "equity");
    expect(s.disasters.effects.some((e) => e.kind === "revenue" && e.value === 0.96)).toBe(true);
    team.forEach((w, i) => expect(w.energy).toBeGreaterThanOrEqual(Math.min(1, before[i]!)));
    expect(team.some((w, i) => w.energy > before[i]!)).toBe(true);
    expect(s.defection!.scores[star.id]).toBe(0);
  });
  it("Head of Safety: the reason sets the odds; a failure is a loud exit and a hostile lab", () => {
    const outcomes = new Set<string>();
    for (let k = 0; k < 12 && outcomes.size < 2; k++) {
      const { s, star } = staged(3, "concerns");
      s.defection!.rngState = (s.defection!.rngState + k * 7919) >>> 0;
      until(s, cardOpen(CARD));
      const trust = s.disasters.trust;
      pick(s, "title");
      if (s.defection!.machine.value === "watching") {
        expect(byId(s, star.id)!.role).toBe("Head of Safety");
        outcomes.add("works");
      } else {
        expect(s.defection!.machine.value).toBe("storming");
        expect(s.defection!.exit!.mood).toBe("hostile");
        expect(s.disasters.trust).toBeLessThan(trust);
        outcomes.add("fails");
      }
    }
    // "I have concerns" is a coin flip: both happen.
    expect(outcomes).toEqual(new Set(["works", "fails"]));
  });
  it("the manifesto card: congratulate softens them, a vaguepost makes a nemesis", () => {
    for (const [choice, check] of [
      [0, (s: GameState, poaching: number) => expect(s.neoLabs!.labs[0]!.rival.context.personality.poaching).toBeCloseTo(poaching / 2)],
      [1, (s: GameState) => expect(s.neoLabs!.labs[0]!.nemesis).toBe(true)],
    ] as const) {
      const { s } = staged();
      until(s, cardOpen(CARD));
      pick(s, "goodbye");
      until(s, cardOpen(MANIFESTO_CARD), 4);
      const poaching = s.neoLabs!.labs[0]!.rival.context.personality.poaching;
      applyNow(s, answer(s, choice));
      check(s, poaching);
    }
  });
  it("ignores a stale pick when no card is open", () => {
    const { s } = staged();
    s.flags["defection:pick:counter"] = s.day;
    const cash = s.cash;
    applyDefectionChoices(s);
    expect(s.cash).toBe(cash);
    expect(s.flags["defection:pick:counter"]).toBeUndefined();
  });
});

describe("the pack as a system", () => {
  it("is off unless enabled; the ladder turns it (and the Poaching War) on at Level 5, Scrutiny", () => {
    const s = createInitialState(4);
    expect(s.defection).toBeUndefined();
    expect(PROGRESSION.find((r) => r.level === 5)!.systems).toEqual(expect.arrayContaining(["defection", "poaching"]));
    s.progression = { value: "growing", context: { level: 4 } } as never;
    s.race.rank = 3; // Level 4's goal: Top 3 on the Arena
    updateProgression(s);
    expect(s.defection?.enabled).toBe(true);
    expect(s.poaching?.enabled).toBe(true);
    const off = createInitialState(4);
    off.flags.defectionOff = 1;
    off.progression = { value: "growing", context: { level: 4 } } as never;
    off.race.rank = 3;
    updateProgression(off);
    expect(off.defection).toBeUndefined();
  });
  it("toggles off cleanly", () => {
    const { s } = staged();
    disableDefection(s);
    expect(s.defection!.enabled).toBe(false);
    expect(s.meetings ?? []).toHaveLength(0);
    const before = JSON.stringify(s.defection);
    dailyDefection(s);
    expect(JSON.stringify(s.defection)).toBe(before);
  });
  it("is deterministic and survives a save/load mid-courtship", () => {
    const a = staged().s;
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    for (let i = 0; i < 20 * TICKS_PER_DAY; i++) {
      tick(a, answer(a, 3));
      tick(b, answer(b, 3));
    }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
  it("a headless year with the pack on: warnings, cards, exits and spin-outs; with it off, nothing", () => {
    const on = runDefectionYear(3, "goodbye");
    expect(on.outcome).not.toBe("lost");
    expect(on.history.some((h) => h.stage === "courted")).toBe(true);
    expect(on.cards.filter((c) => c.id === CARD).length).toBeGreaterThanOrEqual(1);
    expect(on.neoLabs.some((l) => l.origin === "defection")).toBe(true);
    expect(on.board.some((id) => id.startsWith("neo:"))).toBe(true);
    const off = runDefectionYear(3, "off", "off", 120);
    expect(off.world.defection).toBeUndefined();
    expect(off.world.neoLabs).toBeUndefined();
  });
  it("candidates are the top few by score", () => {
    const { s } = staged();
    expect(candidates(s).length).toBeLessThanOrEqual(R.eligibility.candidates);
  });
  it("picks the same top few as sorting everyone by score, then id (FLT-39)", () => {
    const { s } = staged();
    const d = s.defection!;
    const staff = s.walkers.filter((w) => w.kind === "researcher" && !["quitting", "leaving", "gone"].includes(w.machine.value)); // the driver's onStaff
    expect(staff.length).toBeGreaterThan(R.eligibility.candidates + 2);
    for (let round = 0; round < 50; round++) {
      // Few distinct scores, so ties are common; some zero (not candidates at all) and some missing.
      d.scores = {};
      staff.forEach((w, i) => { if ((i + round) % 7 !== 0) d.scores[w.id] = ((i * 31 + round * 17) % 5) * 12.5; });
      const want = staff.filter((w) => (d.scores[w.id] ?? 0) > 0).sort((a, b) => (d.scores[b.id] ?? 0) - (d.scores[a.id] ?? 0) || a.id - b.id).slice(0, R.eligibility.candidates);
      expect(candidates(s).map((w) => w.id)).toEqual(want.map((w) => w.id));
    }
  });
});

describe("review moments", () => {
  const at = (m: DramaMoment) => { const s = createInitialState(7); delete s.progression; delete s.coach; delete s.tutorial; stageDrama(s, m); return s; };
  it("each lands where its name says", () => {
    expect(at("defection-chat").meetings?.some((m) => m.phase === "talking")).toBe(true);
    expect(openEventOf(at("defection-card"))?.id).toBe(CARD);
    const exit = at("defection-exit");
    expect(exit.walkers.filter((w) => w.machine.value === "quitting").length).toBeGreaterThanOrEqual(2);
    expect(openEventOf(at("defection-manifesto"))?.id).toBe(MANIFESTO_CARD);
    const arena = at("defection-arena");
    expect(arena.neoLabs?.labs[0]?.nemesis).toBe(true);
    expect(openEventOf(at("poach-offer"))?.id).toBe("poaching-offer");
  });
});
