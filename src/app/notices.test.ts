// The toast gate (FLT-31): a rival launch is for the leaderboard and the ticker, a toast is for what matters to you.
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { createEffectActor, waitFor } from "@xstate/effect";
import { describe, expect } from "vitest";
import { createTestCampus as createInitialState } from "../sim/testkit";
import { enableLeapfrog } from "../sim/race/leapfrog/driver";
import { runHeadless } from "../sim/race/leapfrog/headless";
import { leapfrogView } from "../sim/race/leapfrog/view";
import { answer, layPaths } from "../sim/testkit";
import { tick } from "../sim/tick";
import type { GameState } from "../sim/types";
import { framesManual, ManualFrames } from "./frames";
import type { UiToast } from "./hud";
import { appMachine } from "./machine";
import { classifyToast, gateToasts, HURRY_SPEED, isLeapfrogToast, LAUNCH_SUMMARY_MIN, LEAPFROG_TOAST_MS, newGate, summaryText, type GateEnv, type NoticeGate } from "./notices";
import { createSimHandle, Sim, simLayer } from "./sim";

let nextId = 1;
const toast = (text: string, tone: UiToast["tone"] = "bad"): UiToast => ({ id: nextId++, text, tone });
const launch = (lab = "Vast Sea Labs") => toast(`${lab} launched Chatty-5-mini. The news cycle is theirs.`);
const answers = () => toast("Open-ish AI answers Vast Sea Labs a day later: Open-ish-4-lite.");
const record = () => toast("Vast Sea Labs took your record on HE-BH.");

const env = (over: Partial<GateEnv> = {}): GateEnv => ({ now: 0, speed: 1, leapfrog: undefined, rank: null, seq: 1, ...over });

/** Feed toasts to the gate at fake times; returns what each call put on screen. */
function play(steps: { at: number; toasts?: UiToast[]; speed?: number; over?: Partial<GateEnv> }[]) {
  let gate: NoticeGate = newGate();
  let seq = 1;
  return steps.map((s) => {
    const r = gateToasts(gate, s.toasts ?? [], env({ now: s.at, speed: s.speed ?? 1, seq, ...s.over }));
    gate = r.gate;
    seq = r.seq;
    return r.toasts.map((t) => t.text);
  });
}

describe("classifyToast", () => {
  it("recognises every toast Release Leapfrog's driver can send", () => {
    expect(classifyToast("Vast Sea Labs launched Chatty-5-mini. The news cycle is theirs.")).toBe("launch");
    expect(classifyToast("Open-ish AI answers Vast Sea Labs a day later: Open-ish-4-lite.")).toBe("launch");
    expect(classifyToast("Vast Sea Labs took your record on HE-BH.")).toBe("record");
    expect(classifyToast("HE-BH is solved. Everyone is back to 31% on HE-BHS.")).toBe("solved");
    expect(classifyToast("Counter-launch lands: Frontier-5 takes the news cycle back.")).toBe("yours");
    expect(classifyToast("The counter-launch is out, and a bit... comparable.")).toBe("yours");
    expect(classifyToast("Frontier-5 has a launch bug. It insists it doesn't.")).toBe("yours");
    expect(classifyToast("Frontier-5 is out at 94%: the news cycle is yours (for now).")).toBe("yours");
    expect(classifyToast("The launch livestream goes flawlessly. (It was pre-recorded.)")).toBe("minor");
    expect(classifyToast("You own the news cycle. Enjoy it: it lasts about four days.")).toBe("minor");
    expect(classifyToast("Vast Sea Labs owns the news cycle.")).toBe("rivalCycle");
    expect(classifyToast("Holding for a counter-launch: 25 days to land it.")).toBe("direct");
    expect(classifyToast("The screenshot is everywhere. So are the questions.")).toBe("direct");
  });
  it("leaves everyone else's toasts alone", () => {
    for (const text of ["Not enough cash", "Hugo Stochastic handed in the box and left.", "#1 on the Frontier Arena! Everyone else is updating the rules.", "Frontier-2 is out! Launch week: +$70K", "Open-ish AI just dropped Open-ish-4 for free. Revenue -30% for 14 days."]) {
      expect(classifyToast(text), text).toBe("other");
    }
  });
  it("recognises every Leapfrog-sounding toast a year of the sim produces (so rewording one in the sim cannot bring the flood back)", () => {
    const sounds = /news cycle|your record|launched|answers .* a day later|is solved|counter-launch|livestream|launch bug/i;
    let seen = 0;
    for (const seed of [1, 2, 3]) {
      for (const t of runHeadless(seed, { days: 365 }).world.toasts) {
        if (sounds.test(t.text)) {
          seen++;
          expect(isLeapfrogToast(t.text), `unrecognised: ${t.text}`).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(60);
  }, 15_000); // Three complete years of sim; individual tick budgets are checked separately.
});

describe("gateToasts", () => {
  it("passes other toasts through untouched, in order, and never counts them against the window", () => {
    const a = toast("Not enough cash");
    const b = toast("Hugo handed in the box and left.");
    const r = gateToasts(newGate(), [a, b], env());
    expect(r.toasts).toEqual([a, b]);
    expect(r.gate.lastAt).toBeNull();
  });

  it("does not toast a rival launch: one, two or three go to the ticker and the leaderboard", () => {
    const shown = play([{ at: 0, toasts: [launch()] }, { at: 4_000, toasts: [answers()] }, { at: 30_000, toasts: [launch("Meta Meta")] }]);
    expect(shown.flat()).toEqual([]);
  });

  it(`batches launches into one "N labs launched while you were busy" once ${LAUNCH_SUMMARY_MIN} have piled up`, () => {
    const many = Array.from({ length: LAUNCH_SUMMARY_MIN }, () => launch());
    const [shown] = play([{ at: 1_000, toasts: many }]);
    expect(shown).toHaveLength(1);
    expect(shown![0]).toMatch(new RegExp(`^${LAUNCH_SUMMARY_MIN} labs launched while you were busy\\.`));
  });

  it("toasts an overtaken record at once, as itself", () => {
    const rec = record();
    const [shown] = play([{ at: 0, toasts: [rec] }]);
    expect(shown).toEqual([rec.text]);
  });

  it("allows at most one Leapfrog toast per 20 real seconds, and folds the rest into one summary when the window opens", () => {
    const shown = play([
      { at: 0, toasts: [record()] }, // shown
      { at: 2_000, toasts: [launch(), launch(), record()] }, // held
      { at: LEAPFROG_TOAST_MS - 200, toasts: [launch()] }, // still held
      { at: LEAPFROG_TOAST_MS, toasts: [] }, // window opens: the one thing that matters, as itself
      { at: LEAPFROG_TOAST_MS + 200, toasts: [launch(), record()] }, // four launches and a record are held, and the window is shut again
      { at: 2 * LEAPFROG_TOAST_MS, toasts: [] }, // window opens: one summary
    ]);
    expect(shown[0]).toHaveLength(1);
    expect(shown[1]).toEqual([]);
    expect(shown[2]).toEqual([]);
    expect(shown[3]).toEqual(["Vast Sea Labs took your record on HE-BH."]);
    expect(shown[4]).toEqual([]);
    expect(shown[5]).toEqual(["4 labs launched and 1 of your records fell while you were busy. Receipts: the Benchmarks tab."]);
  });

  it("holds a lone record until the window opens rather than dropping it", () => {
    const rec = record();
    const shown = play([{ at: 0, toasts: [record()] }, { at: 5_000, toasts: [rec] }, { at: LEAPFROG_TOAST_MS, toasts: [] }]);
    expect(shown[1]).toEqual([]);
    expect(shown[2]).toEqual([rec.text]);
  });

  it("toasts a solved benchmark only if you held its record", () => {
    const solved = toast("HE-BH is solved. Everyone is back to 31% on HE-BHS.", "neutral");
    const view = (holder: string) => ({ enabled: true, benchmarks: [{ short: "HE-BH", holder }] }) as never;
    expect(play([{ at: 0, toasts: [solved], over: { leapfrog: view("openish") } }])[0]).toEqual([]);
    expect(play([{ at: 0, toasts: [solved], over: { leapfrog: view("you") } }])[0]).toEqual([solved.text]);
  });

  it("says so when you lose #1, once, and only while the pack is on", () => {
    const lf = { enabled: true, benchmarks: [] } as never;
    expect(play([{ at: 0, over: { leapfrog: lf, rank: { prev: 1, next: 2, top: "Vast Sea" } } }])[0]).toEqual(["You lost #1 on the Arena to Vast Sea."]);
    expect(play([{ at: 0, over: { leapfrog: lf, rank: { prev: 2, next: 2, top: "Vast Sea" } } }])[0]).toEqual([]);
    expect(play([{ at: 0, over: { rank: { prev: 1, next: 2, top: "Vast Sea" } } }])[0]).toEqual([]);
  });

  it(`at ${HURRY_SPEED}x and up, the small stuff stays in the ticker`, () => {
    const flawless = toast("The launch livestream goes flawlessly. (It was pre-recorded.)", "good");
    expect(play([{ at: 0, toasts: [flawless], speed: 1 }])[0]).toEqual([flawless.text]);
    expect(play([{ at: 0, toasts: [flawless], speed: HURRY_SPEED }])[0]).toEqual([]);
    expect(play([{ at: 0, toasts: [flawless], speed: 10 }])[0]).toEqual([]);
  });

  it("lets the answer to a card you just chose through, and it does not use up the window", () => {
    const hold = toast("Holding for a counter-launch: 25 days to land it.", "neutral");
    const shown = play([{ at: 0, toasts: [hold, record()] }]);
    expect(shown[0]).toHaveLength(2);
  });

  it("forgets a few launches from long ago instead of counting them into a later summary", () => {
    const shown = play([{ at: 0, toasts: [launch(), launch()] }, { at: 100_000, toasts: [launch(), launch()] }]);
    expect(shown.flat()).toEqual([]);
  });

  it("writes plain summaries", () => {
    const h = { launches: 5, records: 0, matters: [], since: 0 };
    expect(summaryText(h)).toBe("5 labs launched while you were busy. Receipts: the Benchmarks tab.");
    expect(summaryText({ ...h, launches: 1, records: 2 })).toBe("1 lab launched and 2 of your records fell while you were busy. Receipts: the Benchmarks tab.");
  });
});

/**
 * What the app does with a year of toasts, without the machine: publishes at 5 Hz of real time, `10 x speed` ticks a
 * second, cards answered, the gate in between. "Before" is every Leapfrog toast the sim sends; "after" is what survives.
 */
function flood(speed: number, seconds: number, seed = 3) {
  const s: GameState = createInitialState(seed);
  enableLeapfrog(s);
  layPaths(s);
  const ticksPerPublish = 2 * speed;
  let gate = newGate();
  let seq = 1;
  let raw = 0;
  let shown = 0;
  let days = 0;
  let rank = 1;
  const at: number[] = [];
  for (let publish = 0; publish < seconds * 5; publish++) {
    const now = publish * 200;
    for (let i = 0; i < ticksPerPublish; i++) tick(s, answer(s));
    const fresh = s.toasts.splice(0).map((t) => ({ ...t }));
    raw += fresh.filter((t) => isLeapfrogToast(t.text)).length;
    const view = leapfrogView(s);
    const next = s.race.rank;
    const r = gateToasts(gate, fresh, { now, speed, leapfrog: view, rank: { prev: rank, next, top: "" }, seq });
    rank = next;
    gate = r.gate;
    seq = r.seq;
    for (const t of r.toasts) if (isLeapfrogToast(t.text) || t.text.startsWith("You lost #1") || /while you were busy/.test(t.text)) {
      shown++;
      at.push(now);
    }
    days = s.day;
  }
  return { raw, shown, days, at };
}

describe("a real minute", () => {
  it.each([1, 3, 10])("at %dx, Leapfrog sends far fewer toasts than it did, never closer than 20 s apart", (speed) => {
    const r = flood(speed, 60);
    console.log(`60 s at ${speed}x (${r.days} game days): ${r.raw} Leapfrog toasts from the sim, ${r.shown} shown`);
    expect(r.raw).toBeGreaterThanOrEqual(r.shown);
    expect(r.shown).toBeLessThanOrEqual(3);
    for (let i = 1; i < r.at.length; i++) expect(r.at[i]! - r.at[i - 1]!).toBeGreaterThanOrEqual(LEAPFROG_TOAST_MS);
  });
  it("still tells you about a lost record during a 10x rush", () => {
    // Over ten minutes at 10x, the records that fell are reported (batched), not dropped.
    const r = flood(10, 600);
    expect(r.shown).toBeGreaterThan(0);
    expect(r.shown).toBeLessThanOrEqual(600 / (LEAPFROG_TOAST_MS / 1000));
  });
});

describe("the app machine", () => {
  it.effect("keeps a rival's launch off the toast stack but shows a lost record, and everyone else's toasts as before", () => {
    const handle = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, leapfrog: true });
    return Effect.gen(function* () {
      const sim = yield* Sim;
      const frames = yield* ManualFrames;
      const actor = yield* createEffectActor(appMachine, { input: { speed: 1, first: sim.report(true, true)! } });
      handle.world.toasts.push({ id: 9101, text: "Vast Sea Labs launched Chatty-5-mini. The news cycle is theirs.", tone: "bad" });
      handle.world.toasts.push({ id: 9102, text: "Vast Sea Labs took your record on HE-BH.", tone: "bad" });
      handle.world.toasts.push({ id: 9103, text: "Not enough cash", tone: "bad" });
      frames.emit(0.25);
      yield* waitFor(actor, (st) => st.context.toasts.some((t) => t.id === 9103), { timeout: "1 second" });
      const ids = actor.getSnapshot().context.toasts.map((t) => t.id);
      expect(ids).toContain(9102);
      expect(ids).not.toContain(9101);
    }).pipe(Effect.provide(Layer.mergeAll(simLayer(handle), framesManual)));
  });
});
