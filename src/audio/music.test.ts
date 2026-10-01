import { describe, expect, it } from "vitest";
import { FLAVOURS, MODES, barLength, barTones, conduct, flavourFor, type Flavour, meter, modeFor, plan, tapeStop, transition, type Cue, type Fade, type Mode, type Want } from "./music";
import { CHORDS, eraScore, midi } from "./score";

const ERA = "1";
const want = (mode: Mode): Want => ({ mode, flavour: "classic", era: ERA });
const perSecond = (mode: Mode, flavour: Flavour = "classic") => {
  const tones = Array.from({ length: 8 }, (_, bar) => barTones({ mode, flavour, era: ERA, bar }).length).reduce((a, b) => a + b, 0);
  return tones / (8 * barLength(meter(mode, ERA)));
};

/** Drive the conductor the way the game does: a pump every frame at 60 Hz, asking for `takes[i].mode` from `takes[i].at`. */
function perform(takes: { at: number; mode: Mode }[], seconds: number) {
  let c = conduct(want(takes[0]!.mode));
  const cues: Cue[] = []; const fades: Fade[] = [];
  for (let frame = 0; frame < seconds * 60; frame++) {
    const t = frame / 60;
    for (const k of takes) if (k.at <= t) c = { ...c, want: want(k.mode) };
    const p = plan(c, t, 0.2);
    c = p.conductor; cues.push(...p.cues); fades.push(...p.fades);
  }
  return { cues, fades };
}

describe("music follows the game speed (FLT-66)", () => {
  it("naps when time is held, walks at 1×, fetches at 3× and has the zoomies at the top speed", () => {
    expect(modeFor(0, true)).toBe("nap");
    expect(modeFor(3, true)).toBe("nap"); // a card or a menu holds time at any speed
    expect([0, 1, 3, 10].map((s) => modeFor(s, false))).toEqual(["nap", "walkies", "fetch", "zoomies"]);
  });

  it("walkies is the first pass's music, note for note", () => {
    const { root, bpm } = eraScore(ERA);
    const beat = 60 / bpm;
    for (let bar = 0; bar < 8; bar++) {
      const before: [number, number, number, string][] = [];
      for (let b = bar * 4; b < bar * 4 + 4; b++) {
        const chord = CHORDS[Math.floor(b / 4) % 4]!;
        if (b % 4 === 0) for (const n of chord) before.push([0, midi(root + n), beat * 3.8, "triangle"]);
        before.push([(b % 4) * beat, midi(root + chord[b % 3]! + 12), beat * 0.6, "square"]);
      }
      expect(barTones({ mode: "walkies", flavour: "classic", era: ERA, bar }).map((t) => [t.at, t.hz, t.duration, t.wave])).toEqual(before);
    }
  });

  it("gets busier and faster with each speed, within a voice budget", () => {
    const bpm = MODES.map((m) => meter(m, ERA).bpm);
    expect(bpm).toEqual([...bpm].sort((a, b) => a - b));
    expect(meter("zoomies", ERA).bpm).toBeGreaterThanOrEqual(160);
    const density = MODES.map((m) => perSecond(m));
    expect(density).toEqual([...density].sort((a, b) => a - b));
    // A voice is a handful of WebAudio nodes; the zoomies stay well under the 100 a second where a phone starts to sweat.
    for (const mode of MODES) for (const flavour of FLAVOURS) expect(perSecond(mode, flavour)).toBeLessThan(70);
  });

  it("every tone is finite, quiet enough and inside its bar", () => {
    for (const mode of MODES) for (const flavour of FLAVOURS) for (let bar = 0; bar < 8; bar++) {
      const length = barLength(meter(mode, ERA));
      for (const t of barTones({ mode, flavour, era: ERA, bar })) {
        expect(Number.isFinite(t.hz) && t.hz > 20 && t.hz < 20000).toBe(true);
        expect(t.gain).toBeGreaterThan(0); expect(t.gain).toBeLessThan(0.4);
        expect(t.duration).toBeGreaterThan(0.01);
        expect(t.at).toBeGreaterThanOrEqual(0); expect(t.at).toBeLessThan(length);
      }
    }
  });

  it("zoomies: a chipmunk choir, a kick on every beat, pumping chords and the inbox", () => {
    const bars = Array.from({ length: 8 }, (_, bar) => barTones({ mode: "zoomies", flavour: "classic", era: ERA, bar }));
    const beat = 60 / meter("zoomies", ERA).bpm;
    for (const tones of bars) {
      const sung = tones.filter((t) => t.vowel);
      expect(sung.length).toBeGreaterThan(4);
      expect(Math.min(...sung.map((t) => t.hz))).toBeGreaterThan(midi(eraScore(ERA).root + 12)); // pitched up
      expect(tones.filter((t) => t.wave === "sine" && t.endHz === 42).map((t) => t.at).slice(0, 3)).toEqual([0, beat, beat * 2]);
      expect(tones.filter((t) => (t.attack ?? 0) > beat / 2).length).toBeGreaterThanOrEqual(12); // the sidechain swell
    }
    // A notification ping in every other bar, high above the band.
    const pings = (tones: (typeof bars)[number]) => tones.filter((t) => t.wave === "sine" && t.hz > 1500);
    expect(bars.map((b) => pings(b).length > 0)).toEqual([false, true, false, true, false, true, false, true]);
    expect(pings(bars[7]!).length).toBeGreaterThan(pings(bars[1]!).length); // the eighth bar: the inbox overflows
  });

  it("skins keep their flavour: Frontier 95 plays zoomies on a General MIDI card", () => {
    expect(flavourFor("frontier-95")).toBe("midi");
    expect(flavourFor("base")).toBe("classic");
    expect(flavourFor("some-mod-skin")).toBe("classic");
    const midiBar = barTones({ mode: "zoomies", flavour: "midi", era: ERA, bar: 1 });
    expect(midiBar.every((t) => !t.detune)).toBe(true);
    expect(new Set(midiBar.filter((t) => t.wave !== "noise" && t.wave !== "sine" && t.wave !== "triangle").map((t) => t.wave))).toEqual(new Set(["square"]));
    expect(barTones({ mode: "zoomies", flavour: "classic", era: ERA, bar: 1 })).not.toEqual(midiBar);
  });
});

describe("switching speed waits for the next bar line (FLT-66)", () => {
  const walkBar = barLength(meter("walkies", ERA));

  it("a press mid-bar is heard as a riser at once and switches exactly on the next bar line, crossfaded", () => {
    const press = walkBar * 2.3;
    const line = walkBar * 3;
    const { cues, fades } = perform([{ at: 0, mode: "walkies" }, { at: press, mode: "zoomies" }], line + 4);
    const zoomies = cues.filter((c) => c.bus === "zoomies");
    expect(Math.min(...zoomies.map((c) => c.tone.at))).toBeCloseTo(line, 9);
    const t = transition("walkies", "zoomies", ERA);
    expect(fades).toContainEqual({ bus: "walkies", at: line, from: 1, to: 0, over: t.fadeOut });
    expect(fades).toContainEqual({ bus: "zoomies", at: line, from: 0, to: 1, over: t.fadeIn });
    // The walkies band plays on under its fade, then stops.
    const tail = cues.filter((c) => c.bus === "walkies" && c.tone.at >= line);
    expect(tail.length).toBeGreaterThan(0);
    expect(Math.max(...tail.map((c) => c.tone.at))).toBeLessThan(line + t.fadeOut);
    // The riser starts after the press, ends on the bar line, and the drop has a crash.
    const fx = cues.filter((c) => c.bus === "fx");
    const riser = fx.find((c) => c.tone.at < line)!;
    expect(riser.tone.at).toBeGreaterThanOrEqual(press);
    expect(riser.tone.at + riser.tone.duration).toBeCloseTo(line, 9);
    expect(fx.some((c) => c.tone.at === line)).toBe(true);
  });

  it("never cuts: every handover fades both ways over at least a tenth of a second, inside the new band's first bar", () => {
    for (const from of MODES) for (const to of MODES) if (from !== to) {
      const t = transition(from, to, ERA);
      expect(t.fadeIn).toBeGreaterThanOrEqual(0.1);
      expect(t.fadeOut).toBeGreaterThanOrEqual(0.1);
      expect(t.fadeOut).toBeLessThanOrEqual(barLength(meter(to, ERA)));
    }
  });

  it("changing your mind before the bar line changes nothing", () => {
    const { cues, fades } = perform([{ at: 0, mode: "walkies" }, { at: walkBar * 1.2, mode: "zoomies" }, { at: walkBar * 1.5, mode: "walkies" }], walkBar * 4);
    expect(cues.some((c) => c.bus === "zoomies")).toBe(false);
    expect(fades.filter((f) => f.at > 0)).toEqual([]);
  });

  it("pausing stops the tape: the last bar slows, drops in pitch and is gone before the nap's first bar ends", () => {
    const line = walkBar * 2;
    const { cues } = perform([{ at: 0, mode: "walkies" }, { at: walkBar * 1.5, mode: "nap" }], line + 6);
    const t = transition("walkies", "nap", ERA);
    expect(t.tape).toBe(true);
    const tail = cues.filter((c) => c.bus === "walkies" && c.tone.at >= line);
    const straight = barTones({ mode: "walkies", flavour: "classic", era: ERA, bar: 2 });
    expect(tail.length).toBeGreaterThan(0);
    for (const c of tail) {
      expect(c.tone.at).toBeLessThan(line + t.fadeOut);
      expect(straight.some((s) => c.tone.hz <= s.hz && c.tone.hz > s.hz * 0.2)).toBe(true);
    }
    expect(tail.at(-1)!.tone.hz).toBeLessThan(straight.at(-1)!.hz);
    expect(cues.some((c) => c.bus === "nap" && c.tone.at === line)).toBe(true);
  });

  it("the tape stop keeps a tone's order and slows it monotonically", () => {
    const tones = [0, 0.2, 0.4, 0.6, 0.8].map((at) => ({ at, hz: 440, duration: 0.1, gain: 0.1, wave: "sine" as const }));
    const out = tones.map((t) => tapeStop(t, 1.6)).filter((t) => t !== null);
    expect(out.map((t) => t.at)).toEqual([...out.map((t) => t.at)].sort((a, b) => a - b));
    expect(out.map((t) => t.hz)).toEqual([...out.map((t) => t.hz)].sort((a, b) => b - a));
    expect(tapeStop({ ...tones[0]!, at: 5 }, 1.6)).toBeNull();
  });

  it("is deterministic, and a stall or a mute restarts at once with no catch-up burst", () => {
    expect(perform([{ at: 0, mode: "fetch" }, { at: 3, mode: "zoomies" }], 8)).toEqual(perform([{ at: 0, mode: "fetch" }, { at: 3, mode: "zoomies" }], 8));
    let c = conduct(want("zoomies"));
    c = plan(c, 0, 0.2).conductor;
    const after = plan(c, 30, 0.2);
    expect(after.cues.every((cue) => cue.tone.at >= 30)).toBe(true);
    expect(after.conductor.lane!.bar).toBe(c.lane!.bar + 1);
  });
});
