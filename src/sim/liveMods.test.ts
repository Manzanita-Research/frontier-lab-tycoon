// FLT-78: a data-only mod added to a running lab, and taken out again. The definition swaps on the command's tick, the
// World says so (`modsAdded`), its card turns up within a few days, and a replay with `addMod` at tick T is the same lab.
import { Effect } from "effect";
import { composeMods } from "../mods/loader";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { decodeManifest, type ModManifest } from "../mods/schema";
import { contentHash } from "../mods/hash";
import drama from "../../mods/drama/2026-09-30/mod.json";
import { decodeSave, encodeSave } from "../save/codec";
import { defs, withDefs } from "./defs";
import { openEventOf } from "./events";
import { ARRIVE_DAYS, type LiveModNews } from "./liveMods";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { tick, TICKS_PER_DAY } from "./tick";
import type { Command } from "./commands";
import type { GameState, RunMods } from "./types";

const CARD = "drama-2026-09-30-risk-factors";
const NEWS: LiveModNews = {
  toast: "📼 Today's Drama added",
  flash: '📼 Just in: today\'s Drama, "Risk Factors Are Bullish". Arriving in your lab now.',
  headline: { text: drama.content.headlines.add[0]!.text, tone: "joke" },
};

let manifest: ModManifest;
let def: GameDefinition;
let run: RunMods;
beforeAll(async () => {
  manifest = await Effect.runPromise(decodeManifest(drama));
  def = await Effect.runPromise(resolveGameDefinition(composeMods([manifest]).layer));
  run = { mods: [{ id: manifest.id, version: manifest.version, hash: contentHash(manifest) }], contentHash: contentHash(def.content) };
});

const add = (): Command => ({ type: "addMod", mod: { id: manifest.id, name: manifest.name, version: manifest.version, hash: contentHash(manifest), url: "/mods/drama/2026-09-30/mod.json", cards: [CARD] }, run, news: NEWS });
const remove = (): Command => ({ type: "removeMod", id: manifest.id, cards: [CARD], run: null });

/** Play `days` game days on `d`, answering every card with its first choice; `seen` hears each card that opens. */
function play(s: GameState, days: number, d: GameDefinition | null, seen: (id: string, day: number) => void = () => undefined) {
  const until = s.day + days;
  for (let i = 0; i < days * TICKS_PER_DAY * 4 && s.day < until; i++) {
    const open = openEventOf(s);
    if (open) seen(open.id, s.day);
    tick(s, withDefs(d, () => answer(s)), d);
  }
}

/** A fresh garage, five days in: the lab on screen when the player taps "Add to my lab". */
function fiveDaysIn(seed = 7): GameState {
  const s = createInitialState(seed);
  play(s, 5, null);
  return s;
}

describe("adding a mod to a running lab (FLT-78)", () => {
  it("records it, says so, and changes nothing else about the lab", () => {
    const s = fiveDaysIn();
    const { day, cash, tick: t } = s;
    tick(s, [add()], def);
    expect(s.modsAdded).toEqual([{ id: manifest.id, version: manifest.version, hash: contentHash(manifest), url: "/mods/drama/2026-09-30/mod.json", tick: t, day, cards: [CARD] }]);
    expect(s.mods).toEqual(run);
    expect(s.day).toBe(day);
    expect(Math.abs(s.cash - cash)).toBeLessThan(1000); // one tick of ordinary business, no reset
    const texts = s.news.map((n) => n.text);
    expect(texts).toContain(NEWS.flash);
    expect(texts).toContain(NEWS.headline!.text);
    expect(s.toasts.some((x) => x.text === NEWS.toast)).toBe(true);
    // Adding it twice is adding it once.
    tick(s, [add()], def);
    expect(s.modsAdded).toHaveLength(1);
  });

  it("its headlines, thoughts and rival tagline are in the lab's definition from that tick", () => {
    withDefs(def, () => {
      expect(defs().headlines.some((h) => h.text === NEWS.headline!.text)).toBe(true);
      expect(defs().thoughts.some((t) => t.text === drama.content.thoughts.add[0]!.text)).toBe(true);
      expect(defs().rivalById.anthro.tagline).toBe("Deeply worried. Priced accordingly.");
      expect(defs().eventById(CARD)).toBeDefined();
    });
    withDefs(null, () => expect(defs().rivalById.anthro.tagline).not.toBe("Deeply worried. Priced accordingly."));
  });

  it(`its card turns up within ${ARRIVE_DAYS + 6} days, whatever its own "day 30" says, in a lab on day 5`, () => {
    for (const seed of [7, 11, 42]) {
      const s = fiveDaysIn(seed);
      tick(s, [add()], def);
      const added = s.day;
      let arrived: number | null = null;
      play(s, ARRIVE_DAYS + 6, def, (id, day) => { if (id === CARD) arrived ??= day; });
      expect(arrived, `seed ${seed}`).not.toBeNull();
      expect(arrived! - added).toBeGreaterThanOrEqual(ARRIVE_DAYS);
      expect(arrived! - added).toBeLessThanOrEqual(ARRIVE_DAYS + 6);
    }
  });

  it("a replay with addMod at tick T is the same lab, byte for byte", () => {
    const once = () => {
      const s = fiveDaysIn(42);
      tick(s, [add()], def);
      play(s, 20, def);
      return JSON.stringify(s);
    };
    expect(once()).toBe(once());
  });

  it("a lab with nothing added plays exactly as before", () => {
    const a = fiveDaysIn(42);
    const b = fiveDaysIn(42);
    play(a, 20, null);
    play(b, 20, null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.modsAdded).toBeUndefined();
  });
});

describe("taking it out again (FLT-78)", () => {
  it("cancels an unfired card: it never opens", () => {
    const s = fiveDaysIn();
    tick(s, [add()], def);
    play(s, 1, def);
    tick(s, [remove()], null);
    expect(s.modsAdded).toBeUndefined();
    expect(s.mods).toBeUndefined();
    const seen: string[] = [];
    play(s, 20, null, (id) => seen.push(id));
    expect(seen).not.toContain(CARD);
    expect(s.arcs[CARD]).toBeUndefined();
  });

  it("closes the card if it is open, unanswered", () => {
    const s = fiveDaysIn();
    tick(s, [add()], def);
    for (let i = 0; i < 20 * TICKS_PER_DAY && openEventOf(s)?.id !== CARD; i++) tick(s, withDefs(def, () => (openEventOf(s) ? answer(s) : [])), def);
    expect(openEventOf(s)?.id).toBe(CARD);
    tick(s, [remove()], null);
    expect(openEventOf(s)).toBeNull();
    play(s, 3, null); // and the lab plays on without it
  });
});

describe("a save of a lab with a mod added (FLT-78)", () => {
  it("keeps modsAdded in the World and the tick on the save's mod", async () => {
    const s = fiveDaysIn();
    tick(s, [add()], def);
    play(s, 1, def);
    const mods = [{ id: manifest.id, version: manifest.version, hash: contentHash(manifest), source: "/mods/drama/2026-09-30/mod.json", tick: s.modsAdded![0]!.tick }];
    const text = await Effect.runPromise(encodeSave(s, { skin: "frontier-95", savedAt: new Date("2026-10-01T12:00:00Z"), mods }));
    const { save, world } = await Effect.runPromise(decodeSave(text));
    expect(save.mods).toEqual(mods);
    expect(world.modsAdded).toEqual(s.modsAdded);
    expect(JSON.stringify(world)).toBe(JSON.stringify(s));
    // The loaded lab plays on exactly as the saved one does.
    play(world, 10, def);
    play(s, 10, def);
    expect(JSON.stringify(world)).toBe(JSON.stringify(s));
  });
});
