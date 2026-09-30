import { describe, expect, it } from "vitest";
import { createSimHandle } from "../../app/sim";
import { eventById } from "../../content/events";
import { readDebugParams } from "../../debug";
import { openEventOf } from "../events";
import { GAVEL_CARD } from "../hearing/pack";
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

describe("the review links", () => {
  it("stages each moment with its card on screen, and ?hearing=off / ?yacht=off keep the packs asleep", () => {
    const card = (moment: string) => openEventOf(createSimHandle(readDebugParams(`?moment=${moment}`)).world)?.id;
    expect(eventById(card("hearing") ?? "")?.kind).toBe("hearing");
    expect(card("hearing-verdict")).toBe(GAVEL_CARD);
    expect(card("yacht-invite")).toBe("yacht-invite");
    expect(card("yacht-leak")).toBe("yacht-leak");
    const off = createSimHandle(readDebugParams("?hearing=off&yacht=off")).world;
    expect(off.flags.hearingOff).toBe(1);
    expect(off.flags.yachtOff).toBe(1);
  }, 20_000);
});
