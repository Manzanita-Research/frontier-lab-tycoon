import { getReach, isReachable, tileIndex, isPathTile } from "../pathfind";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { progressOf } from "../progression";
import { eraOfState } from "../race/race";
import { tick } from "../tick";
import { SimHandle } from "../../app/sim";
import { createMidgameScenario, MIDGAME_SEED, midgameOpeningNews, midgameOpeningThoughts, walkerOnCampus, walkerPlaced } from "./midgame";

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
    // FLT-37: the campus it starts from wakes every earned pack, so Papers and Collusion now run in its 480 days too.
    // FLT-52: and the Hearing, the yacht summit, Defection, the Poaching War, Evals Without Borders, Regulatory Capture
    // and the Promise Tracker.
    // FLT-33/25: the earned factions wake with the campus and argue all 480 days; the water crowd escalates through its arc.
    // FLT-11 adds The Memo's dormant arc (arcs.memo); take it out and the World hashes to the old c4310492.
    // FLT-51 tags every toast (source, importance, reply); the first digest strips the tags (on the train it matched FLT-52).
    // FLT-56: the auditors huddle before they leave and the grade lingers, which moves the opening a few days, and the
    // Hearing's twelve new questions change what the senators ask. Phase 2: the motions' passes and fails nudge the
    // factions and last longer.
    // Rename (#71): Very Safe SI is Super Super AI (id supersuper) and MetaMeta's full name changed; names and ids are in the World.
    // FLT-54: the card budget spaces the cards (and the World keeps its pacer), so the whole run moves; the unread badges tag
    // the Arena, Papers and Discourse headlines with their panel (NewsItem.panel); the quit, poach and record toasts carry
    // their group (Toast.group), and a quit picks its line from QUIT_LINES. Merge train 2: the Promise Tracker's cards ask
    // the card budget too.
    // FLT-69: the campus wakes the Bird App too, and its 480 days of posts, Aura and Comms move the run. These were
    // 7f58d622 / 948ca520 before; with the Bird App asleep (`flags.birdappOff`) the World hashes to them again.
    // FLT-59: and the Sandbox Escape. Nobody guards this fence. These were 788c7bf1 / 303320ca; with the Scrutiny row put
    // back as it was (no Sandbox, Honeypot or escape) the World hashes to them again.
    // A card due mid-chase now waits for the chase to end (FLT-59: the run is never paused); 57d87789 / 9eb5bf9e before.
    // FLT-76 adds two dormant arcs: the Logo's (arcs.theLogo, a Level 1 card this campus is past) and the offsite's
    // (arcs.offsite, which counts from flags.scrutinyDay, and this preset never sets it). Those two entries are the whole
    // difference from 34526cc6 / 2660ed8e.
    // FLT-86: the economy keeps its rounds, stake and overdraft day, the goals their hold, and the four money cards arm
    // their arcs. With those projected out (and the toasts), the run hashes as 0dbef5e6 / 4592192e did, day for day,
    // through day 54. On day 55 the campus dips below $0 and its script signs round 1 for 10% of the lab where it used to
    // get the free bailout, so revenue is 90% of what it was from then on. The opening also waits for nobody to be out
    // of the Sandbox (FLT-59): with the run moved, an agent was over the fence at the old opening tick, 3 ticks earlier.
    // FLT-92: the rival labs post on the Bird App for all 480 days (their posts, ticker lines, dunks and ratios). With the
    // rivals off the World hashes to 6b07586a / 931e5673 again.
    // FLT-106: every engine-dependent Math call (sin, cos, atan2, tanh, pow, hypot, `**`) goes through src/sim/dmath.ts,
    // so the World is the same on every JS engine; the facings, the faction stances and the walks all move by an ulp or
    // so and the run follows. 4d6d37dc / 067dd01c before.
    // FLT-109: the curated 480 days play with the late lunch asleep (FLT-86 tuned its money moments on them), and it wakes
    // at the opening: the World adds `slopbowl` and the card's dormant arc (arcs.slopbowl). Take those two out and it
    // hashes to 2dfae51e / e9b78396, as before.
    expect({
      untagged: digest({ ...s, toasts: s.toasts.map((t) => ({ id: t.id, text: t.text, tone: t.tone })) }),
      full: digest(s),
    }).toEqual({ untagged: "2ab01817", full: "a878964f" });
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
    expect(ready).toBeLessThanOrEqual(0.9);
    expect(s.leapfrog.enabled).toBe(true);
    expect(s.leapfrog.last?.day).toBe(s.day);
    expect(s.leapfrog.last?.lab).not.toBe("you");
    expect(s.leapfrog.last?.claims.length).toBeGreaterThan(0);
    expect(openEventOf(s)).toBeNull();
    expect(outcomeOf(s)).toBe("playing");
    // The ladder is done (three models shipped), so the goal note names the next open objective, not a met rung (FLT-48).
    expect(progressOf(s).goal).toMatchObject({ text: "Reach Era 3: Superhuman Coder", current: 2, target: 3 });
    const reach = getReach(s);
    expect(s.buildings.every((b) => isReachable(s, b) && !b.broken)).toBe(true);
    expect(s.grid.paths.every((on, i) => !on || !!reach.tiles[i])).toBe(true);
  });
  it("puts every walker on a path or in a building, including the gate; resumes with real movement", () => {
    expect(walkerOnCampus(s)).toBe(true);
    for (const w of [...s.walkers, ...s.staff]) {
      const x = Math.floor(w.x), z = Math.floor(w.z);
      expect(walkerPlaced(s, w)).toBe(true);
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
  it("opens with the curated existing bubbles and a whole, short headline ahead of the SOTA joke, without changing the World", () => {
    const before = digest(s);
    const thoughts = midgameOpeningThoughts(s);
    expect(thoughts.map((t) => t.text)).toEqual([
      "They chant in perfect 4/4. Our uptime isn't even that stable.",
      "I calculated my water usage. I'd rather not say.",
      "Someone hand me a water. Not from them.",
    ]);
    for (const t of thoughts) {
      expect(t.expiresTick).toBeGreaterThan(s.tick);
      expect(s.walkers.some((w) => w.id === t.walkerId && w.machine.value !== "inside")).toBe(true);
    }
    const news = midgameOpeningNews(s);
    // FLT-48 hero: the tape opens on a line that fits the ticker whole; the fresh SOTA claim follows it that week.
    // FLT-52: with the wave packs running, this World's SOTA week has no valuation line, so the tape opens on the SOTA claim.
    const valuation = s.news.some((n) => n.day >= s.day - 7 && /valuation rises \d+% on news that it exists/.test(n.text));
    expect(news[0]?.text).toMatch(valuation ? /valuation rises \d+% on news that it exists/ : /has a new champion|SOTA|state-of-the-art|posts a new best|tops .*says|leaderboard:/);
    expect(news[0]?.day).toBeGreaterThanOrEqual(s.day - 7);
    expect(news.some((n) => n.day === s.day && /has a new champion|SOTA|state-of-the-art|posts a new best|tops .*says|leaderboard:/.test(n.text))).toBe(true);
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
