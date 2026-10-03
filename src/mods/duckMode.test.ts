// FLT-102: the duck mode example. Its JSON is what its mod.ts says, it composes, it can join a running lab, and its
// voice turns the game's own lines into duck while the numbers stay put.
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import source, { DUCK } from "../../mods/examples/duck-mode/mod";
import bundled from "../../mods/examples/duck-mode/mod.json";
import readme from "../../mods/examples/duck-mode/README.md?raw";
import { needsRestart, NO_MODS, withMod, withoutModId } from "../app/mods";
import { HEADLINES } from "../content/headlines";
import { composeMods } from "./loader";
import { resolvePresentation } from "./presentation";
import { decodeManifest, VOICE_MOMENTS } from "./schema";
import { makeVoice } from "./voice";

const decode = (m: unknown) => Effect.runPromise(decodeManifest(m));

describe("duck mode", () => {
  it("ships the JSON its mod.ts makes (re-bundle after editing mod.ts)", () => {
    expect(bundled).toEqual(JSON.parse(JSON.stringify(source)));
  });

  it("keeps its name in one constant (name.ts)", () => {
    expect(source.name).toBe(DUCK.name);
    expect(source.voice?.name).toBe(DUCK.voice);
    // Nowhere else: rename the constant and the whole mod follows.
    const rest = JSON.stringify({ ...source, name: "", voice: { ...source.voice, name: "" } }).toLowerCase();
    expect(rest).not.toContain(DUCK.voice.toLowerCase());
  });

  it("dresses everyone: every walker kind, the staff and the auditors", async () => {
    const { looks, voice } = await Effect.runPromise(resolvePresentation(composeMods([await decode(bundled)]).layer));
    for (const target of ["researcher", "agent", "visitor", "protester", "staff:sre", "staff:security", "staff:comms", "staff:janitor", "group:auditor"]) expect(looks[target]?.recipe).toBeDefined();
    expect(voice?.mod).toBe("duck-mode");
  });

  it("has its own line for every big moment, each one already in voice", () => {
    const say = makeVoice(source.voice!);
    for (const moment of VOICE_MOMENTS) {
      const lines = source.voice!.moments![moment]!;
      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) expect(say(line)).toBe(line);
    }
  });

  it("can be added to a running lab, and taken out again", async () => {
    const manifest = await decode(bundled);
    expect(needsRestart(manifest)).toBeNull();
    const added = await withMod(NO_MODS, { manifest, source: "/mods/examples/duck-mode/mod.json" });
    expect(added.presentation?.voice?.glyph).toBe("🦆");
    expect(added.presentation?.looks.protester?.signs?.length).toBeGreaterThan(0);
    const removed = await withoutModId(added, manifest.id);
    expect(removed.presentation?.voice ?? null).toBeNull();
    expect(removed.presentation?.looks ?? {}).toEqual({});
  });

  it("says what its README's before-and-after tables say it says", () => {
    const [flavour, menus] = readme.split("Full duck, on the menus");
    const rows = (md: string) => [...md.matchAll(/^\| (.+?) \| (.+?) \|$/gm)].map(([, a, b]) => [a!, b!]).filter(([a]) => a !== "Before" && a !== "---").map((r) => r.map((c) => c.replace(/\\\|/g, "|")));
    const say = makeVoice(source.voice!);
    const quiet = makeVoice({ ...source.voice!, emoji: undefined, openers: undefined, ellipsis: 0 });
    expect(rows(flavour!).length).toBeGreaterThan(10);
    for (const [before, after] of rows(flavour!)) expect(say(before!)).toBe(after);
    for (const [before, after] of rows(menus!)) expect(quiet(before!)).toBe(after);
  });

  it("turns the game's headlines into duck and keeps every number", () => {
    const say = makeVoice(source.voice!);
    for (const { text } of HEADLINES) {
      const out = say(text);
      expect(out).not.toBe(text);
      for (const n of text.match(/\$?\d[\d.,]*[KMB%]?/g) ?? []) expect(out).toContain(n);
    }
  });
});
