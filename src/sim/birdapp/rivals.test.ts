// FLT-92: the rival labs post. Who posts when, each beat, the silence after a slide, the dunk and the ratio, the verb,
// and determinism (same seed, same posts; with `?birdrivals=off`, nothing).
import { describe, expect, it } from "vitest";
import { BIRDAPP, birdContent, RIVAL_BEATS, RIVAL_ROLES } from "../../content/birdapp";
import { RIVAL_DEFS } from "../../content/rivals";
import { defs } from "../defs";
import { ranksOf } from "../race/state";
import { createRng } from "../rng";
import { answer, createTestCampus, readyForPressure } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import { checkCall, runVerb } from "../verbs";
import type { GameState } from "../types";
import { dailyBirdApp, enableBirdApp } from "./driver";
import { labFeedMachine, stepLabFeed } from "./machines";
import { BIRD as R } from "./pack";
import { labSlug } from "./rivals";
import { initialStored } from "../machines/run";
import type { RivalPostRecord } from "./state";

function lab(seed = 3, off = false) {
  const s = createTestCampus(seed);
  if (off) s.flags.birdrivalsOff = 1;
  readyForPressure(s);
  enableBirdApp(s);
  return s;
}
/** One midnight's worth of the Bird App, without the rest of the sim. */
function midnight(s: GameState) {
  s.tick += TICKS_PER_DAY;
  s.day++;
  dailyBirdApp(s);
}
function days(s: GameState, n: number) {
  for (let i = 0; i < n * TICKS_PER_DAY; i++) tick(s, answer(s));
}
const rivals = (s: GameState) => s.birdapp!.rivals!;
const today = (s: GameState) => rivals(s).posts.filter((p) => !p.settled);
/** Run with some rules changed, then put them back. */
function withRules<T>(patch: Partial<typeof R.rivals>, go: () => T): T {
  const was = { ...R.rivals };
  Object.assign(R.rivals, patch);
  try {
    return go();
  } finally {
    Object.assign(R.rivals, was);
  }
}
/** The Arena with `lab` moved to `rank` (1 = top), everyone else keeping their order. */
function moveOnArena(s: GameState, lab: string, rank: number) {
  const rows = s.race.board.filter((r) => r.id !== lab);
  rows.splice(rank - 1, 0, s.race.board.find((r) => r.id === lab)!);
  s.race.board = rows;
}

describe("the rivals' content", () => {
  const bird = birdContent(BIRDAPP);
  it("has 60+ rival lines and 2 to 3 invented voices for every lab", () => {
    expect(BIRDAPP.filter((r) => r.kind === "rival").length).toBeGreaterThanOrEqual(60);
    for (const d of RIVAL_DEFS) {
      const own = bird.voices.filter((v) => v.lab === d.id);
      expect(own.length, d.id).toBeGreaterThanOrEqual(2);
      expect(own.length, d.id).toBeLessThanOrEqual(3);
    }
  });
  it("every lab has something to say on every beat, and every voice a quiet-day line", () => {
    for (const d of RIVAL_DEFS) {
      for (const beat of RIVAL_BEATS) {
        if (beat === "dunk") continue;
        const any = bird.voicesFor(d.id).some((v) => bird.rivalLines(beat, v.role, d.id).length > 0);
        expect(any, `${d.id} on ${beat}`).toBe(true);
      }
      for (const v of bird.voicesFor(d.id)) expect(bird.rivalLines("idle", v.role, d.id).length, `${d.id} ${v.id}`).toBeGreaterThan(0);
      expect(bird.rivalLines("dunk", "us", d.id).length).toBeGreaterThan(0);
    }
  });
  it("fills only the placeholders it has, and a voice belongs to a lab", () => {
    const labs = new Set(["any", ...RIVAL_DEFS.map((d) => d.id)]);
    for (const r of BIRDAPP) {
      if (r.kind === "voice") {
        expect(labs.has(r.lab), r.id).toBe(true);
        expect(RIVAL_ROLES).toContain(r.role);
      }
      if (r.kind !== "rival") continue;
      if (r.lab) expect(labs.has(r.lab), r.id).toBe(true);
      for (const m of r.text.matchAll(/\{(\w+)\}/g)) expect(["you", "me", "rival", "model", "handle", "rank"], `${r.id}: ${m[0]}`).toContain(m[1]);
    }
  });
  it("an `any` voice posts under the lab's own name", () => {
    expect(labSlug("Super Super AI")).toBe("super_super_ai");
    const borrowed = bird.voicesFor("supersuper").find((v) => v.lab === "any")!;
    expect(borrowed).toBeDefined();
    expect(bird.voicesFor("supersuper").filter((v) => v.role === borrowed.role)).toHaveLength(1);
  });
});

describe("a lab's feed machine", () => {
  it("goes quiet after a slide and comes back on the day it said", () => {
    let st = initialStored(labFeedMachine, {});
    let r = stepLabFeed(st, { type: "DROP", until: 12 });
    expect([r.stored.value, r.effects.map((e) => e.type)]).toEqual(["quiet", ["SILENT"]]);
    st = r.stored;
    r = stepLabFeed(st, { type: "DAY", day: 11 });
    expect([r.stored.value, r.effects]).toEqual(["quiet", []]);
    r = stepLabFeed(r.stored, { type: "DAY", day: 12 });
    expect([r.stored.value, r.effects.map((e) => e.type)]).toEqual(["posting", ["BACK"]]);
  });
});

describe("who posts when", () => {
  it("a quiet week: every lab posts something, never more than the day's cap, all from its own voices", () => {
    const s = lab();
    const perDay: number[] = [];
    for (let d = 0; d < 7; d++) {
      midnight(s);
      perDay.push(today(s).length);
    }
    expect(Math.max(...perDay)).toBeLessThanOrEqual(R.rivals.maxPosts);
    expect(perDay.reduce((a, b) => a + b, 0)).toBeGreaterThan(7);
    const posts = rivals(s).posts;
    expect(new Set(posts.map((p) => p.lab)).size).toBeGreaterThanOrEqual(4);
    const handles = new Set(defs().bird.voices.filter((v) => v.lab !== "any").map((v) => v.handle));
    for (const p of posts) {
      expect(p.beat).toBe("idle");
      expect(handles.has(p.handle) || defs().bird.voices.some((v) => v.lab === "any" && p.handle.endsWith(v.handle)), p.handle).toBe(true);
      expect(p.text).not.toMatch(/\{\w+\}/);
    }
  });

  it("a rival's release: its own post (likelier to land) and maybe a subtweet from another lab", () => {
    const s = lab();
    withRules({ subtweet: 1 }, () => {
      const x = s.race.rivals.find((r) => r.context.id === "openish")!;
      x.context = { ...x.context, releases: x.context.releases + 1, model: "Chatty 7o" };
      midnight(s);
    });
    const posts = today(s);
    const release = posts.find((p) => p.beat === "release")!;
    expect(release.lab).toBe("openish");
    const sub = posts.find((p) => p.beat === "subtweet")!;
    expect(sub.lab).not.toBe("openish");
    // The release reached the ticker.
    expect(s.toasts.some((t) => t.importance === "world" && t.text.includes(release.handle))).toBe(true);
  });

  it("#1 on the Arena: '#1 🙏'; a slide of 3 places: one line, then silence, then they're so back", () => {
    const s = lab();
    midnight(s);
    const top = s.race.board.find((r) => r.id !== "you")!.id;
    const second = s.race.board.filter((r) => r.id !== "you" && r.id !== top)[0]!.id;
    // The leader slides 3, and the next lab takes #1.
    moveOnArena(s, top, ranksOf(s.race.board)[top]! + R.rivals.dropPlaces);
    moveOnArena(s, second, 1);
    withRules({ idle: 0, dunk: { ...R.rivals.dunk, chance: 0 } }, () => {
      midnight(s);
      const posts = today(s);
      expect(posts.find((p) => p.beat === "top")?.lab).toBe(second);
      expect(posts.find((p) => p.beat === "drop")?.lab).toBe(top);
      expect(rivals(s).labs[top]?.value).toBe("quiet");
      // Silence: nothing from them while quiet, whatever happens.
      for (let d = 1; d < R.rivals.silenceDays; d++) {
        s.models.push(`Quiet ${d}`);
        withRules({ idle: 1, react: 1, reactors: 9 }, () => midnight(s));
        expect(today(s).some((p) => p.lab === top), `day ${d}`).toBe(false);
      }
      midnight(s);
      expect(today(s).find((p) => p.lab === top)?.beat).toBe("back");
      expect(rivals(s).labs[top]?.value).toBe("posting");
    });
  });

  it("reacts to you: your launch, your leak, a cancel, an escape, a hearing, a raise", () => {
    const cases: [string, (s: GameState) => void, RegExp | null][] = [
      ["launch", (s) => s.models.push("Big Model 2"), null],
      ["leak", (s) => void (s.leapfrog.response.context = { ...s.leapfrog.response.context, leaks: s.leapfrog.response.context.leaks + 1 }), null],
      ["cancel", (s) => void s.birdapp!.tally.cancels++, null],
      ["escape", (s) => void (s.escape = { ...(s.escape ?? ({} as NonNullable<GameState["escape"]>)), escaped: (s.escape?.escaped ?? 0) + 1 }), null],
      ["hearing", (s) => void (s.hearing = { ...(s.hearing ?? ({} as NonNullable<GameState["hearing"]>)), enabled: true, machine: { value: "summoned", context: {} } as never }), null],
      ["raise", (s) => void (s.race.lastFunding = s.day), null],
    ];
    for (const [beat, poke] of cases) {
      const s = lab();
      midnight(s);
      poke(s);
      withRules({ react: 1, idle: 0 }, () => midnight(s));
      const posts = today(s).filter((p) => p.beat === beat);
      expect(posts.length, beat).toBe(R.rivals.reactors);
      // The first word about you is a toast (FLT-51: it's about you).
      expect(s.toasts.some((t) => t.importance === "you" && t.text.includes(posts[0]!.handle)), beat).toBe(true);
    }
  });

  it("names you: 'congrats to the team at {you}'", () => {
    const s = lab();
    s.labName = "Zebra Dynamics";
    midnight(s);
    s.models.push("Zebra-1");
    const texts: string[] = [];
    for (let i = 0; i < 30 && !texts.some((t) => t.includes("Zebra")); i++) {
      s.models.push(`Zebra-${i + 2}`);
      withRules({ react: 1, idle: 0 }, () => midnight(s));
      texts.push(...today(s).filter((p) => p.beat === "launch").map((p) => p.text));
    }
    expect(texts.some((t) => t.includes("Zebra"))).toBe(true);
  });

  it("a lab teases a run in its last week, once per run", () => {
    const s = lab();
    midnight(s);
    const x = s.race.rivals.find((r) => r.context.id === "sirocco")!;
    x.value = "training" as never;
    x.context = { ...x.context, weeks: 1 };
    withRules({ teaser: 1, idle: 0 }, () => {
      midnight(s);
      expect(today(s).filter((p) => p.beat === "teaser").map((p) => p.lab)).toContain("sirocco");
      midnight(s);
      expect(today(s).filter((p) => p.beat === "teaser" && p.lab === "sirocco")).toHaveLength(0);
    });
  });
});

describe("dunks and ratios", () => {
  it("a dunk on a lab's slide that lands is +Aura, with a toast about you", () => {
    const s = lab();
    days(s, 2);
    midnight(s);
    const top = s.race.board.find((r) => r.id !== "you")!.id;
    moveOnArena(s, top, ranksOf(s.race.board)[top]! + R.rivals.dropPlaces);
    withRules({ dunk: { ...R.rivals.dunk, chance: 1, banger: 1 } }, () => midnight(s));
    const dunk = s.birdapp!.posts.find((p) => p.dunk === top)!;
    expect(dunk).toBeDefined();
    expect(dunk.outcome).toBe("banger");
    expect(rivals(s).tally.dunks).toBe(1);
    const aura = s.birdapp!.aura;
    // Compare with the same post landing as a plain banger.
    const plain = structuredClone(s);
    delete plain.birdapp!.posts.find((p) => p.id === dunk.id)!.dunk;
    midnight(s);
    midnight(plain);
    expect(s.birdapp!.aura - plain.birdapp!.aura).toBeCloseTo(R.rivals.dunk.aura * (1 - R.aura.ease), 1);
    expect(aura).toBeGreaterThanOrEqual(0);
    expect(s.toasts.some((t) => t.importance === "you" && t.text.includes("dunked on"))).toBe(true);
    expect(plain.toasts.some((t) => t.text.includes("dunked on"))).toBe(false);
  });

  it("a rival CEO quote-posts your ratioed post: −Hype, and it says so", () => {
    const s = lab();
    days(s, 2);
    midnight(s);
    const mine = s.birdapp!.posts.find((p) => !p.settled) ?? null;
    expect(mine).not.toBeNull();
    for (const p of s.birdapp!.posts) if (!p.settled) p.outcome = "ratioed";
    s.hype = 50;
    withRules({ ratio: { ...R.rivals.ratio, chance: 1 } }, () => midnight(s));
    const ratios = rivals(s).posts.filter((p) => p.beat === "ratio");
    expect(ratios.length).toBeGreaterThan(0);
    const q = ratios[0]!;
    expect(q.quote?.handle).toBeTruthy();
    expect(q.role).toBe("ceo");
    expect(q.settled).toBe(true);
    expect(q.tick).toBeLessThan(s.tick);
    expect(rivals(s).tally.ratios).toBe(ratios.length);
    expect(s.toasts.some((t) => t.importance === "you" && t.text.includes("quote-posted") && t.text.includes("Hype"))).toBe(true);
  });
});

describe("determinism", () => {
  const run = (seed: number, off = false) => {
    const s = createTestCampus(seed);
    if (off) s.flags.birdrivalsOff = 1;
    readyForPressure(s);
    enableBirdApp(s);
    days(s, 12);
    return s;
  };
  it("same seed, same rival posts", () => {
    const a = run(5);
    const b = run(5);
    expect(rivals(a).posts.length).toBeGreaterThan(0);
    expect(JSON.stringify(a.birdapp!.rivals)).toBe(JSON.stringify(b.birdapp!.rivals));
  });
  it("off: no rivals at all, and the lab's own posters roll the same dice as with them on (until a dunk)", () => {
    const off = run(5, true);
    expect(off.birdapp!.rivals).toBeUndefined();
    const on = withRules({ dunk: { ...R.rivals.dunk, chance: 0 } }, () => run(5));
    const mine = (s: GameState) => s.birdapp!.posts.map((p) => [p.handle, p.text, p.outcome, p.likes]);
    expect(mine(on)).toEqual(mine(off));
  });
});

describe("the birdapp.rival verb", () => {
  it("is checked, and makes a lab post", () => {
    expect(checkCall({ type: "birdapp.rival", params: { lab: "sirocco", text: "we're so back" } }, "verb", "t")).toEqual([]);
    expect(checkCall({ type: "birdapp.rival", params: { beat: "vibes" } }, "verb", "t")).not.toEqual([]);
    expect(checkCall({ type: "birdapp.rival", params: { role: "intern" } }, "verb", "t")).not.toEqual([]);
    const s = lab();
    runVerb({ state: s, rng: createRng(1), run: null, owner: "test" }, { type: "birdapp.rival", params: { lab: "sirocco", text: "seeding at 3am. you know why", role: "ceo" } });
    const p = rivals(s).posts.at(-1) as RivalPostRecord;
    expect([p.lab, p.role, p.beat, p.text]).toEqual(["sirocco", "ceo", "drama", "seeding at 3am. you know why"]);
    runVerb({ state: s, rng: createRng(2), run: null, owner: "test" }, { type: "birdapp.rival", params: { beat: "hearing" } });
    expect(rivals(s).posts.at(-1)!.beat).toBe("hearing");
  });
  it("does nothing with the rivals off", () => {
    const s = lab(3, true);
    runVerb({ state: s, rng: createRng(1), run: null, owner: "test" }, { type: "birdapp.rival", params: { text: "hello" } });
    expect(s.birdapp!.rivals).toBeUndefined();
  });
});
