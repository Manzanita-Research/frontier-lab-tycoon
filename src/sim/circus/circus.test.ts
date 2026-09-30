import { describe, expect, it } from "vitest";
import { runCircusYear } from "./headless";

describe("a year of the Circus (headless, every card answered)", () => {
  it.each([
    ["earnest", "commended"],
    ["slick", "captured"],
    ["chaotic", "viral"],
    ["mixed", "grilled"],
  ] as const)("a %s witness is %s at every hearing, and the yacht sails and leaks", (witness, verdict) => {
    const r = runCircusYear(3, witness, { rsvp: 0, reply: 1 });
    expect(r.outcome).not.toBe("lost");
    expect(r.hearings.length).toBeGreaterThanOrEqual(2);
    for (const h of r.hearings) expect(h.verdict).toBe(verdict);
    expect(r.yacht).toMatchObject({ rsvp: "sign", ending: "apologised" });
  }, 20_000);
  it("the meters end the year where the witness put them", () => {
    const earnest = runCircusYear(1, "earnest"), slick = runCircusYear(1, "slick");
    expect(earnest.trust).toBeGreaterThan(slick.trust);
    expect(slick.capture).toBeGreaterThan(earnest.capture + 30);
  }, 20_000);
  it("is deterministic for a seed", () => {
    const run = () => { const r = runCircusYear(2, "mixed", { rsvp: 2, reply: 0 }); return JSON.stringify([r.cards, r.hearings, r.yacht, r.world.news]); };
    expect(run()).toBe(run());
  }, 20_000);
});
