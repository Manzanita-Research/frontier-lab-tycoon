// FLT-83: `?moment=queue` crashed the game on main, and nothing noticed, because a staging link is only ever opened by
// hand or by the screenshot script. These load every `?moment=` the code knows the way the game does on boot (stage the
// World, publish the first snapshot, build the HUD from it) and then play two days, answering any card that opens.
import { beforeAll, describe, expect, it } from "vitest";
import shots from "../../scripts/shots.scenes.json";
import { defs } from "../sim/defs";
import { TICKS_PER_DAY } from "../sim/tick";
import { openEventOf } from "../sim/events";
import { outcomeOf } from "../sim/goals";
import { tick } from "../sim/tick";
import { answer } from "../sim/testkit";
import { fixtureInput } from "../ui/hud/fixtures";
import { hudViewModel } from "../ui/hud/vm";
import { isArcMoment, parseArcMoment } from "../sim/arcDemo";
import { createSimHandle, STAGED_MOMENTS } from "./sim";
import { createMidgameScenario } from "../sim/scenarios/midgame";

// FLT-111: the endings' and money's scenes start from the mid-game campus, 480 days played once per file and copied.
// Play them here, under a hook's own timeout, so the first such scene is no slower than the rest on a slow CI runner.
beforeAll(() => void createMidgameScenario(), 30_000);

const withArgs = () => [...STAGED_MOMENTS, ...defs().mishaps.map((m) => `stream:${m.id}`), ...defs().rivals.map((r) => `poach-offer:${r.id}`)];

function load(moment: string) {
  const handle = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment });
  const first = handle.report(true, true);
  expect(first?.snap).toBeDefined();
  hudViewModel({ ...fixtureInput(), snap: first!.snap! });
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) handle.step(1, answer(handle.world));
  const later = handle.report(true, true);
  hudViewModel({ ...fixtureInput(), snap: later!.snap! });
  return handle.world;
}

describe("every ?moment= staging link loads", () => {
  it.each(withArgs())("%s", (moment) => {
    expect(() => load(moment)).not.toThrow();
  });

  it("the queue moment has its line at the Kombucha Bar", () => {
    const w = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment: "queue" }).world;
    const bar = w.buildings.find((b) => b.kind === "kombucha");
    expect(bar).toBeDefined();
    const queuing = w.walkers.filter((x) => x.targetId === bar!.id && x.machine.value === "queuing").length;
    expect(queuing).toBeGreaterThanOrEqual(4);
  });

  describe("FLT-86's money links land on their beat", () => {
    const staged = (moment: string) => createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment }).world;
    it("money-round1: the first round's card, with no rounds signed", () => {
      const w = staged("money-round1");
      expect(openEventOf(w)?.id).toBe("bridge1");
      expect(w.economy.context).toMatchObject({ rounds: 0, stake: 100 });
    });
    it("money-lastround: the third and last round's card", () => {
      const w = staged("money-lastround");
      expect(openEventOf(w)?.id).toBe("bridge3");
      expect(w.economy.context.rounds).toBe(2);
    });
    it("money-overdraft: the bank's card, and its 30 days counting", () => {
      const w = staged("money-overdraft");
      expect(openEventOf(w)?.id).toBe("overdraft");
      expect(w.economy.value).toBe("overdrawn");
      expect(w.economy.context.overdraftDay).toBe(w.day + 30);
    });
    it("money-bankrupt: the game is over", () => {
      const w = staged("money-bankrupt");
      expect(w.economy.value).toBe("bankrupt");
      expect(outcomeOf(w)).not.toBe("playing");
    });
    it("money-stretch: two of three met tonight, and the Final stretch beat left to replay", () => {
      const w = staged("money-stretch");
      expect(w.goals.context.goals.filter((g) => g.met).map((g) => g.id).sort()).toEqual(["era", "release"]);
      expect(w.disasters.cues.some((c) => c.type === "beat" && c.beat === "stretch")).toBe(true);
    });
    it("money-win: still playing on load with a toast up, and won at the next midnight", () => {
      const w = staged("money-win");
      expect(outcomeOf(w)).toBe("playing");
      expect(w.toasts.some((t) => t.importance === "you")).toBe(true);
      const day = w.day;
      while (w.day === day) tick(w);
      expect(outcomeOf(w)).toBe("won");
    });
  });

  it("every moment a screenshot scene uses is one the game knows", () => {
    const used = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) k === "moment" && typeof x === "string" ? used.add(x) : walk(x);
    };
    walk(shots);
    const known = new Set(withArgs());
    expect([...used].filter((m) => !known.has(m) && !isArcMoment(m))).toEqual([]);
  });

  it("every `arc:<arc>:<state>` a scene stages is a state of an arc in the mod that scene loads (FLT-101)", () => {
    const mods = import.meta.glob<{ content?: { arcs?: { add?: { id: string; states: object }[] } } }>("../../mods/examples/*/mod.json", { import: "default", eager: true });
    const wrong = Object.entries(shots.scenes).flatMap(([name, scene]) => {
      const q = (scene as { query?: { moment?: unknown; mod?: unknown } }).query ?? {};
      if (typeof q.moment !== "string" || !isArcMoment(q.moment)) return [];
      const { arc, state } = parseArcMoment(q.moment);
      const arcs = [q.mod].flat().flatMap((url) => mods[`../..${url}`]?.content?.arcs?.add ?? []);
      return arcs.some((a) => a.id === arc && state in a.states) ? [] : [`${name}: ${q.moment} (mod ${String(q.mod)})`];
    });
    expect(wrong).toEqual([]);
  });
});
