// FLT-102: a mod's voice rewrites flavour text by rules. Same text in, same text out; numbers, prices and handles survive.
import { describe, expect, it } from "vitest";
import { makeVoice, momentLine } from "./voice";
import type { VoiceData } from "./schema";

const duckish: VoiceData = {
  lowercase: true,
  words: { the: "da", that: "dat", with: "wif", problem: "pwobwem" },
  letters: [
    { from: "r", to: "w", odds: 1 },
    { from: "l", to: "w", odds: 1 },
  ],
  ellipsis: 1,
  emoji: { list: ["🦆", "✨"], min: 1, max: 2 },
  moments: { ship: ["we shipped... or did da ship ship us 🦆"], level: ["a new wevew 🦆", "anuvva wevew ✨"] },
};

describe("a voice", () => {
  const say = makeVoice(duckish);

  it("swaps words and letters, lowercases, and trails off with an emoji", () => {
    const out = say("The problem with Lab Rules.");
    expect(out).toMatch(/^da pwobwem wif wab wuwes\.\.\. (🦆|✨){1,2}$/u);
  });

  it("is deterministic: the same text always comes out the same", () => {
    const voice = makeVoice({ ...duckish, letters: [{ from: "r", to: "w", odds: 0.5 }], leet: { odds: 0.5, map: { e: "3", o: "0" } } });
    const line = "Researchers report the world is ready for another release tomorrow morning.";
    const first = voice(line);
    expect(voice(line)).toBe(first);
    expect(makeVoice({ ...duckish, letters: [{ from: "r", to: "w", odds: 0.5 }], leet: { odds: 0.5, map: { e: "3", o: "0" } } })(line)).toBe(first);
    // Odds mean a mix, not all or nothing.
    expect(first).toMatch(/w/);
    expect(first).toMatch(/r/);
  });

  it("says the names it is asked to keep as they are (the loaded mods': \"Mods on: …\")", () => {
    const keeping = makeVoice(duckish, ["Rubber Lab Mode", "Lab"]);
    const out = keeping("Mods on: Rubber Lab Mode, and the Lab is real");
    expect(out).toContain("Rubber Lab Mode");
    expect(out).toMatch(/^mods on: Rubber Lab Mode, and da Lab is weaw/);
  });

  it("leaves numbers, prices, percentages, handles and tags alone", () => {
    const out = say("Revenue $1.2M, 45% trust, Frontier-4.5 from @lab_rules #ai on Day 12.");
    for (const kept of ["$1.2M,", "45%", "Frontier-4.5", "@lab_rules", "#ai", "12"]) expect(out).toContain(kept);
  });

  it("keeps the capitals when the voice does not lowercase", () => {
    expect(makeVoice({ ...duckish, lowercase: false, emoji: undefined, ellipsis: 0 })("Rules for the Lab.")).toBe("Wuwes fow da Wab.");
  });

  it("leaves a line that is already in voice alone (a hand-written line ends with its emoji)", () => {
    expect(say("hewwo fwom da pond 🦆")).toBe("hewwo fwom da pond 🦆");
    expect(say(say("The rules."))).toBe(say("The rules."));
  });

  it("passes empty and non-word text through", () => {
    expect(say("")).toBe("");
    expect(say("$4,200")).toBe("$4,200");
  });

  it("picks a moment line by a key, the same one every time", () => {
    expect(momentLine(duckish, "ship", 3)).toBe("we shipped... or did da ship ship us 🦆");
    expect(momentLine(duckish, "level", 2)).toBe(momentLine(duckish, "level", 2));
    expect(new Set([1, 2, 3, 4, 5, 6].map((k) => momentLine(duckish, "level", k))).size).toBe(2);
    expect(momentLine(duckish, "senate", 1)).toBeNull();
  });

  it("is cheap: a thousand fresh lines in a few milliseconds, and a repeat is a cache hit", () => {
    const voice = makeVoice(duckish);
    const lines = Array.from({ length: 1000 }, (_, i) => `Researcher ${i} thinks the cluster is really loud today, honestly.`);
    const t = performance.now();
    for (const l of lines) voice(l);
    const fresh = performance.now() - t;
    const t2 = performance.now();
    for (const l of lines) voice(l);
    const cached = performance.now() - t2;
    expect(fresh).toBeLessThan(200);
    expect(cached).toBeLessThan(fresh);
  });
});
