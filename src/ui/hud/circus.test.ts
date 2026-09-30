// The Hearing (FLT-21) and the leaked group chat (FLT-24) as the HUD sees them: real staged Worlds through the view-model.
import { describe, expect, it } from "vitest";
import { fixtureInput } from "./fixtures";
import { hudViewModel } from "./vm";

const vmOf = (circus: "hearing" | "hearing-verdict" | "yacht-invite" | "yacht-leak") => hudViewModel(fixtureInput({ circus }));

describe("the Hearing card", () => {
  it("puts the second senator's question on the table after one chaotic answer", () => {
    const e = vmOf("hearing").event!;
    expect(e.kind).toBe("hearing");
    const h = e.hearing!;
    expect(h.senators).toHaveLength(3);
    expect(h.senators.filter((s) => s.asking)).toHaveLength(1);
    expect(h.asking?.id).toBe(h.senators[1]!.id);
    expect(h.senators[0]!.answered).toBe("chaotic");
    expect(h.progressText).toBe("Question 2 of 3");
    expect(h.verdict).toBeNull();
    // One answer per choice, in order, each saying what it moves.
    expect(h.answers.map((a) => a.style)).toEqual(["earnest", "slick", "chaotic"]);
    expect(e.choices).toHaveLength(3);
    for (const a of h.answers) expect(a.moves.length).toBeGreaterThan(0);
    const slickCapture = h.answers[1]!.moves.find((m) => m.meter === "capture");
    expect(slickCapture?.good).toBeNull();
    expect(slickCapture?.arrows).toMatch(/▲/);
  });
  it("bangs the gavel: chaotic, chaotic, earnest goes viral", () => {
    const e = vmOf("hearing-verdict").event!;
    expect(e.kind).toBe("hearing");
    expect(e.hearing!.verdict?.id).toBe("viral");
    expect(e.hearing!.asking).toBeNull();
    expect(e.hearing!.progressText).toBe("Adjourned");
    expect(e.choices).toHaveLength(1);
  });
});

describe("the yacht", () => {
  it("sends a plain invitation card", () => {
    const e = vmOf("yacht-invite").event!;
    expect(e.id).toBe("yacht-invite");
    expect(e.leak ?? null).toBeNull();
    expect(e.choices).toHaveLength(3);
  });
  it("leaks the group chat, with the player in it", () => {
    const e = vmOf("yacht-leak").event!;
    expect(e.kind).toBe("leak");
    const leak = e.leak!;
    expect(leak.rsvp).toBe("sign");
    expect(leak.messages.length).toBeGreaterThanOrEqual(6);
    expect(leak.messages.some((m) => m.you)).toBe(true);
    expect(leak.members).toMatch(/the yacht$/);
    expect(JSON.stringify(leak)).not.toMatch(/\{\w+\}|undefined/);
  });
});
