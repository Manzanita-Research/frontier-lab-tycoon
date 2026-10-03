import { describe, expect, it } from "vitest";
import { busyLab } from "../defection/demo";
import { openEventOf, unpaced } from "../events";
import { hourAt } from "../daylight";
import { slopbowlView } from "./view";
import { enableEarnedPacks } from "../progression";
import { createInitialState } from "../state";
import { answer } from "../testkit";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";
import { digest } from "../golden";
import { isDue, LATE_FLAG } from "./driver";
import { CARD, loadSlopBowlPack, SLOPBOWL } from "./pack";
import { stageSlopBowl } from "./demo";
import script from "../../../docs/specs/FLT-109-script.md?raw";
import pack from "../../../mods/base-slopbowl/mod.json";

const R = SLOPBOWL.rules;
const NAME = "Fancy Healthy Healthy Healthy Healthy Slop Bowl";

/** Defection's lab a year in, every pack awake (no ladder), cards back to back. */
function lab(seed = 1, off = false): GameState {
  const s = createInitialState(seed);
  if (off) s.flags.slopbowlOff = 1;
  delete s.progression;
  enableEarnedPacks(s);
  unpaced(s);
  busyLab(s);
  return s;
}
/** Tick until `done`, answering every card with `pick` (lunch's) or its first choice (anything else). */
function until(s: GameState, done: (s: GameState) => boolean, days: number, pick = 0, each?: (s: GameState) => void) {
  for (let i = 0; i < days * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    if (open) applyNow(s, answer(s, open.id === CARD ? pick : 0));
    else tick(s);
    each?.(s);
  }
  if (!done(s)) throw new Error(`not yet (lunch is ${s.slopbowl?.machine.value}, day ${s.day})`);
}
const stage = (v: string) => (s: GameState) => s.slopbowl?.machine.value === v;
const atGate = (s: GameState) => s.walkers.filter((w) => w.kind === "researcher" && Math.abs(w.x - (s.gate.x + s.gate.w / 2)) < 3.5 && s.gate.z - w.z < 4.5).length;

describe("the Slop Bowl pack", () => {
  it("keeps the place's name exactly, and every beat has something to say", () => {
    expect(R.place).toBe(NAME);
    expect(SLOPBOWL.content.events.add[0]!.body).toContain(NAME);
    expect(R.beats.late.toast?.text).toContain(NAME);
    expect(R.beats.arrive.beat?.caption).toContain(NAME);
    expect(R.courier.lines[0]).toContain(NAME);
    for (const beat of ["hangry", "worse"] as const) {
      expect(R.beats[beat].posts!.length).toBeGreaterThanOrEqual(R.beats[beat].postCount!);
      expect(R.beats[beat].rivals!.length).toBeGreaterThanOrEqual(R.beats[beat].rivalCount!);
    }
    expect(() => loadSlopBowlPack({})).toThrow();
  });
  it("is all in the script (docs/specs/FLT-109-script.md), every line of it", () => {
    const strings: string[] = [];
    const walk = (v: unknown, key = "") => {
      if (typeof v === "string") {
        if (!["id", "type", "name", "tone", "importance", "kind", "when", "flag"].includes(key)) strings.push(v);
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk({ card: pack.content.events.add, rules: pack.rules });
    for (const line of strings) expect(script, line).toContain(line);
  });
  it("falls due at noon on the campus clock, once a cycle", () => {
    const noons = Array.from({ length: 3000 }, (_, t) => t).filter(isDue);
    expect(noons.length).toBe(5);
    for (const t of noons) expect(hourAt(t)).toBe(12);
  });
});

describe("a late lunch in the game", () => {
  it("plays the three days: late, hangry, worse, the meltdown, the courier, fed; research slides back and is won back; the Aura drops", () => {
    const s = lab();
    s.training = { ...s.training, context: { ...s.training.context, progress: s.training.context.cost * 0.6 } };
    s.flags[LATE_FLAG] = s.day;
    const progress: number[] = [];
    // The Aura each beat moves, measured across the tick it plays (nothing else touches it mid-day).
    const moved: Record<string, number> = {};
    let last = { value: "quiet", aura: s.birdapp!.aura };
    const record = (w: GameState) => {
      progress.push(w.training.context.progress);
      const now = { value: w.slopbowl!.machine.value, aura: w.birdapp!.aura };
      if (now.value !== last.value) moved[now.value] = Math.round((now.aura - last.aura) * 100) / 100;
      last = now;
    };
    until(s, stage("late"), 8, 0, record);
    const due = s.slopbowl!.machine.context.due;
    expect(hourAt(due)).toBe(12);
    expect(s.news.some((n) => n.text.includes(NAME)) || s.toasts.some((t) => t.text.includes(NAME))).toBe(true);
    until(s, stage("hangry"), 2, 0, record);
    expect(s.tick - due).toBe(R.days.hangry * TICKS_PER_DAY);
    expect(slopbowlView(s)).toMatchObject({ stage: "hangry", eta: R.tracker.steps.hangry.eta, slipped: [R.tracker.steps.late.eta], backwards: true });
    const before = s.training.context.progress;
    until(s, stage("worse"), 3, 0, record);
    expect(s.thoughts.some((t) => [...R.beats.worse.thoughts!].includes(t.text))).toBe(true);
    // Two days late: (nearly) the whole lab is at the gate, and the rival labs have said something.
    until(s, (w) => w.tick - due >= 2 * TICKS_PER_DAY + 8, 1, 0, record);
    const researchers = s.walkers.filter((w) => w.kind === "researcher").length;
    expect(atGate(s)).toBeGreaterThanOrEqual(Math.floor(researchers * 0.6));
    expect(s.birdapp!.rivals!.posts.some((p) => R.beats.worse.rivals!.includes(p.text) || R.beats.hangry.rivals!.includes(p.text))).toBe(true);
    expect(s.birdapp!.posts.some((p) => [...R.beats.hangry.posts!, ...R.beats.worse.posts!].includes(p.text))).toBe(true);
    expect(Math.min(...progress)).toBeLessThan(before);
    until(s, stage("meltdown"), 2, 0, record);
    // Day three: some of them lie down on the floor, and the tracker says which day it is.
    expect(s.slopbowl!.flopped!.length).toBe(R.flop);
    expect(slopbowlView(s)!.dayLine).toBe(`Day 3 of the ${NAME} being late`);
    until(s, stage("arriving"), 3, 0, record);
    expect(s.tick - due).toBe(R.days.arrive * TICKS_PER_DAY);
    expect(s.disasters.cues.some((c) => c.type === "beat" && c.caption.includes(NAME))).toBe(true);
    const courier = s.walkers.find((w) => w.role === R.courier.role);
    expect(courier?.kind).toBe("visitor");
    until(s, stage("fed"), 3, 0, record);
    expect(s.slopbowl!.owed).toBeGreaterThan(0);
    expect(s.slopbowl!.flopped).toEqual([]);
    expect(slopbowlView(s)).toMatchObject({ delivered: true, eta: R.tracker.steps.fed.eta, backwards: false });
    expect(s.toasts.some((t) => t.text === R.beats.fed.toast!.text) || s.news.length > 0).toBe(true);
    until(s, stage("quiet"), 4, 0, record);
    until(s, (w) => w.slopbowl!.owed === 0, 10, 0, record);
    // (Noon falls on a midnight, so the day beats share their tick with the Bird App's own; the meltdown is mid-day.)
    expect(moved.meltdown).toBe(R.beats.meltdown.aura);
    expect(R.beats.hangry.aura! + R.beats.worse.aura! + R.beats.meltdown.aura! + R.beats.fed.aura!).toBeLessThan(0);
    // Lunch over: nobody is held at the gate any more.
    expect(s.slopbowl!.crowd).toBe(0);
    // The courier hands the bowls over and goes home.
    until(s, (w) => !w.walkers.some((x) => x.role === R.courier.role), 10);
  });

  it("puts its card up an hour late, and the answers matter", () => {
    const run = (pick: number) => {
      const s = lab(2);
      // Well into a run, so the slide has room (a run just started can only fall back to zero).
      s.training = { ...s.training, context: { ...s.training.context, progress: s.training.context.cost * 0.6 } };
      s.flags[LATE_FLAG] = s.day;
      until(s, stage("late"), 8);
      for (let i = 0; i < 2 * TICKS_PER_DAY && openEventOf(s)?.id !== CARD; i++) tick(s, openEventOf(s) ? answer(s) : []);
      expect(openEventOf(s)?.id).toBe(CARD);
      const cash = s.cash;
      applyNow(s, answer(s, pick));
      expect(s.slopbowl!.machine.context.pick).toBe(["wait", "granola", "backup"][pick]);
      expect(cash - s.cash).toBe([0, 30_000, 15_000][pick]);
      until(s, stage("quiet"), 10);
      return s;
    };
    const wait = run(0);
    const granola = run(1);
    expect(granola.slopbowl!.tally.lost).toBeLessThan(wait.slopbowl!.tally.lost);
    const backup = run(2);
    expect(backup.toasts.some((t) => t.text === R.beats.backup.toast!.text) || backup.news.some((n) => n.text === R.beats.backup.toast!.text)).toBe(true);
  });

  it("is the same afternoon for the same seed", () => {
    const play = () => {
      const s = lab(3);
      s.flags[LATE_FLAG] = s.day;
      until(s, stage("late"), 8);
      until(s, stage("quiet"), 12);
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });

  it("moves nothing until the order is actually late (its dice are its own)", () => {
    const on = lab(4);
    const off = lab(4, true);
    expect(off.slopbowl).toBeUndefined();
    on.slopbowl!.wokeDay = on.day; // not settled in yet: no lunch can run late
    for (let i = 0; i < 25 * TICKS_PER_DAY; i++) {
      tick(on, answer(on));
      tick(off, answer(off));
    }
    expect(on.slopbowl!.tally.late).toBe(0);
    delete off.flags.slopbowlOff;
    expect(digest(on)).toBe(digest(off));
  });

  it("turns up in normal play, now and then", () => {
    const s = lab(5);
    for (let i = 0; i < 360 * TICKS_PER_DAY; i++) tick(s, answer(s));
    // Twelve noons a year; a third of them late at most (and never two in a row).
    expect(s.slopbowl!.tally.late).toBeGreaterThanOrEqual(1);
    expect(s.slopbowl!.tally.late).toBeLessThanOrEqual(6);
  });

  it("stages its review links", () => {
    for (const [moment, value] of [["slop-late", "meltdown"], ["slop-card", "hangry"], ["slop-arrives", "arriving"], ["slop-fed", "fed"]] as const) {
      const s = createInitialState(1);
      delete s.progression;
      enableEarnedPacks(s);
      stageSlopBowl(s, moment);
      expect(s.slopbowl!.machine.value).toBe(value);
      if (moment === "slop-card") expect(openEventOf(s)?.id).toBe(CARD);
      if (moment === "slop-arrives") expect(s.meetings?.some((m) => m.owner === "slopbowl" && m.phase === "talking")).toBe(true);
    }
  });
});
