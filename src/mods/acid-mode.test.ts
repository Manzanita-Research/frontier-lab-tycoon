// FLT-105: ACID MOD(E), played. Its offer, the three answers, the trip and the spells it leaves, the breakthrough and
// its headline, and the comedown. The look is presentation (ui/juice/trip.ts and its photosensitivity test).
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import acid from "../../mods/examples/acid-mode/mod.json";
import { momentSearch } from "../app/mods";
import { createSimHandle } from "../app/sim";
import { defs, withDefs } from "../sim/defs";
import { openEventOf } from "../sim/events";
import { enableBirdApp } from "../sim/birdapp/driver";
import type { Command } from "../sim/commands";
import { pacingCommands } from "../sim/pacing";
import { createInitialState } from "../sim/state";
import { answer } from "../sim/testkit";
import { tick, TICKS_PER_DAY } from "../sim/tick";
import { spelledResearcher } from "../sim/tripDemo";
import type { GameState } from "../sim/types";
import { resolveGameDefinition } from "./game-definition";
import { composeMods } from "./loader";
import { decodeManifest } from "./schema";

const definition = Effect.runPromise(Effect.flatMap(decodeManifest(acid), (m) => resolveGameDefinition(composeMods([m]).layer)));

interface Played {
  s: GameState;
  offeredDay: number | null;
  tripSeen: GameState["trip"] | null;
  spelled: number;
  jump: number;
}

/**
 * Play a modded lab for `days` the way `flt-mod check` does (no ladder, a connected campus: cards open from day 40),
 * answering the offer with `pick` and every other card with its first choice.
 */
async function play(pick: number, days = 75): Promise<Played> {
  const def = await definition;
  return withDefs(def, () => {
    const s = createInitialState(42, "garage", def);
    delete s.progression;
    delete s.coach;
    enableBirdApp(s);
    const setup: Command[] = [...pacingCommands(s),
      { type: "placeBuilding", kind: "hall", x: 12, z: 11 },
      { type: "placeBuilding", kind: "gateway", x: 7, z: 17 },
      { type: "hire", job: "sre" }];
    const out: Played = { s, offeredDay: null, tripSeen: null, spelled: 0, jump: 1 };
    for (let i = 0; i < days * TICKS_PER_DAY; i++) {
      const arcBefore = s.modArcs?.["acid-mode"]?.value;
      const cap = s.capability;
      const cmds = answer(s, (id) => (id === "acid-offer" ? pick : 0));
      tick(s, i === 0 ? [...setup, ...cmds] : cmds);
      if (out.offeredDay === null && s.arcs["acid-offer"]?.value === "cardOpen") out.offeredDay = s.day;
      if (s.trip) out.tripSeen ??= structuredClone(s.trip);
      out.spelled = Math.max(out.spelled, s.walkers.filter((w) => w.spell).length);
      if (arcBefore === "tripping" && s.modArcs?.["acid-mode"]?.value === "breakthrough") out.jump = s.capability / Math.max(1, cap);
    }
    return out;
  });
}

const said = (s: GameState, re: RegExp) => s.news.some((n) => re.test(n.text));

describe("ACID MOD(E)", () => {
  it("offers 'a medium dose of acid' from Vibe Encampment, and never on its own", async () => {
    const def = await definition;
    withDefs(def, () => {
      const card = defs().eventById("acid-offer")!;
      expect(card.body).toContain("medium dose of acid");
      expect(card.body).toContain("Vibe Encampment");
      expect(card.choices.map((c) => c.label)).toEqual(["Take the medium dose", "Microdose the roadmap instead", "Absolutely not. Touch grass."]);
      // The phrase, and no other way of putting it.
      expect(JSON.stringify(acid)).not.toMatch(/\b(LSD|tabs?|blotter|tripping balls)\b/i);
    });
  });

  it("yes: the screen goes somewhere for days, researchers go somewhere, the model achieves enlightenment, and it all comes back", async () => {
    const p = await play(0);
    expect(p.offeredDay).toBeGreaterThanOrEqual(40);
    expect(p.tripSeen).toMatchObject({ owner: "acid-mode", label: "A medium dose of acid" });
    expect(p.tripSeen!.end - p.tripSeen!.start).toBe(5 * TICKS_PER_DAY);
    expect(p.tripSeen!.lines.length).toBeGreaterThan(3);
    expect(p.spelled).toBeGreaterThan(0);
    expect(p.jump).toBeGreaterThan(1.2);
    expect(said(p.s, /model achieved enlightenment/)).toBe(true);
    expect(said(p.s, /medium dose of acid/)).toBe(true);
    expect(said(p.s, /Senate subcommittee/)).toBe(true);
    // Worn off, everyone back (or gone), the story over.
    expect(p.s.trip).toBeUndefined();
    expect(p.s.walkers.some((w) => w.spell)).toBe(false);
    expect(p.s.modArcs!["acid-mode"]!.value).toBe("done");
  });

  it("microdosing the roadmap or saying no: no trip, nobody goes anywhere", async () => {
    for (const [pick, re] of [[1, /microdoses its roadmap/], [2, /declines a medium dose of acid/]] as const) {
      const p = await play(pick, 70);
      expect(p.offeredDay, `offered on day ${p.offeredDay}`).not.toBeNull();
      expect(p.tripSeen).toBeNull();
      expect(p.spelled).toBe(0);
      expect(said(p.s, re), `${pick}: ${p.s.modArcs!["acid-mode"]!.value}`).toBe(true);
      expect(p.s.modArcs!["acid-mode"]!.value).toBe("done");
    }
  });

  it("is the same lab twice", async () => {
    const a = await play(0, 50);
    const b = await play(0, 50);
    expect(JSON.stringify(a.s)).toBe(JSON.stringify(b.s));
  });

  describe("its ?moment= links land on their beat", () => {
    const handle = async (moment: string) => createSimHandle({ seed: 3, warp: 12, agents: 0, discourse: 0, researchers: 0, moment }, await definition);
    const staged = async (moment: string) => (await handle(moment)).world;
    // The ticker opens on the beat's own news (SimHandle.report filters from newsStartId).
    const ticker = async (moment: string) => {
      const h = await handle(moment);
      return h.world.news.filter((n) => n.id >= h.newsStartId).map((n) => n.text);
    };

    it("bring the mod along unless the address names its own", () => {
      expect(new URLSearchParams(momentSearch("?moment=acid-peak&seed=3")).getAll("mod")).toEqual(["/mods/examples/acid-mode/mod.json"]);
      expect(momentSearch("?moment=acid-peak&mod=/x.json")).toBe("?moment=acid-peak&mod=/x.json");
      expect(momentSearch("?moment=queue")).toBe("?moment=queue");
      expect(momentSearch("")).toBe("");
    });

    it("acid-offer: the proposal is on screen", async () => {
      const w = await staged("acid-offer");
      expect(openEventOf(w)?.id).toBe("acid-offer");
      expect(w.trip).toBeUndefined();
    });

    it("acid-peak and acid-researcher: a trip at full strength, and somebody somewhere", async () => {
      for (const moment of ["acid-peak", "acid-researcher"]) {
        const w = await staged(moment);
        expect(w.modArcs!["acid-mode"]!.value).toBe("tripping");
        expect(w.tick - w.trip!.start).toBeGreaterThanOrEqual(w.trip!.rise);
        expect(w.tick).toBeLessThan(w.trip!.end);
        expect(spelledResearcher(w)?.spell?.line).toBeTruthy();
      }
    });

    it("acid-breakthrough: the model achieved enlightenment, mid-trip", async () => {
      const w = await staged("acid-breakthrough");
      expect(w.modArcs!["acid-mode"]!.value).toBe("breakthrough");
      expect(w.trip).toBeDefined();
      expect(w.news.some((n) => n.text.includes("model achieved enlightenment"))).toBe(true);
    });

    it("open the ticker on the beat's headline", async () => {
      expect((await ticker("acid-peak")).some((t) => t.includes("'a medium dose of acid'"))).toBe(true);
      const b = await ticker("acid-breakthrough");
      expect(b.some((t) => t.includes("model achieved enlightenment"))).toBe(true);
      expect(b.some((t) => t.includes("'a medium dose of acid'"))).toBe(false);
    });
  });
});
