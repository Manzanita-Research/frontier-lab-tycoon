// FLT-76: the first minutes get one decision. The Logo opens on Level 1, two days after the first path (the first model
// is training by then), long before the ladder opens the other cards, and never comes back. And a minor beat for the
// quiet stretch 106 days into Scrutiny.
import { describe, expect, it } from "vitest";
import { chooseEvent, openEventOf } from "./events";
import { levelOf } from "./progression";
import { createRng } from "./rng";
import { createInitialState } from "./state";
import { applyNow, tick } from "./tick";
import { answer, createTestCampus, readyForPressure, runDays } from "./testkit";
import { paceOfCard } from "../content/cardPacing";
import { TICKS_PER_DAY } from "./constants";

const paths = [18, 17, 16].map((z) => ({ type: "placePath" as const, x: 11, z }));

function opening(seed = 1) {
  const s = createInitialState(seed);
  applyNow(s, [{ type: "buildPanelOpened" }, ...paths, { type: "placeBuilding", kind: "hall", x: 12, z: 16 }]);
  return s;
}

describe("the first decision (the Logo)", () => {
  it("opens on Level 1, two days after the first path, before the first model ships", () => {
    const s = opening();
    const first = s.flags.firstPath!;
    for (let i = 0; i < 10 * TICKS_PER_DAY && !openEventOf(s); i++) tick(s);
    expect(openEventOf(s)?.id).toBe("theLogo");
    expect(s.day).toBe(first + 2);
    expect(levelOf(s)).toBe(1);
    expect(s.models).toHaveLength(0);
  });

  it("stops the clock like any card, costs $8K for the butthole-ier butthole, and never asks again", () => {
    const s = opening();
    for (let i = 0; i < 10 * TICKS_PER_DAY && !openEventOf(s); i++) tick(s);
    const at = s.tick;
    tick(s);
    expect(s.tick).toBe(at);
    const cash = s.cash;
    const hype = s.hype;
    chooseEvent(s, createRng(1), "theLogo", 1);
    expect(s.cash).toBe(cash - 8_000);
    expect(s.hype).toBeGreaterThan(hype);
    expect(openEventOf(s)).toBeNull();
    // Through Level 2 and on: no Logo again (and nothing else opens before the ladder says so).
    for (let i = 0; i < 120 * TICKS_PER_DAY && levelOf(s) < 3; i++) {
      tick(s, answer(s));
      expect(openEventOf(s)?.id ?? null).not.toBe("theLogo");
    }
  });

  it("is a Level 1 card only: a lab already past it never sees it", () => {
    const s = opening();
    (s.progression!.context as { level: number }).level = 2;
    for (let i = 0; i < 10 * TICKS_PER_DAY; i++) tick(s);
    expect(openEventOf(s)).toBeNull();
    expect(s.arcs.theLogo!.context.openedDay).toBeNull();
  });
});

describe("the quiet stretch's beat (the offsite)", () => {
  it("lands 106 days into Scrutiny, as a card or, with no room for it, on the ticker", () => {
    const s = createTestCampus();
    readyForPressure(s);
    s.flags.scrutinyDay = s.day - 104;
    runDays(s, 1);
    expect(s.arcs.offsite!.context.openedDay).toBeNull();
    runDays(s, 3);
    expect(s.arcs.offsite!.context.openedDay).toBe(s.flags.scrutinyDay + 106);
  });

  it("is minor: it answers itself (skipping the offsite) rather than wait behind another card", () => {
    expect(paceOfCard("offsite")).toMatchObject({ minor: true, default: 0 });
  });
});
