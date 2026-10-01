// FLT-76: at top speed, sharp bad news drops the game to 1× (the machine half is in machine.test.ts).
import { describe, expect, it } from "vitest";
import { marksOf, sharpNews, slowText, type Look } from "./badNews";

const calm: Look = { rank: 2, trust: 60, leaks: [], defections: [] };

describe("sharp bad news", () => {
  it("is a fall of two places below your best since you sped up, not one", () => {
    let marks = marksOf(calm);
    let r = sharpNews(marks, { ...calm, rank: 3 }, true);
    expect(r.lines).toEqual([]);
    marks = r.marks;
    r = sharpNews(marks, { ...calm, rank: 4 }, true);
    expect(r.lines).toEqual(["you fell from #2 to #4 on the Arena"]);
    // The marks start again from here: #4 to #5 is not news.
    expect(sharpNews(r.marks, { ...calm, rank: 5 }, true).lines).toEqual([]);
  });

  it("measures from the best rank since, so a climb then a fall counts", () => {
    const up = sharpNews(marksOf({ ...calm, rank: 5 }), { ...calm, rank: 1 }, true);
    expect(up.lines).toEqual([]);
    expect(sharpNews(up.marks, { ...calm, rank: 3 }, true).lines).toEqual(["you fell from #1 to #3 on the Arena"]);
  });

  it("is public trust ten points below its high", () => {
    const high = sharpNews(marksOf(calm), { ...calm, trust: 70 }, true).marks;
    expect(sharpNews(high, { ...calm, trust: 61 }, true).lines).toEqual([]);
    expect(sharpNews(high, { ...calm, trust: 59.6 }, true).lines).toEqual(["public trust fell from 70 to 60"]);
  });

  it("is a new weights leak, or someone founding a lab across the fence", () => {
    const look: Look = { ...calm, leaks: ["weightsLeak:0"], defections: [{ id: "neo1", name: "Residual Labs", founder: "Priya Residual" }] };
    const r = sharpNews(marksOf(calm), look, true);
    expect(r.lines).toEqual(["your weights leaked", "Priya Residual left to found Residual Labs"]);
    expect(sharpNews(r.marks, look, true).lines).toEqual([]);
  });

  it("says nothing while it is not watching (1×, paused, or the setting off), and the marks follow along", () => {
    const r = sharpNews(marksOf(calm), { ...calm, rank: 9, trust: 10, leaks: ["weightsLeak:0"] }, false);
    expect(r.lines).toEqual([]);
    expect(sharpNews(r.marks, { ...calm, rank: 9, trust: 10, leaks: ["weightsLeak:0"] }, true).lines).toEqual([]);
  });

  it("ignores what is not on your HUD yet", () => {
    expect(sharpNews(marksOf({ ...calm, rank: null, trust: null }), { ...calm, rank: null, trust: null }, true).lines).toEqual([]);
  });

  it("says it in one line", () => {
    expect(slowText(["you fell from #2 to #6 on the Arena", "your weights leaked"])).toBe("Slowed to 1× for bad news: you fell from #2 to #6 on the Arena and your weights leaked.");
  });
});
