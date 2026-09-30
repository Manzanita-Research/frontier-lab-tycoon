// Release Leapfrog at World level: the pack, the release rhythm, records and saturation, the forced response, the launch
// livestream, the news cycle, and a headless 365-day run with the scripted player.
import pack from "../../../../mods/base-leapfrog/mod.json";
import { makeSnapshot } from "../../../app/hud";
import { eventById, EVENTS } from "../../../content/events";
import { BENCH_BY_ID, LEAPFROG, loadLeapfrogPack, PACK_TRIGGERS } from "../../../content/leapfrog";
import { RIVAL_DEFS, YOU } from "../../../content/rivals";
import { chooseEvent, dailyEvents, openEventOf } from "../../events";
import { step } from "../../machines/run";
import { releaseGain } from "../../machines/training";
import { addNews } from "../../news";
import { createRng, type Rng } from "../../rng";
import { answer, perfBudget, createTestCampus, readyForPressure } from "../../testkit";
import { tick } from "../../tick";
import { dailyTraining } from "../../training";
import type { GameState } from "../../types";
import { dailyRace, weekly } from "../race";
import { raceVars, valuation } from "../finance";
import { rdMultiplier, releaseBoost } from "../rd";
import { isOpen } from "./benchmark";
import { isLeapMoment, LEAP_MOMENTS, parseLeapMoment, stageLeapfrog } from "./demo";
import { dailyLeapfrog, enableLeapfrog, handleDrop, honestScore, ownRelease, refreshRecords, shownScore } from "./driver";
import { applyLeapfrogEffect } from "./actions";
import { valuationFactor, yourShare } from "./factors";
import { pushVoice } from "./ops";
import { responseMachine } from "./response";
import { runHeadless } from "./headless";
import { bugChance, leapfrogVars, readiness } from "./vars";
import { leapfrogView } from "./view";

/** A dice roll that never varies: `next()` is always `v`. */
const fixed = (v: number): Rng => ({ next: () => v, int: (lo) => lo, chance: (p) => v < p, pick: (items) => items[0]!, state: () => 1 });
const on = (seed = 1): GameState => {
  const s = createTestCampus(seed);
  enableLeapfrog(s);
  return s;
};
const lastNews = (s: GameState, n = 6) => s.news.slice(-n).map((x) => x.text);
const setRival = (s: GameState, id: string, value: string, context: Record<string, unknown>) => {
  const i = s.race.rivals.findIndex((r) => r.context.id === id);
  s.race.rivals[i] = { value, context: { ...s.race.rivals[i]!.context, ...context } } as never;
};
const rival = (s: GameState, id: string) => s.race.rivals.find((r) => r.context.id === id)!.context;
/** Put the response machine in `offered`, as a drop would, and flag the card. */
const offer = (s: GameState) => {
  s.leapfrog.response = { value: "offered", context: { ...s.leapfrog.response.context, offers: 1, lastOffer: s.day } } as never;
  s.flags["offer:shipNow"] = s.day;
};
/** The run in progress is `pct` done. */
const runAt = (s: GameState, pct: number) => {
  s.training = { ...s.training, context: { ...s.training.context, progress: s.training.context.cost * pct } };
};

describe("the pack (mods/base-leapfrog)", () => {
  it("loads, with the spec's benchmarks as the starting columns and a vibes-based Arena Elo", () => {
    expect(LEAPFROG.starters.map((b) => b.name)).toEqual([
      "MMLU-Pro-Max-Ultra",
      "HumanEval-But-Harder",
      "SWE-Bench (Verified) (Really)",
      "GPQA-Diamond-Encrusted",
      "ARC-AGI-∞",
      "Humanity's Second-To-Last Exam",
      "Arena Elo (vibes)",
    ]);
    expect(LEAPFROG.starters.at(-1)!.kind).toBe("elo");
  });

  it("chains each benchmark to harder replacements, each replacing a real one exactly once", () => {
    const ids = new Set(LEAPFROG.benchmarks.map((b) => b.id));
    expect(ids.size).toBe(LEAPFROG.benchmarks.length);
    const replaced = LEAPFROG.benchmarks.flatMap((b) => (b.replaces ? [b.replaces] : []));
    expect(new Set(replaced).size).toBe(replaced.length);
    for (const b of LEAPFROG.benchmarks) {
      if (!b.replaces) continue;
      expect(ids.has(b.replaces), b.id).toBe(true);
      expect(b.difficulty, b.id).toBeGreaterThan(BENCH_BY_ID[b.replaces]!.difficulty * 2);
    }
  });

  it("gives every launch livestream mishap a card, and every card choice its own flag to clear", () => {
    for (const m of LEAPFROG.mishaps) {
      const card = eventById(`stream:${m.id}`);
      expect(card, m.id).toBeDefined();
      expect(card!.kind).toBe("stream");
      expect(card!.choices.length).toBeGreaterThanOrEqual(2);
      expect(card!.choices.length).toBeLessThanOrEqual(3);
      for (const c of card!.choices) expect(c.effects).toContainEqual({ type: "flag", name: `offer:stream:${m.id}`, clear: true });
    }
    const ship = eventById("shipNow")!;
    expect(ship.title).toContain("Ship yours now at {lfReady}% ready, or lose the news cycle");
    expect(ship.choices.map((c) => c.label)).toEqual(["Ship now", "Hold, then counter-launch", "Leak a benchmark screenshot"]);
    // The dog, the wrong chart, "we'll ship it in the coming weeks": the spec's mishaps are there.
    expect(LEAPFROG.mishaps.map((m) => m.id)).toEqual(expect.arrayContaining(["dog", "wrongChart", "comingWeeks"]));
    expect(eventById("stream:dog")!.body).toContain("The demo has stopped responding");
  });

  it("every {word} in the cards and the headlines is one the game fills in", () => {
    const s = on();
    const known = new Set([
      ...Object.keys(raceVars(s)),
      ...Object.keys(leapfrogVars(s)),
      // filled in by news (templateVars) and by the driver's headline calls
      ...["lab", "model", "rival", "cash", "name", "their", "amount", "pct", "bench", "next", "lead", "who", "ready", "fn"],
    ]);
    const words = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    const texts: string[] = [];
    for (const e of LEAPFROG.events) {
      texts.push(e.title, e.body, e.stripe ?? "");
      for (const c of e.choices) {
        texts.push(c.label, c.hint);
        for (const f of c.effects) if (f.type === "news" || f.type === "thought") texts.push(f.text);
      }
    }
    for (const h of LEAPFROG.headlines) texts.push(h.text);
    for (const m of LEAPFROG.mishaps) texts.push(m.headline);
    for (const t of texts) for (const w of words(t)) expect(known.has(w), `{${w}} in "${t}"`).toBe(true);
  });

  it("has lines for every trigger the engine can say, in every lab's voice", () => {
    for (const t of PACK_TRIGGERS) expect(LEAPFROG.headlines.some((h) => h.trigger === t), t).toBe(true);
    for (const kind of ["frontier", "neo", "open", "bigco"]) expect(LEAPFROG.headlines.filter((h) => h.trigger === `react:${kind}`).length, kind).toBeGreaterThanOrEqual(2);
    // Each lab in the pack is a real rival; each lab kind has at least one.
    for (const id of Object.keys(LEAPFROG.labs)) expect(RIVAL_DEFS.some((d) => d.id === id), id).toBe(true);
  });

  it("names nobody real: parody only", () => {
    const text = JSON.stringify(pack);
    expect(text).not.toMatch(/openai|anthropic\b|google|deepmind|microsoft|nvidia|chatgpt|claude|gemini|llama|mistral|deepseek|altman|musk|amodei|zuckerberg|nadella|pichai|hinton|karpathy|sutskever|willison/i);
  });

  it("says where a mistake is, with the path", () => {
    const bad = JSON.parse(JSON.stringify(pack));
    bad.content.mishaps.add[2].weight = "heavy";
    expect(() => loadLeapfrogPack(bad)).toThrow(/mishaps.*weight|weight/);
    const badCard = JSON.parse(JSON.stringify(pack));
    badCard.content.events.add[0].choices[0].effects[0] = { type: "teleport" };
    expect(() => loadLeapfrogPack(badCard)).toThrow();
  });
});

describe("switching the pack on and off", () => {
  it("is off by default, and off means nothing: no dice are drawn and nothing moves", () => {
    const s = createTestCampus(1);
    expect(s.leapfrog.enabled).toBe(false);
    const rng = createRng(5);
    const before = rng.state();
    const snapshot = JSON.stringify(s.leapfrog);
    for (let d = 1; d <= 40; d++) {
      s.day = d;
      dailyLeapfrog(s, rng);
    }
    expect(rng.state()).toBe(before);
    expect(JSON.stringify(s.leapfrog)).toBe(snapshot);
    expect(leapfrogView(s).enabled).toBe(false);
    expect(leapfrogVars(s)).toEqual({});
    expect(valuationFactor(s)).toBe(1);
  });

  it("switching it on makes the current scores the starting records, without a word in the news", () => {
    const s = createTestCampus(1);
    const news = s.news.length;
    enableLeapfrog(s);
    expect(s.news.length).toBe(news);
    for (const e of s.leapfrog.benchmarks) {
      expect(e.machine.context.best, e.def.id).toBeGreaterThan(0);
      expect(labIdsOf(s)).toContain(e.machine.context.holder);
    }
    const v = leapfrogView(s);
    expect(v.enabled).toBe(true);
    expect(v.benchmarks).toHaveLength(7);
    expect(v.rows).toHaveLength(7);
  });
});

const labIdsOf = (s: GameState) => [YOU, ...s.race.rivals.map((r) => r.context.id)];

describe("the release rhythm", () => {
  it("a lab launches on the day, and (when the die says so) another answers the next day with its own headline", () => {
    const s = on();
    s.leapfrog.calendar = { value: "quiet", context: { ...s.leapfrog.calendar.context, daysLeft: 1 } } as never;
    s.day = 30;
    dailyLeapfrog(s, fixed(0.1)); // the pair die (0.1) is under the chance (0.5)
    const lead = s.leapfrog.last!;
    expect(lead).toMatchObject({ slot: "lead", day: 30 });
    expect(s.leapfrog.calendar.value).toBe("answering");
    s.day = 31;
    dailyLeapfrog(s, fixed(0.1));
    const answer = s.leapfrog.last!;
    expect(answer).toMatchObject({ slot: "answer", day: 31, lead: lead.lab });
    expect(answer.lab).not.toBe(lead.lab);
    expect(lastNews(s, 8).some((t) => t.includes(RIVAL_DEFS.find((d) => d.id === answer.lab)!.name) && t.includes(RIVAL_DEFS.find((d) => d.id === lead.lab)!.name))).toBe(true);
    expect(s.leapfrog.calendar.value).toBe("quiet");
  });

  it("rivals finish models privately: capability and the Arena wait for the launch date", () => {
    const s = on();
    setRival(s, "sirocco", "training", { weeks: 1 });
    const cap = rival(s, "sirocco").capability;
    s.day = 7;
    weekly(s, createRng(3));
    expect(rival(s, "sirocco").capability).toBe(cap);
    const waiting = s.leapfrog.queue.find((q) => q.id === "sirocco")!;
    expect(waiting.gain).toBeGreaterThan(0);
    expect(rival(s, "sirocco").model).toBe("");
    expect(s.news.some((n) => n.text.includes(waiting.model))).toBe(false);
  });

  it("the launch date ships it: capability, model, headline, a SOTA claim, and the news cycle turns to them", () => {
    const s = on();
    s.day = 30;
    s.leapfrog.queue.push({ id: "sirocco", model: "Zephyr-9-Mini", gain: 14, hype: 9, open: false, since: 20 });
    const cap = rival(s, "sirocco").capability;
    const share = () => yourShare(s);
    const before = share();
    handleDrop(s, fixed(0.6), "lead"); // 0.6 lands on Sirocco, the lab with a finished model waiting
    expect(rival(s, "sirocco")).toMatchObject({ capability: cap + 14, model: "Zephyr-9-Mini" });
    expect(s.leapfrog.queue.find((q) => q.id === "sirocco")).toBeUndefined();
    expect(s.leapfrog.last).toMatchObject({ lab: "sirocco", model: "Zephyr-9-Mini", slot: "lead" });
    expect(s.leapfrog.last!.claims.length).toBeGreaterThanOrEqual(1);
    const news = lastNews(s, 6);
    expect(news.some((t) => t.includes("Zephyr-9-Mini"))).toBe(true);
    expect(news.some((t) => /SOTA|state-of-the-art|new champion|new best|tops|first, everyone/.test(t))).toBe(true);
    expect(share()).toBeLessThan(before); // their launch took the room
  });

  it("a lab with nothing finished still launches a point release, and it is paid for out of its next model, so nobody grows faster for launching more", () => {
    const s = on();
    s.day = 30;
    handleDrop(s, fixed(0.6), "lead");
    const lab = s.leapfrog.last!.lab;
    const advance = s.leapfrog.labs[lab]!.advance;
    expect(advance).toBeGreaterThan(0);
    // The lab's next finished model is smaller by exactly that (or nothing, if the advance covers it).
    const q0 = s.leapfrog.queue.length;
    setRival(s, lab, "training", { weeks: 1 });
    s.day = 37;
    weekly(s, createRng(11));
    const gained = s.leapfrog.queue.find((q) => q.id === lab);
    expect(s.leapfrog.queue.length).toBeGreaterThanOrEqual(q0);
    expect(s.leapfrog.labs[lab]!.advance).toBeLessThan(advance);
    if (gained) expect(gained.gain).toBeGreaterThanOrEqual(0);
  });

  it("every launch claims SOTA on something: if the real scores do not, the lab benchmaxxes the closest column (an asterisk)", () => {
    const s = on();
    // A weak lab launches against a field it cannot beat honestly.
    for (const id of ["anthro", "metameta", "macrohard", "sirocco"]) setRival(s, id, "training", { capability: 200 });
    setRival(s, "openish", "training", { capability: 10 });
    s.capability = 20;
    seedAgain(s);
    s.leapfrog.queue = [{ id: "openish", model: "Chatty-9", gain: 1, hype: 5, open: false, since: 10 }];
    s.day = 30;
    // A roll of 0.2 lands on Open-ish (the lab with the finished model), weights being what they are.
    const rng = { ...fixed(0.2) };
    handleDrop(s, rng, "lead");
    expect(s.leapfrog.last!.lab).toBe("openish");
    const claims = s.leapfrog.last!.claims;
    expect(claims.length).toBeGreaterThanOrEqual(1);
    const maxx = claims.filter((c) => c.maxx);
    expect(maxx.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(s.leapfrog.labs.openish!.maxx)).toEqual(expect.arrayContaining(maxx.map((c) => c.bench)));
    expect(lastNews(s, 6).some((t) => t.includes("(*"))).toBe(true); // "(*pass@256)"
    expect(leapfrogView(s).rows.find((r) => r.id === "openish")!.maxx.some(Boolean)).toBe(true);
  });
});

/** Re-read the records from today's capabilities, quietly (the tests above patch capabilities directly). */
function seedAgain(s: GameState) {
  s.leapfrog.enabled = false;
  s.leapfrog.benchmarks.forEach((e) => (e.machine = { value: "live", context: { ...e.machine.context, best: 0, holder: "" } } as never));
  enableLeapfrog(s);
}

describe("records and saturation", () => {
  it("a new best is a claim, and it takes the record with it", () => {
    const s = on();
    const mmlu = () => s.leapfrog.benchmarks.find((b) => b.def.id === "mmlu")!.machine.context;
    const before = mmlu().best;
    s.capability += 25;
    const claims = refreshRecords(s, fixed(0.3));
    expect(claims.some((c) => c.bench === "mmlu" && c.lab === YOU)).toBe(true);
    expect(mmlu().best).toBeGreaterThan(before);
    expect(mmlu().holder).toBe(YOU);
  });

  it("as scores near 100 a benchmark is declared solved: a headline, a harder benchmark, reactions in different voices, and the old claims stop counting", () => {
    const s = on();
    s.capability = 110; // MMLU-Pro-Max-Ultra at 96.8%: solved. HumanEval-But-Harder at 93.9%: crowded.
    s.day = 200;
    const news0 = s.news.length;
    refreshRecords(s, createRng(4));
    const mmlu = s.leapfrog.benchmarks.find((b) => b.def.id === "mmlu")!;
    expect(mmlu.machine.value).toBe("saturated");
    expect(s.leapfrog.benchmarks.find((b) => b.def.id === "humaneval")!.machine.value).toBe("crowded");
    const successor = s.leapfrog.benchmarks.find((b) => b.def.id === "mmlu2")!;
    expect(successor.machine.value).toBe("live");
    expect(successor.machine.context.best).toBeLessThan(50); // the new one is hard: nobody is near it
    expect(s.leapfrog.stats.solved).toEqual([{ id: "mmlu", day: 200 }]);
    const added = s.news.slice(news0).map((n) => n.text);
    expect(added.some((t) => t.includes("MMLU-Pro-Max-Ultra") && t.includes("MMLU-Pro-Max-Ultra 2"))).toBe(true);
    // Two labs of different kinds speak up.
    const speakers = added.filter((t) => RIVAL_DEFS.some((d) => t.includes(d.name)) && /solved|never cared|distraction|in a room|torrent|weights|earnings|spreadsheet|lock icon|valuation|welcome step|support/i.test(t));
    expect(speakers.length).toBeGreaterThanOrEqual(1);
    // Old claims stop counting: a better score on the solved column is no claim, and it retires after its moment.
    s.capability = 400;
    const claims = refreshRecords(s, createRng(5));
    expect(claims.some((c) => c.bench === "mmlu")).toBe(false);
    expect(isOpen(mmlu.machine)).toBe(false);
    for (let d = 201; d <= 203; d++) {
      s.day = d;
      dailyLeapfrog(s, createRng(d));
    }
    expect(mmlu.machine.value).toBe("retired");
    expect(leapfrogView(s).benchmarks.some((b) => b.id === "mmlu")).toBe(false);
    expect(leapfrogView(s).benchmarks.some((b) => b.id === "mmlu2")).toBe(true);
  });

  it("a benchmark with no named successor gets a tougher '(Extended)' one", () => {
    const s = on();
    const last = LEAPFROG.benchmarks.find((b) => b.id === "hle3")!;
    s.leapfrog.benchmarks.push({ def: last, machine: { value: "live", context: { id: "hle3", best: 0, holder: "", introduced: 0, crowdedAt: 91, solvedAt: 96.5, retireAfter: 3, solvedDay: -1, claims: 0 } } as never });
    s.capability = 20_000;
    refreshRecords(s, createRng(2));
    const ext = s.leapfrog.benchmarks.find((b) => b.def.id === "hle3+");
    expect(ext?.def.name).toBe("Humanity's Last Exam (Final) (v3) (Actually Final) (Extended)");
    expect(ext?.def.difficulty).toBeGreaterThan(last.difficulty * 2);
  });
});

describe("the forced response", () => {
  it("a rival launch while your run is 94% done opens the card, spaced out and never before day 30", () => {
    const s = on();
    readyForPressure(s); // cards wait for a first launch and a gateway (FLT-16): stage it
    runAt(s, 0.94);
    s.day = 20;
    handleDrop(s, fixed(0.6), "lead");
    expect(s.flags["offer:shipNow"]).toBeUndefined(); // too early in the game
    s.day = 40;
    handleDrop(s, fixed(0.6), "lead");
    expect(s.flags["offer:shipNow"]).toBe(40);
    dailyEvents(s);
    expect(openEventOf(s)!.id).toBe("shipNow");
    const vars = raceVars(s);
    expect(vars.lfReady).toBe("94");
    expect(fillOf(eventById("shipNow")!.title, vars, s)).toMatch(/^.+ just dropped .+\. Ship yours now at 94% ready, or lose the news cycle\.$/);
  });

  it("does not open when the run is barely started, or already finished, or you are holding", () => {
    for (const pct of [0.2, LEAPFROG.rules.response.minReady - 0.001]) {
      const s = on();
      runAt(s, pct);
      s.day = 40;
      handleDrop(s, fixed(0.6), "lead");
      expect(s.flags["offer:shipNow"], String(pct)).toBeUndefined();
    }
    const s = on();
    runAt(s, 0.9);
    s.day = 40;
    s.leapfrog.response = { value: "holding", context: { ...s.leapfrog.response.context, holdUntil: 90 } } as never;
    handleDrop(s, fixed(0.6), "lead");
    expect(s.flags["offer:shipNow"]).toBeUndefined();
  });

  it("Ship now: an early-access preview lands at the current readiness with a quality penalty, the run carries on, and the rest lands with the full release", () => {
    const s = on();
    s.day = 40;
    runAt(s, 0.94);
    offer(s);
    const ctx0 = { ...s.training.context };
    const run = ctx0.run;
    const full = releaseGain(run) * releaseBoost(rdMultiplier(s));
    const cap0 = s.capability;
    applyLeapfrogEffect(s, fixed(0.99), { type: "leapfrog", action: "leakNot" as never }); // an unknown action does nothing
    expect(s.capability).toBe(cap0);
    applyLeapfrogEffect(s, fixed(0.99), { type: "leapfrog", action: "shipNow" });
    const preview = s.capability - cap0;
    expect(preview).toBeCloseTo(full * 0.94 * LEAPFROG.rules.response.shipQuality, 5);
    expect(s.models.at(-1)).toMatch(/-preview$/);
    expect(s.training.value).toBe("training");
    expect(s.training.context.progress).toBe(ctx0.progress); // the run is not wiped
    expect(s.leapfrog.previewed).toBe(true);
    expect(s.leapfrog.credit).toBeCloseTo(full * 0.94, 5);
    expect(s.leapfrog.response.value).toBe("idle");
    expect(lastNews(s, 8).some((t) => t.includes("94%"))).toBe(true);

    // The full release: only what the preview did not already pay out.
    runAt(s, 1.001);
    const capBefore = s.capability;
    const fullNow = releaseGain(run) * releaseBoost(rdMultiplier(s));
    dailyTraining(s, createRng(1));
    const rest = s.capability - capBefore;
    expect(rest).toBeCloseTo(fullNow - full * 0.94, 4);
    expect(s.leapfrog.credit).toBeCloseTo(0, 6);
    // Total is a little short of the whole run: that gap is the quality penalty.
    expect(preview + rest).toBeLessThan(fullNow);
    expect(preview + rest).toBeGreaterThan(fullNow * 0.75);
    s.day = 45;
    dailyLeapfrog(s, fixed(0.99));
    expect(s.leapfrog.previewed).toBe(false);
  });

  it("the odds of a launch bug grow the less baked it is", () => {
    expect(bugChance(0.95)).toBeLessThan(bugChance(0.6));
    const s = on();
    s.day = 40;
    runAt(s, 0.6);
    offer(s);
    const capBefore = s.hype;
    applyLeapfrogEffect(s, fixed(0.01), { type: "leapfrog", action: "shipNow" }); // a low roll: the bug ships
    expect(lastNews(s, 8).some((t) => /Gerald|question|new font|arrived too soon|recommends itself|as advertised/.test(t))).toBe(true);
    expect(s.hype).toBeLessThan(capBefore + 16); // hype from the release itself (+15) less the bug
  });

  it("Hold: the rival keeps the room, and a strong counter-launch inside the window takes it back with a bump", () => {
    const s = on();
    s.day = 40;
    runAt(s, 0.8);
    s.leapfrog.last = { day: 40, slot: "lead", lab: "sirocco", model: "Zephyr-9", lead: "", claims: [] };
    offer(s);
    const attn = () => s.leapfrog.voice.context.attention;
    const rivalBefore = attn().sirocco!;
    const youBefore = attn()[YOU]!;
    applyLeapfrogEffect(s, fixed(0.5), { type: "leapfrog", action: "hold" });
    expect(s.leapfrog.response).toMatchObject({ value: "holding", context: { holdUntil: 40 + LEAPFROG.rules.response.holdDays } });
    expect(attn().sirocco).toBeGreaterThan(rivalBefore);
    expect(attn()[YOU]).toBeLessThan(youBefore);
    // Your run finishes at day 55 and you are stronger than everyone.
    s.capability = 999;
    s.models.push("Frontier-6");
    s.ledger = { income: 100_000, expenses: 50_000, net: 50_000 };
    const cash = s.cash;
    const hype = s.hype;
    s.day = 55;
    dailyLeapfrog(s, fixed(0.99));
    expect(s.leapfrog.response.value).toBe("idle");
    expect(s.leapfrog.response.context.counters).toBe(1);
    expect(s.cash).toBe(cash + 350_000);
    expect(s.hype).toBeGreaterThanOrEqual(hype); // + the counter's hype (the daily nudge only moves it a point)
    expect(lastNews(s, 10).some((t) => /counter-launch|borrowed umbrella|oxygen|quiet before|Announcing \(finally\)/.test(t))).toBe(true);
  });

  it("a weaker counter-launch lands softly, and a hold that runs out is a shrug and a dent in trust", () => {
    const soft = on();
    soft.day = 40;
    soft.leapfrog.response = { value: "holding", context: { ...soft.leapfrog.response.context, holdUntil: 70 } } as never;
    for (const id of ["anthro", "openish", "metameta", "sirocco", "macrohard"]) setRival(soft, id, "training", { capability: 500 });
    soft.models.push("Frontier-6");
    soft.day = 55;
    const cash = soft.cash;
    dailyLeapfrog(soft, fixed(0.99));
    expect(soft.cash).toBe(cash);
    expect(lastNews(soft, 10).some((t) => /nice try|comparable|long wait/.test(t))).toBe(true);

    const s = on();
    s.day = 40;
    s.leapfrog.response = { value: "holding", context: { ...s.leapfrog.response.context, holdUntil: 70 } } as never;
    s.leapfrog.trust = 60;
    s.day = 70;
    dailyLeapfrog(s, fixed(0.99));
    expect(s.leapfrog.response.value).toBe("idle");
    expect(s.leapfrog.trust).toBeLessThan(60 - 1);
    expect(lastNews(s, 10).some((t) => /window|counter-launch|still cooking/.test(t))).toBe(true);
  });

  it("Leak: the card's hype and trust hit, and a SOTA claim with an asterisk until the real scores land (and it is a scandal if they don't)", () => {
    const s = on();
    readyForPressure(s); // cards wait for a first launch and a gateway (FLT-16): stage it
    s.day = 40;
    runAt(s, 0.8);
    offer(s);
    dailyEvents(s);
    expect(openEventOf(s)!.id).toBe("shipNow");
    const hype = s.hype;
    chooseEvent(s, createRng(7), "shipNow", 2);
    expect(s.hype).toBeCloseTo(hype + 8);
    expect(s.leapfrog.trust).toBe(58);
    expect(s.leapfrog.labs[YOU]!.leaked).not.toBe("");
    const leaked = s.leapfrog.labs[YOU]!.leaked;
    const row = leapfrogView(s).rows.find((r) => r.you)!;
    const col = leapfrogView(s).benchmarks.findIndex((b) => b.id === leaked);
    expect(row.sota[col]).toBe(true);
    expect(row.maxx[col]).toBe(true);
    expect(shownScore(s, YOU, BENCH_BY_ID[leaked]!)!).toBeGreaterThan(honestScore(s, YOU, BENCH_BY_ID[leaked]!)!);
    expect(lastNews(s, 6).some((t) => /leak|screenshot|dashboard|benchmark table/i.test(t))).toBe(true);
    // The model lands and it does not reproduce.
    s.models.push("Frontier-6");
    s.day = 45;
    s.leapfrog.trust = 58;
    dailyLeapfrog(s, fixed(0.99));
    expect(s.leapfrog.labs[YOU]!.leaked).toBe("");
    expect(s.leapfrog.trust).toBeLessThan(58);
    expect(lastNews(s, 12).some((t) => /rogue chart|reproduce|rounding error/.test(t))).toBe(true);
  });

  it("a stale click (no offer open) does nothing", () => {
    const s = on();
    const cap = s.capability;
    applyLeapfrogEffect(s, fixed(0.5), { type: "leapfrog", action: "shipNow" });
    expect(s.capability).toBe(cap);
    expect(s.models).toHaveLength(0);
  });
});

/** Fill a card's text the way the UI does. */
const fillOf = (text: string, vars: Record<string, string>, s: GameState) => text.replace(/\{(\w+)\}/g, (m, k: string) => ({ ...vars, lab: s.labName })[k] ?? m);

describe("the launch livestream", () => {
  it("a smooth one: a headline, a little hype, the room, and no card", () => {
    const s = on();
    s.models.push("Frontier-6");
    const hype = s.hype;
    const share = yourShare(s);
    ownRelease(s, fixed(0.01), { early: false, ready: 1 });
    expect(Object.keys(s.flags).some((f) => f.startsWith("offer:stream:"))).toBe(false);
    expect(s.hype).toBeGreaterThan(hype);
    expect(yourShare(s)).toBeGreaterThan(share);
    expect(lastNews(s, 6).some((t) => /flawless|no dogs|suspicious|on time/.test(t))).toBe(true);
    expect(s.leapfrog.livestream.context).toMatchObject({ streams: 1, mishaps: 0 });
  });

  it("a mishap: a headline, a hit to the Vibes, and a card that opens the same day", () => {
    const s = on();
    readyForPressure(s); // cards wait for a first launch and a gateway (FLT-16): stage it
    s.models.push("Frontier-6");
    const incidents = s.vibes.incidents;
    ownRelease(s, fixed(0.99), { early: false, ready: 1 });
    const flag = Object.keys(s.flags).find((f) => f.startsWith("offer:stream:"))!;
    expect(flag).toBeDefined();
    expect(s.vibes.incidents).toBeGreaterThan(incidents);
    expect(s.leapfrog.livestream.context.mishaps).toBe(1);
    dailyEvents(s);
    expect(openEventOf(s)!.id).toBe(flag.replace("offer:", ""));
  });

  it("an unready launch makes a mishap likelier", () => {
    const wins = (ready: number) => {
      let ok = 0;
      for (let i = 0; i < 200; i++) {
        const s = on();
        s.models.push("Frontier-6");
        s.capability = 60;
        ownRelease(s, fixed(i / 200), { early: false, ready });
        if (!Object.keys(s.flags).some((f) => f.startsWith("offer:stream:"))) ok++;
      }
      return ok;
    };
    expect(wins(1)).toBeGreaterThan(wins(0.5) + 20);
  });

  it("every mishap card works: each choice does what its hint says to trust and cash, clears the flag, and closes the card", () => {
    for (const m of LEAPFROG.mishaps) {
      const card = eventById(`stream:${m.id}`)!;
      card.choices.forEach((choice, i) => {
        const s = on();
        readyForPressure(s); // cards wait for a first launch and a gateway (FLT-16): stage it
        s.models.push("Frontier-6");
        s.flags[`offer:stream:${m.id}`] = s.day;
        dailyEvents(s);
        expect(openEventOf(s)!.id).toBe(card.id);
        const trust = choice.effects.reduce((n, f) => (f.type === "trust" ? n + f.amount : n), 0);
        const cash = choice.effects.reduce((n, f) => (f.type === "cash" ? n + f.amount : n), 0);
        const t0 = s.leapfrog.trust;
        const c0 = s.cash;
        chooseEvent(s, createRng(3), card.id, i);
        expect(s.leapfrog.trust, `${card.id}/${i}`).toBe(Math.max(0, Math.min(100, t0 + trust)));
        expect(s.cash).toBe(c0 + cash);
        expect(s.flags[`offer:stream:${m.id}`]).toBeUndefined();
        expect(openEventOf(s)).toBeNull();
      });
    }
  });
});

describe("the news cycle", () => {
  it("your launch takes the room, a rival's takes it from you, and it decays", () => {
    const s = on();
    const share0 = yourShare(s);
    pushVoice(s, YOU, 120);
    const high = yourShare(s);
    expect(high).toBeGreaterThan(share0 + 0.2);
    for (let d = 1; d <= 10; d++) {
      s.day = d;
      dailyLeapfrog(s, fixed(0.99));
    }
    expect(yourShare(s)).toBeLessThan(high - 0.1);
  });

  it("owning it makes the papers, and lifts your hype and what investors will pay; a lab nobody is talking about is worth less", () => {
    const s = on();
    s.leapfrog.calendar = { value: "quiet", context: { ...s.leapfrog.calendar.context, daysLeft: 99 } } as never;
    const cold = valuation(s);
    pushVoice(s, YOU, 400);
    s.day = 10;
    const hype = s.hype;
    dailyLeapfrog(s, fixed(0.99));
    expect(s.leapfrog.voice.value).toBe("owned");
    expect(s.leapfrog.voice.context.owner).toBe(YOU);
    expect(s.hype).toBeGreaterThan(hype);
    expect(lastNews(s, 4).some((t) => /news cycle|only thing|Frontier Times|takes the news cycle/.test(t))).toBe(true);
    expect(valuation(s)).toBeGreaterThan(cold * 1.15);
    expect(leapfrogView(s).voice).toMatchObject({ owner: YOU, ownerName: s.labName });
    // Trust matters to investors too.
    const trusting = valuation(s);
    s.leapfrog.trust = 10;
    expect(valuation(s)).toBeLessThan(trusting * 0.85);
  });

  it("very safe superintelligence has no product, so it never appears on a benchmark, but its stunts move the room", () => {
    const s = on();
    const v = leapfrogView(s);
    const row = v.rows.find((r) => r.id === "vssi")!;
    expect(row.scores.every((x) => x === null)).toBe(true);
    expect(row.model).toBe("");
    const before = s.leapfrog.voice.context.attention.vssi!;
    setRival(s, "vssi", "training", { weeks: 1 });
    s.day = 7;
    weekly(s, createRng(2)); // its "release" is a stunt headline
    expect(s.leapfrog.voice.context.attention.vssi).toBeGreaterThan(before);
  });
});

describe("what the HUD reads", () => {
  it("the snapshot carries the leaderboard, the meter and the last launch, as plain JSON", () => {
    const s = on();
    s.day = 30;
    handleDrop(s, fixed(0.6), "lead");
    const snap = makeSnapshot(s);
    const lf = snap.leapfrog;
    expect(lf.enabled).toBe(true);
    expect(JSON.parse(JSON.stringify(lf))).toEqual(lf);
    expect(lf.rows.map((r) => r.id).sort()).toEqual([YOU, ...RIVAL_DEFS.map((d) => d.id)].sort());
    for (const r of lf.rows) {
      expect(r.scores).toHaveLength(lf.benchmarks.length);
      expect(r.sota).toHaveLength(lf.benchmarks.length);
      expect(r.maxx).toHaveLength(lf.benchmarks.length);
    }
    expect(lf.rows.filter((r) => r.you)).toHaveLength(1);
    expect(lf.rows.find((r) => r.id === lf.drop!.lab)!.flash).toBe(true);
    expect(lf.rows[0]!.wins).toBeGreaterThanOrEqual(lf.rows[1]!.wins);
    expect(lf.voice.shares.reduce((n, x) => n + x.share, 0)).toBeCloseTo(1);
    expect(lf.voice.yours).toBeCloseTo(yourShare(s));
    expect(lf.drop).toMatchObject({ slot: "lead", day: 30, daysAgo: 0 });
    expect(lf.next.days).toBeGreaterThan(0);
    expect(lf.response.state).toBe("idle");
    expect(lf.trust).toBe(70);
    // The card's numbers are there before the card is.
    runAt(s, 0.94);
    expect(makeSnapshot(s).leapfrog.response.ready).toBeCloseTo(readiness(s));
  });
});

describe("a headless year (the scripted player, the pack on)", () => {
  const runs = [1, 2, 3].map((seed) => runHeadless(seed, { days: 365 }));

  it("launches every eight to twelve days (and a day longer after an answer), and pairs them: one lab drops, the next day another answers", () => {
    for (const r of runs) {
      expect(r.leads).toBeGreaterThanOrEqual(30);
      for (const gap of r.leadGaps) {
        expect(gap).toBeGreaterThanOrEqual(6);
        expect(gap).toBeLessThanOrEqual(14);
      }
      const avg = r.leadGaps.reduce((a, b) => a + b, 0) / r.leadGaps.length;
      expect(avg).toBeGreaterThan(8);
      expect(avg).toBeLessThan(12);
      expect(r.pairs).toBeGreaterThanOrEqual(10);
      expect(r.pairs).toBeLessThan(r.leads);
      // Every answer is the day after its lead, by a different lab.
      r.drops.forEach((d, i) => {
        if (d.slot !== "answer") return;
        expect(r.drops[i - 1]!.slot).toBe("lead");
        expect(d.day - r.drops[i - 1]!.day).toBe(1);
        expect(d.lab).not.toBe(r.drops[i - 1]!.lab);
      });
    }
  });

  it("every launch claims state-of-the-art on at least one benchmark", () => {
    for (const r of runs) for (const d of r.drops) expect(d.claims.length, `seed ${r.seed} day ${d.day} ${d.lab}`).toBeGreaterThanOrEqual(1);
  });

  it("spreads the launches around the labs instead of letting one lab have them all", () => {
    for (const r of runs) {
      const by: Record<string, number> = {};
      for (const d of r.drops) by[d.lab] = (by[d.lab] ?? 0) + 1;
      const most = Math.max(...Object.values(by));
      expect(Object.keys(by).length).toBeGreaterThanOrEqual(4);
      expect(most / r.drops.length).toBeLessThan(0.4);
    }
  });

  it("puts at least three forced-response cards in front of the player, and a benchmark gets solved", () => {
    for (const r of runs) {
      expect(r.cards.shipNow ?? 0, `seed ${r.seed}`).toBeGreaterThanOrEqual(3);
      expect(r.solved.length, `seed ${r.seed}`).toBeGreaterThanOrEqual(1);
      expect(r.solved[0]!.day).toBeLessThan(365);
      expect(r.sota).toBeGreaterThan(30);
      expect(r.maxxed).toBeGreaterThan(0);
    }
  });

  it("the leaderboard is live: the leader row changes hands and the columns are in the HUD snapshot", () => {
    for (const r of runs) {
      expect(r.view.benchmarks.length).toBeGreaterThanOrEqual(7);
      expect(r.view.rows).toHaveLength(7);
      const holders = new Set(r.view.benchmarks.map((b) => b.holder));
      expect(holders.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic: the same seed gives the same World, and it survives JSON", () => {
    const again = runHeadless(1, { days: 365 });
    expect(JSON.stringify(again.world)).toBe(JSON.stringify(runs[0]!.world));
    expect(JSON.parse(JSON.stringify(runs[0]!.world)).leapfrog).toEqual(runs[0]!.world.leapfrog);
  });

  it("with the pack off it is exactly the game it was: no drops, no cards, no records", () => {
    const off = runHeadless(1, { days: 120, off: true });
    expect(off.drops).toEqual([]);
    expect(off.cards.shipNow).toBeUndefined();
    expect(off.world.leapfrog.enabled).toBe(false);
    expect(off.world.leapfrog.queue).toEqual([]);
    expect(off.view.enabled).toBe(false);
    // And the pack changes only the news cycle around the player, not whether the scenario can be won.
    expect(off.outcome).not.toBe("lost");
  });

  it("stays cheap: the daily driver and the HUD view cost microseconds", () => {
    const s = runs[0]!.world;
    const rng = createRng(9);
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) leapfrogView(s);
    const view = (performance.now() - t0) / 300;
    const t1 = performance.now();
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    for (let d = 0; d < 300; d++) {
      copy.day++;
      dailyLeapfrog(copy, rng);
    }
    const daily = (performance.now() - t1) / 300;
    expect(view).toBeLessThan(perfBudget(0.3));
    expect(daily).toBeLessThan(perfBudget(0.5));
  });
});

describe("the cycle ties into the existing news and race code", () => {
  it("the open-weights drop still works when the drop is a calendar launch", () => {
    const s = on();
    readyForPressure(s); // cards wait for a first launch and a gateway (FLT-16): stage it
    s.day = 40;
    s.ledger = { income: 50_000, expenses: 20_000, net: 30_000 };
    s.capability = 20;
    s.leapfrog.queue = [{ id: "sirocco", model: "Zephyr-9", gain: 0, hype: 5, open: true, since: 10 }];
    setRival(s, "sirocco", "idle", { capability: 20, openness: 1 });
    handleDrop(s, fixed(0.6), "lead");
    expect(s.race.openDrop?.rival).toBe("sirocco");
    expect(s.flags["offer:openWeights"]).toBe(40);
  });

  it("a day of the race with the pack on still runs (weekly, era, auctions) without complaint", () => {
    const s = on();
    for (let d = 1; d <= 30; d++) {
      s.day = d;
      dailyRace(s, createRng(d));
      dailyLeapfrog(s, createRng(100 + d));
      addNews(s, `filler ${d}`, "neutral");
    }
    expect(s.race.week).toBe(4);
    expect(step(responseMachine, s.leapfrog.response, { type: "DAY", day: 31 }).stored.value).toBeDefined();
  });

  it("every card in the game, pack cards included, is a card the arcs know: they exist in the World", () => {
    const s = on();
    for (const def of EVENTS) expect(s.arcs[def.id], def.id).toBeDefined();
  });
});

describe("the Frontier Times", () => {
  it("gives the front page to whoever owns the news cycle, and a solved benchmark is era-sized news", async () => {
    const { storyFromNews, frontPage } = await import("../../../newsroom/edition");
    const s = on();
    s.day = 8;
    addNews(s, "The Frontier Times leads with Sirocco for the third headline in a row; the crossword is also about Sirocco", "neutral");
    const owned = storyFromNews(s.news.at(-1)!);
    expect(owned.kind).toBe("cycle");
    addNews(s, "Sirocco ships Zephyr-9 on a torrent", "neutral");
    const page = frontPage([owned, storyFromNews(s.news.at(-1)!)], 9, s.labName);
    expect(page.lead.kind).toBe("cycle");
    s.capability = 110;
    refreshRecords(s, createRng(4));
    const solved = s.news.map(storyFromNews).find((x) => x.text.includes("MMLU-Pro-Max-Ultra") && x.text.includes("MMLU-Pro-Max-Ultra 2"));
    expect(solved?.kind).toBe("era");
    expect(storyFromNews({ id: 1, day: 5, tone: "joke", text: "A dog walks onto Pied Piper's launch livestream; the demo 'has stopped responding', the dog has not".replace("Pied Piper", s.labName) }).kind).toBe("cycle");
  });
});

describe("debug moments (?moment=)", () => {
  const ticksUntilCard = (s: GameState, max = 60) => {
    for (let i = 0; i < max && !openEventOf(s); i++) tick(s);
    return openEventOf(s)?.id ?? null;
  };

  it("shipnow: a lab launches as the day turns and the forced-response card opens, with the run at 94%", () => {
    const s = createTestCampus(1);
    stageLeapfrog(s, "shipnow");
    expect(s.leapfrog.enabled).toBe(true);
    expect(ticksUntilCard(s)).toBe("shipNow");
    expect(raceVars(s).lfReady).toBe("94");
    expect(s.leapfrog.last).toMatchObject({ slot: "lead" });
  });

  it("pair: a lab launched today and the answer lands within a second, by another lab, with its own headline", () => {
    const s = createTestCampus(1);
    stageLeapfrog(s, "pair");
    const lead = s.leapfrog.last!;
    expect(lead.slot).toBe("lead");
    for (let i = 0; i < 40 && s.leapfrog.last === lead; i++) tick(s);
    expect(s.leapfrog.last).toMatchObject({ slot: "answer", lead: lead.lab });
    expect(s.leapfrog.last!.lab).not.toBe(lead.lab);
  });

  it("stream opens the dog by default, or the mishap you name, after a mishap headline", () => {
    for (const [arg, card] of [["", "stream:dog"], ["wrongChart", "stream:wrongChart"], ["comingWeeks", "stream:comingWeeks"], ["nonsense", "stream:dog"]] as const) {
      const s = createTestCampus(1);
      stageLeapfrog(s, "stream", arg);
      expect(ticksUntilCard(s), arg).toBe(card);
    }
    expect(parseLeapMoment("stream:dog")).toEqual({ moment: "stream", arg: "dog" });
    expect(parseLeapMoment("shuffle")).toBeNull();
    expect(isLeapMoment("solved")).toBe(true);
  });

  it("solved: the harder benchmark is on the board and the ticker says so", () => {
    const s = createTestCampus(1);
    stageLeapfrog(s, "solved");
    const v = leapfrogView(s);
    expect(v.benchmarks.some((b) => b.status === "saturated")).toBe(true);
    expect(v.benchmarks.some((b) => b.id === "mmlu2")).toBe(true);
    expect(lastNews(s, 8).some((t) => t.includes("MMLU-Pro-Max-Ultra 2"))).toBe(true);
  });

  it("a staged World keeps playing without trouble and stays deterministic", () => {
    for (const m of LEAP_MOMENTS) {
      const a = createTestCampus(2);
      const b = createTestCampus(2);
      stageLeapfrog(a, m);
      stageLeapfrog(b, m);
      for (let i = 0; i < 100; i++) {
        tick(a, answer(a));
        tick(b, answer(b));
      }
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});

describe("the app turns the pack on", () => {
  it("is on in the browser unless ?leapfrog=off, and a new lab gets it too; the tests' handles stay off unless asked", async () => {
    const { readDebugParams } = await import("../../../debug");
    const { createSimHandle } = await import("../../../app/sim");
    expect(readDebugParams("").leapfrog).toBe(true);
    expect(readDebugParams("?leapfrog=off").leapfrog).toBe(false);
    const base = { seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0 };
    expect(createSimHandle(base).world.leapfrog.enabled).toBe(false);
    const handle = createSimHandle({ ...base, leapfrog: true });
    expect(handle.world.leapfrog.enabled).toBe(true);
    handle.reset(5);
    expect(handle.world.leapfrog.enabled).toBe(true);
    expect(handle.world.seed).toBe(5);
    const staged = createSimHandle({ ...base, leapfrog: true, moment: "stream:dog" });
    expect(staged.world.leapfrog.livestream.context.kind).toBe("dog");
  });
});
