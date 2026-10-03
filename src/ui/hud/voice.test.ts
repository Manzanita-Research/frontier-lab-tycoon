// FLT-102: a mod's voice rewrites the HUD's flavour text and leaves the controls, numbers and instructions readable.
import { describe, expect, it } from "vitest";
import { makeVoice } from "../../mods/voice";
import type { VoiceData } from "../../mods/schema";
import { fixtureInput } from "./fixtures";
import { hudViewModel } from "./vm";
import { voiceVM } from "./voice";
import { momentsBetween, signalsOf, type MomentSignals } from "./voiceMoments";

const rules: VoiceData = {
  lowercase: true,
  words: { the: "da" },
  letters: [{ from: "r", to: "w", odds: 1 }, { from: "l", to: "w", odds: 1 }],
  emoji: { list: ["🦆"], min: 1, max: 1 },
};
const opts = { say: makeVoice(rules), glyph: "🦆" };
const duck = /🦆$/u;

describe("a voice on the HUD", () => {
  it("rewrites thoughts, toasts and the ticker, and keeps the numbers in them", () => {
    const vm = hudViewModel(fixtureInput());
    const out = voiceVM(vm, opts);
    expect(out.toasts[0]!.text).toMatch(duck);
    expect(out.toasts[0]!.text).toContain("+$70K");
    expect(out.toasts[0]!.text).toContain("Frontier-2");
    for (const t of out.ticker) expect(t.text).toMatch(duck);
    for (const t of out.thoughtsPanel) expect(t.text).toMatch(duck);
    expect(out.thoughtsPanel.length).toBe(vm.thoughtsPanel.length);
  });

  it("leaves the controls alone: stats, build items, choices, hints", () => {
    const vm = hudViewModel(fixtureInput({ circus: "yacht-leak" }));
    const out = voiceVM(vm, opts);
    expect(out.stats).toBe(vm.stats);
    expect(out.buildItems).toBe(vm.buildItems);
    expect(out.progress).toBe(vm.progress);
    expect(out.event!.choices).toBe(vm.event!.choices);
    expect(out.event!.body).toMatch(duck);
    const said = out.event!.leak!.messages.filter((m) => !m.system && /\p{L}/u.test(m.text));
    expect(said.every((m) => duck.test(m.text))).toBe(true);
    const hinted = voiceVM({ ...vm, toasts: [{ id: 9, text: "Build an API Gateway to sell tokens.", tone: "hint" }] }, opts);
    expect(hinted.toasts[0]!.text).toBe("Build an API Gateway to sell tokens.");
  });

  it("puts a duck on every Bird App poster and voices their posts", () => {
    const vm = hudViewModel(fixtureInput({ bird: "bird", birdOpen: true }));
    expect(vm.birdapp.posters.length).toBeGreaterThan(0);
    const out = voiceVM(vm, opts);
    expect(out.birdapp.posters.every((p) => p.glyph === "🦆")).toBe(true);
    for (const p of [...out.birdapp.live, ...out.birdapp.log]) {
      expect(p.glyph).toBe("🦆");
      expect(p.text).toMatch(duck);
      expect(p.likesText).toBe(vm.birdapp.live.concat(vm.birdapp.log).find((q) => q.id === p.id)!.likesText);
    }
    // The preview's post and a skin with no avatars of its own get the duck too.
    if (out.birdapp.spotlight) expect(out.birdapp.spotlight.text).toMatch(duck);
    expect(out.birdapp.face).toBe("🦆");
    expect(vm.birdapp.face).toBeUndefined();
  });

  it("is deterministic: the same view-model comes out the same", () => {
    const vm = hudViewModel(fixtureInput({ bird: "bird" }));
    expect(JSON.stringify(voiceVM(vm, { say: makeVoice(rules), glyph: "🦆" }))).toBe(JSON.stringify(voiceVM(vm, opts)));
  });
});

describe("a voice's big moments", () => {
  const base: MomentSignals = { model: "Frontier-1", level: 2, era: null, leak: null, leaked: 0, hearing: false, escaped: 0, ending: null };
  it("says nothing when nothing started", () => {
    expect(momentsBetween(base, { ...base })).toEqual([]);
  });
  it("hears a ship, a level-up, an era, a leak, the Senate, an escape and an ending as each starts", () => {
    expect(momentsBetween(base, { ...base, model: "Frontier-2" })).toEqual(["ship"]);
    expect(momentsBetween(base, { ...base, level: 3 })).toEqual(["level"]);
    expect(momentsBetween(base, { ...base, era: 2 })).toEqual(["era"]);
    expect(momentsBetween(base, { ...base, leak: "yacht-leak" })).toEqual(["leak"]);
    expect(momentsBetween(base, { ...base, leaked: 1 })).toEqual(["leak"]);
    expect(momentsBetween(base, { ...base, hearing: true })).toEqual(["senate"]);
    expect(momentsBetween({ ...base, hearing: true }, { ...base, hearing: true })).toEqual([]);
    expect(momentsBetween(base, { ...base, escaped: 1 })).toEqual(["escape"]);
    expect(momentsBetween(base, { ...base, ending: "takeover", model: "Frontier-3" })).toEqual(["ending", "ship"]);
  });
  it("reads the signals off a real view-model", () => {
    const vm = hudViewModel(fixtureInput({ circus: "yacht-leak" }));
    const s = signalsOf(vm, { disasters: { leaked: [] }, escape: null });
    expect(s.leak).toBe(vm.event!.id);
    expect(momentsBetween({ ...s, leak: null }, s)).toEqual(["leak"]);
  });
});
