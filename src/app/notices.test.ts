// The notice policy (FLT-51): `you` is a toast (one per window, then a batch), `world` is the ticker, replies and the coach
// are never held back. It routes on the sim's tags, never on the words, so a year of the sim is checked for untagged toasts.
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { createEffectActor, waitFor } from "@xstate/effect";
import { describe, expect } from "vitest";
import { createMidgameScenario } from "../sim/scenarios/midgame";
import { enableLeapfrog } from "../sim/race/leapfrog/driver";
import { runHeadless } from "../sim/race/leapfrog/headless";
import { runSenateYear } from "../sim/capture/headless";
import { leapfrogView } from "../sim/race/leapfrog/view";
import { answer, createTestCampus, layPaths } from "../sim/testkit";
import { tick } from "../sim/tick";
import type { GameState, Toast } from "../sim/types";
import { framesManual, ManualFrames } from "./frames";
import type { UiToast } from "./hud";
import { appMachine } from "./machine";
import { gateToasts, laneOf, mergeWire, newGate, summaryText, TOAST_WINDOW_MS, type GateEnv, type NoticeGate } from "./notices";
import { createSimHandle, Sim, simLayer } from "./sim";

let nextId = 1;
const make = (text: string, over: Partial<UiToast> = {}): UiToast => ({ id: nextId++, text, tone: "bad", source: "ops", importance: "world", ...over });
const you = (text: string, over: Partial<UiToast> = {}) => make(text, { importance: "you", ...over });
const launch = (lab = "Vast Sea Labs") => make(`${lab} launched Chatty-5-mini. The news cycle is theirs.`, { source: "leapfrog" });
const record = () => you("Vast Sea Labs took your record on HE-BH.", { source: "leapfrog" });

const env = (over: Partial<GateEnv> = {}): GateEnv => ({ now: 0, day: 100, leapfrog: undefined, rank: null, seq: 1, ...over });

/** Feed toasts to the gate at fake times; returns what each call put on screen (texts) and on the ticker. */
function play(steps: { at: number; toasts?: UiToast[]; over?: Partial<GateEnv> }[]) {
  let gate: NoticeGate = newGate();
  let seq = 1;
  const ticker: string[] = [];
  const shown = steps.map((s) => {
    const r = gateToasts(gate, s.toasts ?? [], env({ now: s.at, seq, ...s.over }));
    gate = r.gate;
    seq = r.seq;
    ticker.push(...r.wire.map((w) => w.text));
    return r.toasts.map((t) => t.text);
  });
  return { shown, ticker, gate };
}

describe("laneOf", () => {
  it("sends `you` to the toast stack, `world` (and anything untagged) to the ticker, and never holds the coach or a reply about you", () => {
    expect(laneOf({ importance: "you", source: "staff" })).toBe("toast");
    expect(laneOf({ importance: "world", source: "ops" })).toBe("ticker");
    expect(laneOf({})).toBe("ticker");
    expect(laneOf({ importance: "you", source: "staff", reply: true })).toBe("now");
    expect(laneOf({ source: "coach", importance: "you" })).toBe("now");
    // The livestream that comes with your own "ship now" pick: news, not the answer.
    expect(laneOf({ importance: "world", source: "leapfrog", reply: true })).toBe("ticker");
  });
});

describe("gateToasts", () => {
  it("never toasts the world: rival launches, breakdowns an SRE is already on, go to the ticker in order", () => {
    const a = launch();
    const b = make("API Gateway is out of order. An SRE is on it.");
    const r = gateToasts(newGate(), [a, b], env({ day: 42 }));
    expect(r.toasts).toEqual([]);
    expect(r.wire).toEqual([
      { id: a.id, day: 42, text: a.text, tone: "bad", source: "leapfrog" },
      { id: b.id, day: 42, text: b.text, tone: "bad", source: "ops" },
    ]);
    expect(r.gate.lastAt).toBeNull();
  });

  it("shows a `you` toast at once, as itself, and shuts the window", () => {
    const rec = record();
    const { shown, gate } = play([{ at: 1_000, toasts: [rec] }]);
    expect(shown).toEqual([[rec.text]]);
    expect(gate.lastAt).toBe(1_000);
  });

  it(`allows at most one \`you\` toast per ${TOAST_WINDOW_MS / 1000} real seconds, and folds a pile into one batch when the window opens`, () => {
    const quit = you("Priya Residual handed in the box and left.", { source: "staff" });
    const { shown, ticker } = play([
      { at: 0, toasts: [record()] }, // shown
      { at: 2_000, toasts: [quit] }, // held
      { at: TOAST_WINDOW_MS - 200, toasts: [] }, // still shut
      { at: TOAST_WINDOW_MS, toasts: [] }, // opens: the one thing, as itself
      { at: TOAST_WINDOW_MS + 200, toasts: [record(), you("Kombucha Bar is out of order. Hire an SRE."), launch()] }, // two held
      { at: 2 * TOAST_WINDOW_MS, toasts: [] }, // opens: one batch
    ]);
    expect(shown[0]).toHaveLength(1);
    expect(shown[1]).toEqual([]);
    expect(shown[2]).toEqual([]);
    expect(shown[3]).toEqual([quit.text]);
    expect(shown[4]).toEqual([]);
    expect(shown[5]).toEqual(["2 things happened while you were busy. Top of the pile: Vast Sea Labs took your record on HE-BH."]);
    // What the batch stood for can be read on the ticker; the launch went there on its own.
    expect(ticker).toEqual(["Vast Sea Labs launched Chatty-5-mini. The news cycle is theirs.", "Vast Sea Labs took your record on HE-BH.", "Kombucha Bar is out of order. Hire an SRE."]);
  });

  it("gives the batch its items, so a skin can list them", () => {
    let gate = gateToasts(newGate(), [record()], env()).gate;
    gate = gateToasts(gate, [you("One.", { tone: "good" }), you("Two.", { source: "economy" })], env({ now: 1_000 })).gate;
    const r = gateToasts(gate, [], env({ now: TOAST_WINDOW_MS }));
    expect(r.toasts[0]!.batch).toEqual([{ text: "One.", tone: "good", source: "ops" }, { text: "Two.", tone: "bad", source: "economy" }]);
    expect(r.toasts[0]!.tone).toBe("bad");
    expect(r.toasts[0]!.id).toBeGreaterThanOrEqual(1_000_000);
  });

  it("counts the same words twice as one line", () => {
    const { shown } = play([{ at: 0, toasts: [record()] }, { at: 1_000, toasts: [you("API Gateway is out of order. Hire an SRE."), you("API Gateway is out of order. Hire an SRE.")] }, { at: TOAST_WINDOW_MS, toasts: [] }]);
    expect(shown[2]).toEqual(["API Gateway is out of order. Hire an SRE."]);
  });

  it("lets the coach and the answer to what you just did through at once, without using up the window", () => {
    const hired = you("Mop-3000 joined as a Janitor Bot.", { source: "staff", reply: true });
    const coach = you("Kevin's first model is out.", { source: "coach" });
    const { shown, gate } = play([{ at: 0, toasts: [hired, coach, record()] }, { at: 1_000, toasts: [you("Cash is low.", { reply: true })] }]);
    expect(shown[0]).toEqual([hired.text, coach.text, "Vast Sea Labs took your record on HE-BH."]);
    expect(shown[1]).toEqual(["Cash is low."]);
    expect(gate.lastAt).toBe(0);
  });

  it("says so when you lose #1, once, and only while the pack is on", () => {
    const lf = { enabled: true, benchmarks: [] } as never;
    expect(play([{ at: 0, over: { leapfrog: lf, rank: { prev: 1, next: 2, top: "Vast Sea" } } }]).shown[0]).toEqual(["You lost #1 on the Arena to Vast Sea."]);
    expect(play([{ at: 0, over: { leapfrog: lf, rank: { prev: 2, next: 2, top: "Vast Sea" } } }]).shown[0]).toEqual([]);
    expect(play([{ at: 0, over: { rank: { prev: 1, next: 2, top: "Vast Sea" } } }]).shown[0]).toEqual([]);
  });

  it("writes plain summaries that lead with the worst news", () => {
    const good = you("SOLD! $2M for a Datacenter.", { tone: "good" });
    expect(summaryText([good, you("Kevin Backprop handed in the box and left.")])).toBe("2 things happened while you were busy. Top of the pile: Kevin Backprop handed in the box and left.");
    expect(summaryText([good, you("Up 2 places.", { tone: "good" })])).toBe("2 things happened while you were busy. Top of the pile: Up 2 places.");
  });
});

describe("mergeWire", () => {
  it("interleaves world notices with the headlines by id, and skips one the ticker already says", () => {
    const news = [{ id: 1, day: 1, text: "A", tone: "neutral" as const }, { id: 5, day: 2, text: "B", tone: "neutral" as const }];
    expect(mergeWire(news, [{ id: 3, day: 1, text: "W", tone: "bad" }, { id: 6, day: 2, text: "B", tone: "bad" }]).map((n) => n.text)).toEqual(["A", "W", "B"]);
    expect(mergeWire(news, [])).toBe(news);
  });
});

/** Every toast a stretch of the sim sends. */
function drain(s: GameState, days: number): Toast[] {
  const all: Toast[] = [];
  for (let i = 0; i < days * 20; i++) {
    tick(s, answer(s));
    all.push(...s.toasts.splice(0));
  }
  return all;
}

describe("every toast says who it is from (the flood test, keyed on source)", () => {
  it("a year of Release Leapfrog: every toast is tagged, every launch and record is Leapfrog's, and a rival's launch is never about you", () => {
    const sounds = /news cycle|your record|launched|answers .* a day later|is solved|counter-launch|livestream|launch bug/i;
    let leapfrog = 0;
    for (const seed of [1, 2, 3]) {
      for (const t of runHeadless(seed, { days: 365 }).world.toasts) {
        expect(t.source, `untagged: ${t.text}`).toBeDefined();
        expect(t.importance, `no importance: ${t.text}`).toBeDefined();
        if (!sounds.test(t.text) || t.text.startsWith("#1 on the Frontier Arena")) continue;
        leapfrog++;
        expect(t.source, t.text).toBe("leapfrog");
        if (/ launched .+\. The news cycle is theirs\.$| answers .+ a day later: | owns the news cycle\.$/.test(t.text)) expect(t.importance, t.text).toBe("world");
        if (/ took your record on /.test(t.text)) expect(t.importance, t.text).toBe("you");
      }
    }
    expect(leapfrog).toBeGreaterThan(60);
  }, 20_000);

  it("the mid-game campus, every system awake: 200 more days and not one untagged toast", () => {
    const s = createMidgameScenario();
    s.toasts = [];
    const all = drain(s, 200);
    const sources = new Set(all.map((t) => t.source));
    for (const t of all) {
      expect(t.source, `untagged: ${t.text}`).toBeDefined();
      expect(["you", "world"]).toContain(t.importance);
    }
    // It really is busy: breakdowns, staff, the economy and the Race all talk.
    for (const src of ["ops", "staff", "economy", "leapfrog"]) expect(sources, src).toContain(src);
    // And most of what it says is the world's: the ticker's, not a toast.
    expect(all.filter((t) => t.importance === "world").length).toBeGreaterThan(all.length / 2);
  }, 20_000);

  it("the FLT-52 wave's Senate, factions and endings say who they are: politics, factions, endings, never a stray mod:", () => {
    // A lobbying lab that overfills the draft (the third clause is the staffer's toast) plays on until Captured.
    const r = runSenateYear(2, { clauses: ["kombucha", "review", "threshold"], lobby: true, endings: true }, 600);
    expect(r.world.endings!.id).toBe("captured");
    const all = r.world.toasts;
    for (const t of all) {
      expect(t.source, `untagged: ${t.text}`).toBeDefined();
      expect(["you", "world"]).toContain(t.importance);
      expect(t.source!.startsWith("mod:"), `${t.source}: ${t.text}`).toBe(false);
    }
    const from = (src: string) => all.filter((t) => t.source === src);
    expect(from("politics").some((t) => /already a lot of clauses/.test(t.text) && t.importance === "you" && t.reply)).toBe(true);
    expect(from("politics").some((t) => /first pass at the bill/.test(t.text) && t.importance === "you")).toBe(true);
    expect(from("endings").some((t) => /office has moved off campus/.test(t.text) && t.importance === "you")).toBe(true);

    const m = createMidgameScenario();
    m.toasts = [];
    tick(m, [{ type: "setSafetySpend", level: 2 }]);
    expect(m.toasts.find((t) => /^Safety budget: /.test(t.text))).toMatchObject({ source: "factions", importance: "you", reply: true });
  }, 120_000);
});

/**
 * What the app does with the sim's toasts, without the machine: publishes at 5 Hz of real time, `10 x speed` ticks a
 * second, cards answered, the gate in between. Counts what reaches the screen.
 */
function flood(s: GameState, speed: number, seconds: number) {
  const ticksPerPublish = 2 * speed;
  let gate = newGate();
  let seq = 1;
  let raw = 0;
  const held: number[] = [];
  let shown = 0;
  let rank = s.race.rank;
  for (let publish = 0; publish < seconds * 5; publish++) {
    const now = publish * 200;
    for (let i = 0; i < ticksPerPublish; i++) tick(s, answer(s));
    const fresh: UiToast[] = s.toasts.splice(0).map((t) => ({ ...t }));
    raw += fresh.length;
    const next = s.race.rank;
    const r = gateToasts(gate, fresh, { now, day: s.day, leapfrog: leapfrogView(s), rank: { prev: rank, next, top: "" }, seq });
    rank = next;
    gate = r.gate;
    seq = r.seq;
    shown += r.toasts.length;
    for (const t of r.toasts) if (laneOf(t) === "toast" || t.batch) held.push(now);
  }
  return { raw, shown, held };
}

describe("a real minute", () => {
  it.each([1, 3, 10])("at %dx, Leapfrog alone: nothing about the world, and never two held toasts closer than the window", (speed) => {
    const s = createTestCampus(3);
    enableLeapfrog(s);
    layPaths(s);
    const r = flood(s, speed, 60);
    expect(r.raw).toBeGreaterThanOrEqual(r.shown);
    expect(r.held.length).toBeLessThanOrEqual(60 / (TOAST_WINDOW_MS / 1000));
    for (let i = 1; i < r.held.length; i++) expect(r.held[i]! - r.held[i - 1]!).toBeGreaterThanOrEqual(TOAST_WINDOW_MS);
  });
  it("at 10x in the mid-game, the flood is a trickle: at most four held-back toasts a minute", () => {
    const r = flood(createMidgameScenario(), 10, 60);
    expect(r.raw).toBeGreaterThan(40);
    expect(r.held.length).toBeLessThanOrEqual(4);
  }, 20_000);
});

describe("the app machine", () => {
  it.effect("keeps a rival's launch off the toast stack and on the ticker, shows a lost record, and answers a command at once", () => {
    const handle = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, leapfrog: true });
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const frames = yield* ManualFrames;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 1, first: sim.report(true, true)! } });
      handle.world.toasts.push({ id: 9101, text: "Vast Sea Labs launched Chatty-5-mini. The news cycle is theirs.", tone: "bad", source: "leapfrog", importance: "world" });
      handle.world.toasts.push({ id: 9102, text: "Vast Sea Labs took your record on HE-BH.", tone: "bad", source: "leapfrog", importance: "you" });
      handle.world.toasts.push({ id: 9103, text: "Build a Training Hall first.", tone: "bad", source: "build", importance: "you", reply: true });
      frames.emit(0.25);
      yield* waitFor(actor, (st) => st.context.toasts.some((t) => t.id === 9103), { timeout: "1 second" });
      const c = actor.getSnapshot().context;
      expect(c.toasts.map((t) => t.id)).toContain(9102);
      expect(c.toasts.map((t) => t.id)).not.toContain(9101);
      expect(c.news.map((n) => n.id)).toContain(9101);
    }).pipe(Effect.provide(Layer.mergeAll(simLayer(handle), framesManual)));
  });
});
