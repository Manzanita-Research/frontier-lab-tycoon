import { getReach, isReachable, tileIndex, buildingAt, isPathTile, rectContains } from "../pathfind";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { eraOfState } from "../race/race";
import { tick } from "../tick";
import { SimHandle } from "../../app/sim";
import { createMidgameScenario, MIDGAME_SEED, midgameOpeningNews, midgameOpeningThoughts, walkerOnCampus } from "./midgame";

// FNV-1a, the same deliberately simple hash used by sim/golden.test.ts, over the entire persisted World.
function digest(s: unknown): string {
  const json = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) h = Math.imul(h ^ json.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

describe("midgame scenario", () => {
  const s = createMidgameScenario();
  it("replays ordinary commands and ticks to the same whole-world golden", () => {
    const again = createMidgameScenario();
    expect(again).toEqual(s);
    // FLT-49 preserves the full starter-campus preset, completes its ladder, and replays
    // paid confirmations. Changed movement/attendance draws shift the real opening day.
    // FLT-33/25: the water escalation now runs as a base arc during the replay, and the factions arrive, settled, at
    // the opening moment.
    expect(digest(s)).toBe("f3bc23b6");
  });
  it("opens near Y2 Mar with a connected busy campus, training and a fresh rival record", () => {
    expect(s.seed).toBe(MIDGAME_SEED);
    expect(s.day).toBeGreaterThanOrEqual(420);
    expect(s.day).toBeLessThanOrEqual(480);
    expect(s.buildings.length).toBeGreaterThanOrEqual(14);
    expect(s.buildings.length).toBeLessThanOrEqual(20);
    // Operations staff are rendered walkers too; count both populations, rather than inventing agent bonuses.
    expect(s.walkers.length + s.staff.length).toBeGreaterThanOrEqual(150);
    // The water crowd at its cap; FLT-25's counter-protest may have brought the Water Truthers Truthers too.
    expect(s.walkers.filter((w) => w.kind === "protester" && w.crowd === undefined).length).toBe(40);
    expect(eraOfState(s)).toBe(2);
    const ready = s.training.context.progress / s.training.context.cost;
    expect(ready).toBeGreaterThanOrEqual(0.6);
    expect(ready).toBeLessThanOrEqual(0.8);
    expect(s.leapfrog.enabled).toBe(true);
    expect(s.leapfrog.last?.day).toBe(s.day);
    expect(s.leapfrog.last?.lab).not.toBe("you");
    expect(s.leapfrog.last?.claims.length).toBeGreaterThan(0);
    expect(openEventOf(s)).toBeNull();
    expect(outcomeOf(s)).toBe("playing");
    const reach = getReach(s);
    expect(s.buildings.every((b) => isReachable(s, b) && !b.broken)).toBe(true);
    expect(s.grid.paths.every((on, i) => !on || !!reach.tiles[i])).toBe(true);
  });
  it("puts every walker on a path or in a building, including the gate; resumes with real movement", () => {
    expect(walkerOnCampus(s)).toBe(true);
    for (const w of [...s.walkers, ...s.staff]) {
      const x = Math.floor(w.x), z = Math.floor(w.z);
      expect(isPathTile(s, x, z) || !!buildingAt(s, w.x, w.z) || rectContains(s.gate, w.x, w.z)).toBe(true);
      if (isPathTile(s, x, z)) expect(getReach(s).tiles[tileIndex(s, x, z)]).toBe(1);
    }
    const resumed = JSON.parse(JSON.stringify(s));
    tick(resumed);
    expect(resumed.tick).toBe(s.tick + 1);
    const moving = resumed.walkers.filter((w: { id: number; x: number; z: number }) => {
      const old = s.walkers.find((o) => o.id === w.id);
      return old && (old.x !== w.x || old.z !== w.z);
    }).length;
    expect(moving).toBeGreaterThan(30);
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.MIDGAME_REPORT) {
      console.log(JSON.stringify({ seed: s.seed, day: s.day, tick: s.tick, buildings: s.buildings.length,
        paths: s.grid.paths.filter(Boolean).length, campusWalkers: s.walkers.length, staff: s.staff.length,
        protesters: s.walkers.filter((w) => w.kind === "protester").length, movingOnNextTick: moving,
        ready: s.training.context.progress / s.training.context.cost, era: eraOfState(s), cash: s.cash,
        latestDrop: s.leapfrog.last, digest: digest(s) }));
    }
  });
  it("opens with the curated existing bubbles and the SOTA joke without changing the World", () => {
    const before = digest(s);
    const thoughts = midgameOpeningThoughts(s);
    expect(thoughts.map((t) => t.text)).toEqual([
      "The loss went down. I refuse to touch anything.",
      "I calculated my water usage. I'd rather not say.",
      "Someone hand me a water. Not from them.",
    ]);
    for (const t of thoughts) {
      expect(t.expiresTick).toBeGreaterThan(s.tick);
      expect(s.walkers.some((w) => w.id === t.walkerId && w.machine.value !== "inside")).toBe(true);
    }
    const news = midgameOpeningNews(s);
    expect(news[0]?.text).toMatch(/has a new champion|SOTA|state-of-the-art|posts a new best|tops .*says|leaderboard:/);
    expect(news[0]?.day).toBe(s.day);
    expect(digest(s)).toBe(before);
    // Delayed HUD mounts and repeated paused publishes must still start with the chosen headline.
    const handle = new SimHandle(JSON.parse(JSON.stringify(s)), true);
    handle.newsStartId = news[0]!.id;
    handle.openingThoughts = { tick: s.tick, thoughts };
    expect(handle.report(true, true)?.news).toEqual(news);
    const paused = handle.report(true);
    expect(paused?.news).toEqual(news);
    expect(paused?.snap?.thoughts).toEqual(thoughts);
    expect(handle.world.thoughts).toEqual(s.thoughts);
    handle.step(1, []);
    expect(handle.report(true)?.snap?.thoughts).toEqual(handle.world.thoughts);
    handle.reset(MIDGAME_SEED);
    expect(handle.newsStartId).toBe(0);
    expect(handle.openingThoughts).toBeUndefined();
    expect(handle.report(true, true)?.news?.[0]?.day).toBe(0);
  });
});
