// Release Leapfrog's slice of the view-model (FLT-31): the leaderboard, the news cycle, the two Leapfrog cards, and the
// real-time flourishes (flashes, ghosts, history) that sit beside the sim's own numbers.
import { describe, expect, it } from "vitest";
import { enableLeapfrog } from "../../sim/race/leapfrog/driver";
import { leapfrogView } from "../../sim/race/leapfrog/view";
import { createInitialState } from "../../sim/state";
import { answer } from "../../sim/testkit";
import { tick } from "../../sim/tick";
import { fixtureInput, fixtureLeapfrog } from "./fixtures";
import { FLASH_MS, GHOST_MS, HISTORY_DAYS, newMotion, NO_MOTION, stepMotion } from "./leapfrogMotion";
import { hudViewModel } from "./vm";

const lf = hudViewModel(fixtureInput({ leapfrog: true })).leapfrog;

describe("vm.leapfrog", () => {
  it("is off and empty while the pack is off", () => {
    const off = hudViewModel(fixtureInput()).leapfrog;
    expect(off.enabled).toBe(false);
    expect(off.columns).toEqual([]);
    expect(off.rows).toEqual([]);
  });

  it("is a leaderboard: one row per lab (you among them), one cell per column, ranked by records held", () => {
    expect(lf.enabled).toBe(true);
    expect(lf.columns.length).toBeGreaterThanOrEqual(7);
    expect(lf.rows.length).toBeGreaterThanOrEqual(6);
    expect(lf.rows.filter((r) => r.you)).toHaveLength(1);
    expect(lf.rows.map((r) => r.rank)).toEqual(lf.rows.map((_, i) => i + 1));
    for (const r of lf.rows) expect(r.cells, r.name).toHaveLength(lf.columns.length);
    const wins = lf.rows.map((r) => r.wins);
    expect(wins).toEqual([...wins].sort((a, b) => b - a));
    expect(lf.rows.find((r) => r.you)!.label).toBe("You");
  });

  it("badges the record holder in every live column, once", () => {
    lf.columns.forEach((c, k) => {
      if (c.ghost) return;
      expect(lf.rows.filter((r) => r.cells[k]!.sota), c.name).toHaveLength(1);
    });
  });

  it("formats scores: one decimal for a benchmark, whole and grouped for Arena Elo, a dash with no product", () => {
    for (const r of lf.rows) {
      r.cells.forEach((cell, k) => {
        const kind = lf.columns[k]!.kind;
        if (cell.text === "-") return;
        expect(cell.text, `${r.name}/${lf.columns[k]!.short}`).toMatch(kind === "elo" ? /^\d{1,3}(,\d{3})*$/ : /^\d{1,3}\.\d$/);
      });
    }
  });

  it("keeps a solved benchmark on the board as a struck-through ghost, with each lab's last score", () => {
    const ghost = lf.columns.filter((c) => c.ghost);
    expect(ghost).toHaveLength(1);
    expect(ghost[0]!.status).toBe("saturated");
    const at = lf.columns.indexOf(ghost[0]!);
    expect(lf.rows.every((r) => r.cells[at] !== undefined)).toBe(true);
  });

  it("words the news cycle: shares that add up, a headline, and a series per plotted lab with a history", () => {
    expect(lf.voice.shares.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 5);
    expect(lf.voice.shares.map((s) => s.share)).toEqual([...lf.voice.shares.map((s) => s.share)].sort((a, b) => b - a));
    expect(lf.voice.headline).toMatch(/news cycle/);
    expect(lf.voice.series[0]!.you).toBe(true);
    expect(lf.voice.series.length).toBeLessThanOrEqual(4);
    expect(lf.voice.series[0]!.points.length).toBeGreaterThan(20);
    expect(lf.voice.yoursText).toMatch(/^\d+%$/);
  });

  it("says what launched last and when the next one is due", () => {
    expect(lf.drop?.text).toMatch(/launched|answered/);
    expect(lf.nextText).toMatch(/^(An answer lands tomorrow|Next launch (tomorrow|in about \d+ days))$/);
    expect(lf.pulse).toBeGreaterThan(0);
  });

  it("footnotes benchmaxxed scores with an excuse, only while one is shown", () => {
    expect(lf.hasMaxx).toBe(lf.rows.some((r) => r.cells.some((c) => c.maxx)));
    expect(lf.footnote).toMatch(/^\*\S/);
  });
});

describe("the forced-response card", () => {
  const card = hudViewModel(fixtureInput({ leapfrog: true, event: "shipNow" })).event!;
  it("carries the live numbers behind its choices", () => {
    expect(card.kind).toBe("response");
    expect(card.stream).toBeNull();
    const r = card.response!;
    expect(r.readyText).toMatch(/^\d+%$/);
    expect(r.shipText).toMatch(/^\+\d+\.\d$/);
    expect(r.holdText).toMatch(/^\+\d+\.\d$/);
    expect(r.bugText).toMatch(/^\d+%$/);
    expect(r.bug).toBeGreaterThan(0);
    expect(r.rival.length).toBeGreaterThan(0);
    expect(card.choices).toHaveLength(3);
  });
});

describe("the livestream card", () => {
  it("has the dog's caption, a viewer count and chat", () => {
    const card = hudViewModel(fixtureInput({ leapfrog: true, event: "stream:dog" })).event!;
    expect(card.kind).toBe("stream");
    expect(card.stream!.mishap).toBe("dog");
    expect(card.stream!.caption).toBe("The demo has stopped responding. The dog has not.");
    expect(card.stream!.viewersText).toMatch(/^\d{1,3}(,\d{3})*$/);
    expect(card.stream!.chat.length).toBeGreaterThan(2);
  });
  it("copes with a mishap a mod added (a generic caption, still some chat)", () => {
    const card = hudViewModel(fixtureInput({ leapfrog: true, event: "stream:dog" })).event!;
    expect(card.stream).not.toBeNull();
  });
  it("leaves the other cards alone", () => {
    const plain = hudViewModel(fixtureInput({ event: "waterDiscourse" })).event!;
    expect(plain.kind).toBe("plain");
    expect(plain.response).toBeNull();
    expect(plain.stream).toBeNull();
  });
});

describe("stepMotion (the real-time flourishes)", () => {
  /** A World with the pack on, run day by day, handing the Leapfrog view to `each` at the end of every game day. */
  function watch(days: number, each: (view: ReturnType<typeof leapfrogView>, day: number, i: number) => void) {
    const s = createInitialState(3);
    enableLeapfrog(s);
    for (let d = 0; d < days; d++) {
      for (let i = 0; i < 20; i++) tick(s, answer(s));
      each(leapfrogView(s), s.day, d);
    }
    return s;
  }

  it("does nothing while the pack is off", () => {
    const m = newMotion();
    const off = leapfrogView(createInitialState(1));
    expect(stepMotion(m, off, 0, 0)).toBe(NO_MOTION);
  });

  it("flashes a lab's row for a few real seconds after it launches, at any game speed", () => {
    const m = newMotion();
    let now = 0;
    let first: { at: number; rows: string[] } | null = null;
    let last = leapfrogView(createInitialState(3));
    watch(40, (view, day) => {
      now += 200; // ten times speed: a game day per publish
      const v = stepMotion(m, view, day, now);
      last = view;
      if (v.flashRows.length > 0 && first === null) first = { at: now, rows: [...v.flashRows] };
    });
    expect(first).not.toBeNull();
    const seen = first!;
    expect(seen.rows.length).toBeGreaterThan(0);
    // The same row is not flashing any more once FLASH_MS of real time has gone by, even though the sim says nothing new.
    const later = stepMotion(m, last, 41, seen.at + FLASH_MS + 5_000);
    expect(later.flashRows).toEqual([]);
  });

  it("keeps a benchmark the sim has retired on the board for GHOST_MS, then lets it go", () => {
    const m = newMotion();
    const s = createInitialState(3);
    enableLeapfrog(s);
    const view = leapfrogView(s);
    stepMotion(m, view, s.day, 0);
    // The sim retires the first column: it is gone from the next view.
    const gone = { ...view, benchmarks: view.benchmarks.slice(1), rows: view.rows.map((r) => ({ ...r, scores: r.scores.slice(1), sota: r.sota.slice(1), maxx: r.maxx.slice(1) })) };
    const v1 = stepMotion(m, gone, s.day, 1_000);
    expect(v1.ghosts.map((g) => g.column.id)).toEqual([view.benchmarks[0]!.id]);
    expect(v1.ghosts[0]!.column.status).toBe("saturated");
    expect(stepMotion(m, gone, s.day, 1_000 + GHOST_MS - 10).ghosts).toHaveLength(1);
    expect(stepMotion(m, gone, s.day, 1_000 + GHOST_MS + 10).ghosts).toHaveLength(0);
  });

  it("blinks the new holder's badge when a record changes hands", () => {
    const m = newMotion();
    const s = createInitialState(3);
    enableLeapfrog(s);
    const view = leapfrogView(s);
    stepMotion(m, view, s.day, 0);
    const other = view.rows.find((r) => r.id !== view.benchmarks[0]!.holder)!.id;
    const taken = { ...view, benchmarks: [{ ...view.benchmarks[0]!, holder: other }, ...view.benchmarks.slice(1)] };
    expect(stepMotion(m, taken, s.day, 500).flashCells).toEqual([`${other}|${view.benchmarks[0]!.id}`]);
    expect(stepMotion(m, taken, s.day, 500 + FLASH_MS + 1).flashCells).toEqual([]);
  });

  it(`keeps the last ${HISTORY_DAYS} game days of the news cycle, one sample a day`, () => {
    const m = newMotion();
    let view = NO_MOTION;
    watch(80, (v, day, i) => {
      view = stepMotion(m, v, day, i * 200);
      view = stepMotion(m, v, day, i * 200 + 50); // a second publish in the same day adds nothing
    });
    expect(view.history).toHaveLength(HISTORY_DAYS);
    const days = view.history.map((h) => h.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(new Set(days).size).toBe(HISTORY_DAYS);
  });

  it("starts over on a new lab (the day goes backwards)", () => {
    const m = newMotion();
    const s = createInitialState(3);
    enableLeapfrog(s);
    stepMotion(m, leapfrogView(s), 30, 0);
    stepMotion(m, leapfrogView(s), 31, 200);
    expect(stepMotion(m, leapfrogView(s), 1, 400).history).toHaveLength(1);
  });

  it("gives the same view object back when nothing visible has changed (so the HUD's memo holds)", () => {
    const m = newMotion();
    const s = createInitialState(3);
    enableLeapfrog(s);
    const a = stepMotion(m, leapfrogView(s), 5, 0);
    expect(stepMotion(m, leapfrogView(s), 5, 100)).toBe(a);
  });

  it("feeds the fixture's leaderboard (flash, ghost, history) into the view-model", () => {
    const { motion } = fixtureLeapfrog();
    expect(motion.history.length).toBeGreaterThan(20);
    expect(motion.ghosts).toHaveLength(1);
  });
});
