import { describe, expect, it } from "vitest";
import { BIRD_OUTCOMES, BIRDAPP, birdContent, type BirdOutcome } from "../../content/birdapp";
import { createInitialState } from "../state";
import { createRng } from "../rng";
import { hypeResting } from "../economy";
import { enableEarnedPacks, updateProgression } from "../progression";
import { hire } from "../staff";
import { answer, createTestCampus, readyForPressure } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import { checkCall, runVerb } from "../verbs";
import type { GameState } from "../types";
import { dailyBirdApp, enableBirdApp, makeHandle, outcomeOdds, rollOutcome, setBirdLever } from "./driver";
import { auraApplicants, auraHype, auraVisitors, poachAppeal } from "./effects";
import { posterStored, stepComms, stepPoster, type CommsStored, type PosterStored } from "./machines";
import { BIRD as R } from "./pack";

/** A lab of 11 researchers with the Bird App awake. */
function lab(seed = 3) {
  const s = createTestCampus(seed);
  readyForPressure(s);
  enableBirdApp(s);
  return s;
}
function days(s: GameState, n: number, each: (s: GameState) => void = () => {}) {
  for (let i = 0; i < n * TICKS_PER_DAY; i++) {
    if (s.tick % TICKS_PER_DAY === 0) each(s);
    tick(s, answer(s));
  }
}
const posters = (s: GameState) => Object.values(s.birdapp!.posters);

describe("the poster's tier machine", () => {
  const go = (stored: PosterStored, ...events: Parameters<typeof stepPoster>[1][]) => {
    const seen: string[] = [];
    for (const e of events) {
      const r = stepPoster(stored, e);
      stored = r.stored;
      seen.push(...r.effects.map((x) => x.type));
    }
    return { value: stored.value, seen };
  };
  it("a banger past the line promotes; one short of it does nothing", () => {
    expect(go(posterStored("occasional"), { type: "BANGER", promote: false })).toEqual({ value: "occasional", seen: [] });
    expect(go(posterStored("occasional"), { type: "BANGER", promote: true })).toEqual({ value: "big", seen: ["PROMOTED"] });
  });
  it("a cancel drops a tier, takes a posting break, or ends in a resignation", () => {
    expect(go(posterStored("big"), { type: "CANCELLED", fate: "target", until: 0 })).toEqual({ value: "occasional", seen: ["DEMOTED"] });
    expect(go(posterStored("occasional"), { type: "CANCELLED", fate: "target", until: 0 })).toEqual({ value: "recluse", seen: ["DEMOTED"] });
    expect(go(posterStored("big"), { type: "CANCELLED", fate: "leave", until: 0 })).toEqual({ value: "gone", seen: ["LEFT"] });
    // A big account comes back from its break an occasional poster.
    expect(go(posterStored("big"), { type: "CANCELLED", fate: "break", until: 30 }, { type: "DAY", day: 29 }, { type: "DAY", day: 30 }))
      .toEqual({ value: "occasional", seen: ["BREAK", "BACK"] });
  });
  it("reaches every state, and a recluse ignores the timeline", () => {
    const reached = new Set<string>();
    for (const tier of ["recluse", "occasional", "big"] as const) {
      reached.add(tier);
      reached.add(go(posterStored(tier), { type: "CANCELLED", fate: "break", until: 9 }).value);
      reached.add(go(posterStored(tier), { type: "QUIT" }).value);
    }
    expect(reached).toEqual(new Set(["recluse", "occasional", "big", "break", "gone"]));
    expect(go(posterStored("recluse"), { type: "BANGER", promote: true }, { type: "CANCELLED", fate: "leave", until: 0 })).toEqual({ value: "recluse", seen: [] });
  });
});

describe("the Comms desk", () => {
  it("calm, busy, drowning and back, saying so on the way in and out", () => {
    let c: CommsStored = { value: "calm", context: {} };
    const seen: string[] = [];
    for (const queue of [0, 2, 9, 9, 3, 0]) {
      const r = stepComms(c, { type: "DAY", queue, limit: 5 });
      c = r.stored;
      seen.push(`${c.value}${r.effects.map((e) => `:${e.type}`).join("")}`);
    }
    expect(seen).toEqual(["calm", "busy", "drowning:DROWNING", "drowning", "busy:SURFACED", "calm"]);
  });
});

describe("the odds", () => {
  const tally = (spice: number, reviewed: boolean, n = 40_000) => {
    const rng = createRng(7);
    const odds = outcomeOdds(spice, reviewed);
    const out = Object.fromEntries(BIRD_OUTCOMES.map((o) => [o, 0])) as Record<BirdOutcome, number>;
    for (let i = 0; i < n; i++) out[rollOutcome(rng.next(), odds)]++;
    return { odds, freq: Object.fromEntries(BIRD_OUTCOMES.map((o) => [o, out[o] / n])) as Record<BirdOutcome, number> };
  };
  /** How much a post swings the Aura, on average and how widely: a spicier post is a bigger bet both ways. */
  const swing = (odds: Record<BirdOutcome, number>) => {
    const delta: Record<BirdOutcome, number> = { flop: 0, banger: R.aura.banger.occasional, controversy: R.aura.controversy, ratioed: R.aura.ratioed, cancelled: R.aura.cancelled };
    const mean = BIRD_OUTCOMES.reduce((a, o) => a + odds[o] * delta[o], 0);
    return Math.sqrt(BIRD_OUTCOMES.reduce((a, o) => a + odds[o] * (delta[o] - mean) ** 2, 0));
  };
  it("the dice land on the odds, at every spice", () => {
    for (const spice of [0, 0.25, 0.5, 0.75, 1]) {
      const { odds, freq } = tally(spice, false);
      expect(BIRD_OUTCOMES.reduce((a, o) => a + odds[o], 0)).toBeCloseTo(1, 9);
      for (const o of BIRD_OUTCOMES) expect(Math.abs(freq[o] - odds[o]), `${o} at spice ${spice}`).toBeLessThan(0.01);
    }
  });
  it("spicier posts are higher variance: more bangers and far more cancels", () => {
    const mild = outcomeOdds(0.1, false);
    const hot = outcomeOdds(0.9, false);
    expect(hot.banger).toBeGreaterThan(mild.banger * 2);
    expect(hot.cancelled).toBeGreaterThan(mild.cancelled * 10);
    expect(hot.flop).toBeLessThan(mild.flop - 0.3);
    let last = 0;
    for (const spice of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const sd = swing(outcomeOdds(spice, false));
      expect(sd).toBeGreaterThan(last);
      last = sd;
    }
  });
  it("Comms takes the edge off both ways: fewer cancels, fewer bangers", () => {
    for (const spice of [0.3, 0.6, 0.9]) {
      const raw = outcomeOdds(spice, false);
      const run = outcomeOdds(spice, true);
      expect(run.cancelled).toBeLessThan(raw.cancelled);
      expect(run.banger).toBeLessThan(raw.banger);
      expect(swing(run)).toBeLessThan(swing(raw));
    }
  });
});

describe("a year on the timeline", () => {
  it("everyone on staff gets a profile with a unique parody handle, in every tier", () => {
    const s = lab();
    days(s, 2);
    const ps = posters(s);
    expect(ps.length).toBe(s.walkers.filter((w) => w.kind === "researcher").length);
    expect(new Set(ps.map((p) => p.handle)).size).toBe(ps.length);
    const rng = createRng(1);
    const taken = new Set<string>();
    for (let i = 0; i < 300; i++) taken.add(makeHandle(rng, ["only_stem"], (h) => taken.has(h)));
    expect(taken.size).toBe(300);
  });
  it("posts, lands every kind of outcome and moves the Aura, the same way every time", () => {
    const a = lab();
    const b = lab();
    days(a, 150);
    days(b, 150);
    expect(a.birdapp).toEqual(b.birdapp);
    expect(a.news).toEqual(b.news);
    const t = a.birdapp!.tally;
    expect(t.posts).toBeGreaterThan(60);
    expect(t.bangers).toBeGreaterThan(0);
    expect(t.controversies + t.ratios + t.cancels).toBeGreaterThan(0);
    expect(new Set(a.birdapp!.history).size).toBeGreaterThan(3);
    // A save half way picks up where it left off.
    const c = lab();
    days(c, 70);
    const d = JSON.parse(JSON.stringify(c)) as GameState;
    days(c, 80);
    days(d, 80);
    expect(d.birdapp).toEqual(c.birdapp);
  });
  it("its toasts fold by group and its headlines badge the folded app (FLT-54)", () => {
    const s = lab();
    const seen: GameState["toasts"] = [];
    days(s, 150, (x) => seen.push(...x.toasts.filter((t) => !seen.includes(t))));
    const viral = seen.filter((t) => t.text.includes("went viral"));
    const cancelled = seen.filter((t) => t.text.includes("is cancelled"));
    expect(viral.length + cancelled.length).toBeGreaterThan(0);
    for (const t of viral) expect(t.group).toEqual({ kind: "viral", who: expect.stringMatching(/^@/) });
    for (const t of cancelled) expect(t.group).toEqual({ kind: "cancelled", who: expect.stringMatching(/^@/) });
    expect(s.news.some((n) => n.panel === "birdapp")).toBe(true);
  });
  it("a post's outcome and engagement are rolled when it is scheduled, and it only lands at the next midnight", () => {
    const s = lab();
    days(s, 30);
    const open = s.birdapp!.posts.filter((p) => !p.settled);
    for (const p of open) {
      expect(p.tick).toBeGreaterThan(s.tick - TICKS_PER_DAY);
      expect(p.likes).toBeGreaterThan(0);
    }
  });
});

describe("the levers", () => {
  it("Please log off: drafts deleted, no posts, and their focus pays for it", () => {
    const s = lab();
    days(s, 3);
    const ids = posters(s).map((p) => p.id);
    const focus = () => ids.map((id) => s.walkers.find((w) => w.id === id)?.focus ?? 0).reduce((a, b) => a + b, 0);
    for (const id of ids) setBirdLever(s, id, "logoff");
    expect(s.birdapp!.posts.filter((p) => !p.settled && p.tick > s.tick)).toEqual([]);
    const before = s.birdapp!.tally.posts;
    const settledBefore = s.birdapp!.posts.filter((p) => !p.settled).length;
    // With focus pinned high each morning, the lever's drop is what we see at the next midnight.
    const f0 = focus();
    dailyBirdApp(s);
    expect(focus()).toBeLessThan(f0);
    days(s, 20);
    expect(s.birdapp!.tally.posts - before).toBe(settledBefore);
    expect(posters(s).every((p) => p.offDays > 0 || p.lever !== "logoff")).toBe(true);
  });
  it("Run it by Comms: reviewed posts, milder spice, as far as the desk's capacity goes", () => {
    const s = lab();
    hire(s, "comms");
    hire(s, "comms");
    days(s, 1);
    for (const p of posters(s)) setBirdLever(s, p.id, "comms");
    days(s, 40);
    const recent = s.birdapp!.posts;
    expect(recent.length).toBeGreaterThan(5);
    expect(recent.filter((p) => p.reviewed).length).toBeGreaterThan(recent.length / 2);
    for (const p of recent) if (p.reviewed) expect(p.spice).toBeLessThanOrEqual(R.comms.spice + 0.001);
  });
});

describe("the Comms queue", () => {
  const fire = (s: GameState, kind: "controversy" | "cancelled", n: number) => {
    const ids = posters(s).filter((p) => p.machine.value !== "gone").map((p) => p.id);
    for (let i = 0; i < n; i++) s.birdapp!.queue.push({ post: -1 - i, by: ids[i % ids.length]!, kind, day: s.day });
  };
  it("too many fires at once and the PR team drowns, says so, and the ones it cannot reach stick", () => {
    const s = lab();
    days(s, 2);
    for (const p of posters(s)) setBirdLever(s, p.id, "logoff");
    fire(s, "controversy", 12);
    s.day++;
    dailyBirdApp(s);
    expect(s.birdapp!.comms.value).toBe("drowning");
    expect(s.toasts.some((t) => t.source === "birdapp" && t.importance === "you")).toBe(true);
    for (let i = 0; i < R.comms.sticksDays; i++) {
      s.day++;
      dailyBirdApp(s);
    }
    expect(s.birdapp!.tally.stuck).toBeGreaterThan(0);
  });
  it("a desk with reps contains a cancel: a posting break, not a resignation", () => {
    const s = lab();
    for (let i = 0; i < 3; i++) hire(s, "comms");
    days(s, 2);
    const p = posters(s).find((x) => x.machine.value === "occasional" || x.machine.value === "big")!;
    for (const q of posters(s)) setBirdLever(s, q.id, "logoff");
    s.birdapp!.queue.push({ post: -1, by: p.id, kind: "cancelled", day: s.day });
    s.day++;
    dailyBirdApp(s);
    expect(s.birdapp!.queue).toEqual([]);
    expect(s.birdapp!.posters[p.id]!.machine.value).toBe("break");
    expect(s.birdapp!.tally.stuck).toBe(0);
  });
});

describe("what the Aura does, and the pack asleep", () => {
  it("feeds Hype, visitors and applicants, and a hot poster is who rivals call first", () => {
    const s = lab();
    days(s, 2);
    s.birdapp!.aura = 0;
    const flat = hypeResting(s);
    s.birdapp!.aura = 60;
    expect(hypeResting(s) - flat).toBeCloseTo(60 * R.effects.hype, 5);
    expect(auraVisitors(s)).toBeGreaterThan(1);
    expect(auraApplicants(s)).toBeGreaterThan(1);
    const p = posters(s)[0]!;
    p.hot = true;
    expect(poachAppeal(s, p.id)).toBe(2);
  });
  it("asleep, it is identity: no state, +0 Hype, x1 visitors and applicants", () => {
    const s = createTestCampus(3);
    days(s, 5);
    expect(s.birdapp).toBeUndefined();
    expect([auraHype(s), auraVisitors(s), auraApplicants(s), poachAppeal(s, 1)]).toEqual([0, 1, 1, 0]);
  });
  it("wakes with its rung, and ?birdapp=off keeps it asleep", () => {
    const on = createInitialState(1, "campus");
    enableEarnedPacks(on);
    expect(on.birdapp?.enabled).toBe(true);
    const off = createInitialState(1);
    off.flags.birdappOff = 1;
    off.progression = { value: "complete", context: { level: 5 } };
    updateProgression(off);
    enableEarnedPacks(off);
    expect(off.birdapp).toBeUndefined();
  });
});

describe("content and the birdapp.post verb", () => {
  const bird = birdContent(BIRDAPP);
  it("seven archetypes, each with its own lines; every outcome has a reply and the loud ones a headline", () => {
    expect(bird.archetypes.map((a) => a.name.replace(/^The /, ""))).toEqual(["Midnight Oracle", "Launch Hype Account", "\"We're So Back\" Duo", "Thread Guy", "Leaderboard Screenshotter", "Brunch Doomer", "Anon Alt"]);
    expect(bird.posts.length).toBeGreaterThanOrEqual(60);
    for (const a of bird.archetypes) expect(bird.posts.filter((p) => p.archetype === a.id).length, a.id).toBeGreaterThanOrEqual(5);
    for (const o of BIRD_OUTCOMES) expect(bird.events(o, "reply").length, o).toBeGreaterThan(0);
    for (const o of ["banger", "controversy", "cancelled"] as const) expect(bird.events(o, "headline").length, o).toBeGreaterThan(0);
    for (const p of bird.posts) if (p.answer) expect(bird.archetypeById.get(p.archetype)?.duo, p.id).toBe(true);
    for (const row of [...bird.posts.map((p) => p.text), ...bird.posts.flatMap((p) => p.answer ?? [])]) {
      for (const [, v] of row.matchAll(/\{(\w+)\}/g)) expect(["model", "rival", "lab"]).toContain(v);
    }
  });
  it("checks its params and puts a post on the timeline that lands as told", () => {
    expect(checkCall({ type: "birdapp.post", params: { text: "we are so back" } }, "verb", "t")).toEqual([]);
    expect(checkCall({ type: "birdapp.post", params: { text: "x", outcome: "viral" } }, "verb", "t")).not.toEqual([]);
    const s = lab();
    days(s, 2);
    const n = s.birdapp!.posts.length;
    runVerb({ state: s, rng: createRng(1), run: null, owner: "test" }, { type: "birdapp.post", params: { text: "the water discourse is so back", outcome: "banger" } });
    const post = s.birdapp!.posts[n]!;
    expect(post).toMatchObject({ text: "the water discourse is so back", outcome: "banger", settled: false });
    const bangers = s.birdapp!.tally.bangers;
    days(s, 1);
    expect(s.birdapp!.tally.bangers).toBeGreaterThan(bangers);
  });
});
