import { describe, expect, it } from "vitest";
import { ESCAPE, loadEscapePack } from "../../content/escape";
import { createSimHandle } from "../../app/sim";
import { chaseSpeedOf } from "../../app/machine";
import { readDebugParams } from "../../debug";
import { enableEndings } from "../endings/state";
import { staffOf } from "../staff";
import { answer, createTestCampus } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState, Walker } from "../types";
import { checkCall } from "../verbs";
import { catchAgent, chasing, dailyEscape, disableEscape, escapeView, sprintSpeed, startChance, startEscape } from "./driver";
import { escapeLab, ESCAPE_MOMENTS, stageEscape } from "./demo";
import type { RunnerPhase } from "./machine";
import type { Runner } from "./state";
import escapeJson from "../../../mods/base-escape/mod.json";
import { createMidgameScenario } from "../scenarios/midgame";
import { SCRUTINY_WAKES } from "../../content/progression";
import { defs } from "../defs";
import { askFlag } from "../disasters/names";
import { cardAllowed, dailyEvents, openEventOf } from "../events";

const R = ESCAPE.rules;

/** A busy Era 3 lab with the pack on and a few drifted agents (the moments' lab). */
function lab(seed = 3, honeypot = false): GameState {
  const s = createTestCampus(seed);
  escapeLab(s, honeypot);
  return s;
}
const walkerOf = (s: GameState, r: Runner): Walker | undefined => s.walkers.find((w) => w.id === r.walker);
/** Tick, answering any card, until `done` or `max` ticks. */
function until(s: GameState, done: () => boolean, max: number) {
  for (let i = 0; i < max && !done(); i++) tick(s, answer(s));
}
const phase = (r: Runner): RunnerPhase => r.machine.value;
/** Send the guards home, so nobody tackles anybody. */
const noGuards = (s: GameState) => { s.staff = s.staff.filter((g) => g.job !== "security"); };

describe("the pack", () => {
  it("loads, with a line for every moment and a headline for every trigger", () => {
    expect(() => loadEscapePack(escapeJson)).not.toThrow();
  });
  it("refuses a pack missing a trigger's headline", () => {
    const broken = structuredClone(escapeJson) as typeof escapeJson;
    broken.content.headlines.add = broken.content.headlines.add.filter((h) => h.trigger !== "trapped");
    expect(() => loadEscapePack(broken)).toThrow(/trapped/);
  });
  it("gets likelier with the era and every lesson, and faster, up to a cap", () => {
    expect(startChance(1, 0)).toBeLessThan(startChance(3, 0));
    expect(startChance(3, 0)).toBeLessThan(startChance(3, 2));
    expect(sprintSpeed(1)).toBeGreaterThan(sprintSpeed(0));
    expect(sprintSpeed(99)).toBe(R.run.sprintMax);
  });
});

describe("balance", () => {
  it("ignoring it is a real risk, not a death spiral: an unguarded mid-game lab nears the ending late, not early", () => {
    // The 480-day mid-game campus: every pack awake, no Security on the fence, no Sandbox, no Honeypot.
    const s = createMidgameScenario();
    expect(s.escape!.escaped).toBeGreaterThanOrEqual(3);
    expect(s.escape!.escaped).toBeLessThan(10);
  }, 60_000);

  it("wakes last on Scrutiny, one pack entry with its own New! card", () => {
    const wake = SCRUTINY_WAKES.find((w) => w.id === "escape")!;
    expect(wake.title).toBe("New! The Sandbox Escape");
    expect(Math.max(...SCRUTINY_WAKES.map((w) => w.after))).toBe(wake.after);
  });
});

describe("the warning", () => {
  it("broods for a day, then paces the fence it is nearest, thinking about it", () => {
    const s = lab();
    const [r] = startEscape(s);
    expect(phase(r!)).toBe("brooding");
    expect(walkerOf(s, r!)!.machine.value).not.toBe("escaping");
    until(s, () => phase(r!) === "pacing", 2 * TICKS_PER_DAY);
    expect(phase(r!)).toBe("pacing");
    const w = walkerOf(s, r!)!;
    expect(w.machine.value).toBe("escaping");
    until(s, () => r!.timer < R.warn.paceTicks - 4, 200);
    // At the fence: within a couple of tiles of an edge.
    expect(Math.min(w.x, w.z, s.grid.w - w.x, s.grid.h - w.z)).toBeLessThan(3);
    expect(s.thoughts.find((t) => t.walkerId === w.id)?.text).toBeTruthy();
  });

  it("starts on its own only once an agent has drifted past the line", () => {
    const s = lab();
    for (const w of s.walkers) if (w.kind === "agent") w.drift = R.start.minDrift - 0.2;
    for (let d = 0; d < 60; d++) { s.day++; dailyEscape(s); }
    expect(s.escape!.runners).toHaveLength(0);
    s.walkers.find((w) => w.kind === "agent")!.drift = 0.95;
    for (let d = 0; d < 60 && s.escape!.runners.length === 0; d++) { s.day++; dailyEscape(s); }
    expect(s.escape!.runners).toHaveLength(1);
  });

  it("cools off instead if its drift comes down while it broods", () => {
    const s = lab();
    const [r] = startEscape(s);
    walkerOf(s, r!)!.drift = 0;
    s.day++;
    dailyEscape(s);
    expect(s.escape!.runners).toHaveLength(0);
    expect(s.escape!.history.at(-1)?.outcome).toBe("calm");
  });
});

describe("the run", () => {
  it("bolts for a fence point away from the gate, slows the game (chase) and sends the nearest guards", () => {
    const s = lab();
    // The moments' guards walk a patch by their office; these walk the fence, as hired guards do.
    applyNow(s, staffOf(s, "security").map((g) => ({ type: "clearZone" as const, id: g.id })));
    const [r] = startEscape(s, { pace: true });
    until(s, () => phase(r!) === "running", 200);
    expect(phase(r!)).toBe("running");
    expect(chasing(s)).toBe(true);
    expect(escapeView(s)!.chase).toBe(true);
    const [fx, fz] = r!.route[0]!;
    expect(fx > s.gate.x - 2 && fx < s.gate.x + s.gate.w + 2 && fz > s.grid.h - 3).toBe(false);
    expect(r!.guards.length).toBeGreaterThan(0);
    expect(staffOf(s, "security").filter((g) => g.chase?.runner === r!.walker).length).toBe(r!.guards.length);
  });

  it("gets out if nobody stops it: gone from the World, hype down, news now and stories later", () => {
    const s = lab();
    noGuards(s);
    const [r] = startEscape(s, { pace: true });
    const id = r!.walker;
    const hype = s.hype;
    until(s, () => s.escape!.runners.length === 0, 400);
    expect(s.walkers.some((w) => w.id === id)).toBe(false);
    expect(s.escape!.escaped).toBe(1);
    expect(s.escape!.lessons).toBe(1);
    expect(s.hype).toBeLessThan(hype);
    expect(s.escape!.aftermath).toHaveLength(R.aftermath.stories);
    expect(s.toasts.some((t) => t.text.includes(r!.name))).toBe(true);
    const news = s.news.length;
    const due = s.escape!.aftermath[0]!.day;
    until(s, () => s.day > due, (due - s.day + 1) * TICKS_PER_DAY);
    expect(s.news.length).toBeGreaterThan(news);
    // The cluster makes a new one to replace it.
    expect(s.walkers.filter((w) => w.kind === "agent").length).toBeGreaterThan(0);
  });

  it("is tackled by a guard it runs into, and marched back inside", () => {
    const s = lab();
    const [r] = startEscape(s, { pace: true });
    until(s, () => phase(r!) === "running", 200);
    const w = walkerOf(s, r!)!;
    const g = staffOf(s, "security")[0]!;
    delete g.chase;
    g.x = w.x;
    g.z = w.z;
    tick(s);
    expect(phase(r!)).toBe("tackled");
    expect(s.escape!.tackled).toBe(1);
    until(s, () => s.escape!.runners.length === 0, R.guards.tackledTicks + 2);
    expect(s.escape!.history.at(-1)?.outcome).toBe("tackled");
    expect(w.machine.value).not.toBe("escaping");
    expect(s.walkers.includes(w)).toBe(true);
    expect(staffOf(s, "security").every((x) => !x.chase)).toBe(true);
  });

  it("falls for the Honeypot's EXIT (real)", () => {
    const s = lab(3, true);
    noGuards(s);
    const [r] = startEscape(s, { pace: true });
    r!.dice.lure = 0;
    until(s, () => phase(r!) === "trapped" || s.escape!.runners.length === 0, 400);
    expect(phase(r!)).toBe("trapped");
    until(s, () => s.escape!.runners.length === 0, R.honeypot.trappedTicks + 2);
    expect(s.escape!.trapped).toBe(1);
    expect(s.escape!.escaped).toBe(0);
  });
});

describe("the screen", () => {
  /** A lab mid-chase, and the same lab with nobody out, with every card asking for the screen today. */
  function asking() {
    const s = lab();
    noGuards(s);
    // Past the first-cards gate (day 40, a model earning).
    s.day = 60;
    s.flags.firstRevenue = 0;
    const [r] = startEscape(s, { pace: true });
    until(s, () => phase(r!) === "running", 200);
    const calm = structuredClone(s);
    disableEscape(calm);
    for (const w of [s, calm]) {
      delete w.pacer;
      for (const def of defs().events) w.flags[askFlag(def.id)] = 0;
    }
    return { s, calm, r: r! };
  }

  it("holds every card while a runner is out, so nothing pauses the chase", () => {
    const { s, calm } = asking();
    expect(cardAllowed(structuredClone(calm), defs().events[0]!.id)).toBe(true);
    dailyEvents(calm);
    expect(openEventOf(calm)).not.toBeNull();
    expect(cardAllowed(s, defs().events[0]!.id)).toBe(false);
    dailyEvents(s);
    expect(openEventOf(s)).toBeNull();
  });

  it("plays the whole chase through without a card, and lets the card through once it is over", () => {
    const { s, r } = asking();
    let interrupted = 0;
    for (let i = 0; i < 4000 && chasing(s); i++) {
      if (openEventOf(s)) interrupted++;
      tick(s, answer(s));
    }
    expect(interrupted).toBe(0);
    expect(phase(r)).not.toBe("running");
    for (let i = 0; i < 10 * TICKS_PER_DAY && !openEventOf(s); i++) {
      for (const def of defs().events) s.flags[askFlag(def.id)] = 0;
      tick(s, []);
    }
    expect(openEventOf(s)).not.toBeNull();
  });
});

describe("the catch", () => {
  it("picks up a running agent and puts it back in the Sandbox, calmed right down", () => {
    const s = lab();
    const [r] = startEscape(s, { pace: true });
    until(s, () => phase(r!) === "running", 200);
    applyNow(s, [{ type: "catchAgent", id: r!.walker }]);
    expect(phase(r!)).toBe("carried");
    expect(r!.carry!.sandbox).toBe(true);
    expect(staffOf(s, "security").every((g) => !g.chase)).toBe(true);
    until(s, () => s.escape!.runners.length === 0, R.catch.carryTicks + 2);
    const w = walkerOf(s, r!)!;
    expect(w.machine.value).not.toBe("escaping");
    expect(w.drift).toBeLessThanOrEqual(R.catch.driftAfter);
    expect(s.escape!.grabbed).toBe(1);
    expect(s.escape!.history.at(-1)?.outcome).toBe("grabbed");
    expect(chasing(s)).toBe(false);
  });

  it("can grab one pacing, but not one still brooding or somebody who isn't leaving", () => {
    const s = lab();
    const [r] = startEscape(s);
    expect(catchAgent(s, r!.walker)).toBe(false);
    const other = s.walkers.find((w) => w.kind === "researcher")!;
    expect(catchAgent(s, other.id)).toBe(false);
    until(s, () => phase(r!) === "pacing", 2 * TICKS_PER_DAY);
    expect(catchAgent(s, r!.walker)).toBe(true);
    expect(catchAgent(s, r!.walker)).toBe(false);
  });
});

describe("a jailbreak", () => {
  it("sends several at once, each for a different fence", () => {
    const s = lab();
    for (const w of s.walkers.filter((x) => x.kind === "agent").slice(0, 6)) w.drift = 0.9;
    const crew = startEscape(s, { pace: true, count: 4 });
    expect(crew.length).toBe(4);
    expect(crew.every((r) => r.jail)).toBe(true);
    expect(new Set(crew.map((r) => r.side)).size).toBe(4);
    until(s, () => crew.every((r) => phase(r) !== "pacing"), 200);
    expect(s.toasts.filter((t) => t.text.startsWith("JAILBREAK")).length).toBe(1);
  });
});

describe("determinism and switches", () => {
  const play = () => {
    const s = lab(11);
    for (const w of s.walkers.filter((x) => x.kind === "agent")) w.drift = Math.max(w.drift, 0.8);
    s.escape!.lastRun = -99;
    // A lab whose agents have already learned plenty from the ones that got out: tries come often.
    s.escape!.lessons = 20;
    for (let i = 0; i < 40 * TICKS_PER_DAY; i++) tick(s, answer(s));
    return s;
  };
  it("replays the same tries, to the tick, from the same seed", () => {
    const a = play();
    const b = play();
    expect(a.escape!.history.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.escape)).toBe(JSON.stringify(b.escape));
    expect(JSON.stringify(a.walkers)).toBe(JSON.stringify(b.walkers));
  });

  it("?escape=off keeps the pack asleep; disabling it mid-run puts everyone back", () => {
    expect(createSimHandle(readDebugParams("?warp=1&escape=off")).world.escape).toBeUndefined();
    expect(createSimHandle(readDebugParams("?warp=1")).world.escape?.enabled).toBe(true);
    const s = lab();
    const [r] = startEscape(s, { pace: true });
    until(s, () => phase(r!) === "running", 200);
    disableEscape(s);
    expect(s.escape!.runners).toHaveLength(0);
    expect(walkerOf(s, r!)!.machine.value).not.toBe("escaping");
    expect(staffOf(s, "security").every((g) => !g.chase)).toBe(true);
    expect(startEscape(s)).toEqual([]);
  });

  it("the spawn.escape verb is in the Vocabulary", () => {
    expect(checkCall({ type: "spawn.escape", params: { count: 3, now: true } }, "verb", "test")).toEqual([]);
  });

  it("every review moment stages something to look at", () => {
    for (const m of ESCAPE_MOMENTS) {
      const s = createTestCampus(3);
      stageEscape(s, m);
      const phases = s.escape!.runners.map(phase);
      const want: Record<(typeof ESCAPE_MOMENTS)[number], RunnerPhase> = {
        "escape-warning": "pacing", "escape-run": "running", "escape-carry": "carried", "escape-jailbreak": "running", "escape-honeypot": "running",
      };
      expect(phases, m).toContain(want[m]);
    }
  });
});

describe("the app's slow-down", () => {
  it("drops to 1x for the chase and puts the speed back after, unless the player chose one", () => {
    expect(chaseSpeedOf({ speed: 3, chaseSpeed: null }, true)).toEqual({ speed: 1, chaseSpeed: 3 });
    expect(chaseSpeedOf({ speed: 1, chaseSpeed: 3 }, true)).toEqual({ speed: 1, chaseSpeed: 3 });
    expect(chaseSpeedOf({ speed: 1, chaseSpeed: 3 }, false)).toEqual({ speed: 3, chaseSpeed: null });
    expect(chaseSpeedOf({ speed: 0, chaseSpeed: null }, true)).toEqual({ speed: 0, chaseSpeed: null });
    expect(chaseSpeedOf({ speed: 1, chaseSpeed: null }, true)).toEqual({ speed: 1, chaseSpeed: null });
  });
});

describe("the Escaped ending", () => {
  /** Let one agent out, nobody in the way, then see the next morning. */
  function letOneOut(s: GameState, frontier = false) {
    noGuards(s);
    const [r] = startEscape(s, { pace: true });
    r!.frontier = frontier;
    until(s, () => s.escape!.runners.length === 0, 400);
    const day = s.day;
    until(s, () => s.day > day, TICKS_PER_DAY + 1);
  }

  it("comes at ten escapes, counted for the run summary, and ends in one last jailbreak", () => {
    const s = lab();
    enableEndings(s);
    s.escape!.escaped = 8;
    letOneOut(s);
    expect(s.escape!.escaped).toBe(9);
    expect(s.endings!.agentsEscaped).toBe(1);
    expect(s.endings!.run).toBeNull();
    letOneOut(s);
    expect(s.endings!.id).toBe("escaped");
    // Its first beat lets five more loose at once, and the paper goes to press a few days on.
    expect(s.escape!.runners.length).toBeGreaterThanOrEqual(3);
    until(s, () => s.endings!.endedDay !== null, 8 * TICKS_PER_DAY);
    expect(s.endings!.endedDay).not.toBeNull();
  });

  it("comes at once if the newest model's agent gets out in Era 4, and not before Era 4", () => {
    const early = lab();
    enableEndings(early);
    letOneOut(early, true);
    expect(early.escape!.frontierOut).toBe(false);
    expect(early.endings!.run).toBeNull();

    const s = lab();
    enableEndings(s);
    s.race.era = { value: "era4", context: { peak: Math.max(30, s.race.mult) } } as typeof s.race.era;
    letOneOut(s, true);
    expect(s.escape!.frontierOut).toBe(true);
    expect(s.endings!.id).toBe("escaped");
  });

  it("tags the run's toasts as yours and leaves the aftermath to the news", () => {
    const s = lab();
    const toasts: GameState["toasts"] = [];
    noGuards(s);
    startEscape(s, { pace: true });
    for (let i = 0; i < 400 && s.escape!.runners.length; i++) { tick(s, answer(s)); toasts.push(...s.toasts); }
    const ours = toasts.filter((t) => t.source === "escape");
    expect(ours.length).toBeGreaterThan(0);
    expect(ours.every((t) => t.importance === "you")).toBe(true);
  });
});
