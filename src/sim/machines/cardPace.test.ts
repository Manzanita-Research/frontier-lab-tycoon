import { describe, expect, it } from "vitest";
import { CARD_GAP_DAYS, STORY_GAP_DAYS, paceOfCard } from "../../content/cardPacing";
import { TICKS_PER_DAY, TICKS_PER_SECOND } from "../constants";
import { pacerAllows, pacerMachine, paceFor } from "./cardPace";
import { initialStored, step } from "./run";

const fresh = () => initialStored(pacerMachine, undefined);
const opened = (id: string, day: number, s = fresh()) => step(pacerMachine, s, { type: "OPENED", id, story: paceOfCard(id).story, day }).stored;

describe("the card budget (FLT-54)", () => {
  it("keeps CARD_GAP_DAYS between any two cards, and STORY_GAP_DAYS within a story", () => {
    const s = opened("hearing-unplug", 10);
    expect(pacerAllows(s.context, "waterDiscourse", "water", 10 + CARD_GAP_DAYS - 1)).toBe(false);
    expect(pacerAllows(s.context, "waterDiscourse", "water", 10 + CARD_GAP_DAYS)).toBe(true);
    expect(pacerAllows(s.context, "hearing-vote", "hearing", 10 + CARD_GAP_DAYS)).toBe(false);
    expect(pacerAllows(s.context, "hearing-vote", "hearing", 10 + CARD_GAP_DAYS, "chain")).toBe(true);
    expect(pacerAllows(s.context, "hearing-vote", "hearing", 10 + STORY_GAP_DAYS)).toBe(true);
  });

  it("lets the front of the line go first; an offer on a clock and a disaster go ahead of it", () => {
    let s = opened("documentary", 10);
    s = step(pacerMachine, s, { type: "WAITING", ids: ["truthers"], day: 12 }).stored;
    s = step(pacerMachine, s, { type: "JOIN", id: "hearing-vote", day: 13 }).stored;
    expect(s.context.queue.map((q) => q.id)).toEqual(["truthers", "hearing-vote"]);
    const day = 10 + STORY_GAP_DAYS;
    expect(pacerAllows(s.context, "hearing-vote", "hearing", day, "chain")).toBe(false);
    expect(pacerAllows(s.context, "shipNow", "shipNow", day, "priority")).toBe(true);
    expect(pacerAllows(s.context, "dz:gpuFire:fire", "disaster", 10 + CARD_GAP_DAYS, "urgent")).toBe(true);
    // Whoever stops asking leaves the line.
    s = step(pacerMachine, s, { type: "WAITING", ids: [], day: 14 }).stored;
    expect(s.context.queue).toEqual([]);
  });

  it("stretches the gap with speed so cards stay about 20 real seconds apart; disasters keep the 1x gap", () => {
    expect(paceFor(1, TICKS_PER_SECOND, TICKS_PER_DAY)).toEqual({ gap: CARD_GAP_DAYS, storyGap: STORY_GAP_DAYS, auto: false });
    expect(paceFor(3, TICKS_PER_SECOND, TICKS_PER_DAY).gap).toBe(10);
    const ten = paceFor(10, TICKS_PER_SECOND, TICKS_PER_DAY);
    expect(ten.gap * TICKS_PER_DAY / (TICKS_PER_SECOND * 10)).toBeGreaterThanOrEqual(20);
    expect(ten.auto).toBe(true);
    const s = step(pacerMachine, opened("era2", 10), { type: "PACE", ...ten }).stored;
    expect(pacerAllows(s.context, "dz:gpuFire:fire", "disaster", 10 + CARD_GAP_DAYS, "urgent")).toBe(true);
    expect(pacerAllows(s.context, "shipNow", "shipNow", 10 + CARD_GAP_DAYS, "priority")).toBe(false);
  });

  it("lets the next beat of a story the player is in (`now`, FLT-105) through at once, at any speed", () => {
    const ten = paceFor(10, TICKS_PER_SECOND, TICKS_PER_DAY);
    const s = step(pacerMachine, opened("acid-offer", 60), { type: "PACE", ...ten }).stored;
    expect(pacerAllows(s.context, "acid-enlightened", "acid", 61)).toBe(false);
    expect(pacerAllows(s.context, "acid-enlightened", "acid", 61, "urgent")).toBe(false);
    expect(pacerAllows(s.context, "acid-enlightened", "acid", 61, "now")).toBe(true);
  });

  it("files each card under its story: the rule's, else its id's first word", () => {
    expect(paceOfCard("hearing-gavel").story).toBe("hearing");
    expect(paceOfCard("truthers")).toMatchObject({ story: "water" });
    expect(paceOfCard("fx:doom-pause")).toMatchObject({ story: "factions", minor: true, default: 0 });
    expect(paceOfCard("dz:weightsLeak:leak")).toMatchObject({ story: "disaster", urgent: true });
    expect(paceOfCard("fundingRound")).toMatchObject({ priority: true });
  });
});
