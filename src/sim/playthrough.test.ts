// A scripted "reasonable player": builds gateways first, then compute and halls as cash allows, powers the
// Datacenters the auctions hand out, and answers every card sensibly. Checks that the scenario (reach Era 3 and
// the top of the Arena by the end of Y3) is winnable on a sensible timeline, and that the race's beats land.
import { BUILDINGS, type PlaceableKind } from "../content/buildings";
import { SCENARIO } from "../content/goals";
import { type Command } from "./commands";
import { openEventOf } from "./events";
import { outcomeOf } from "./goals";
import { eraOfState } from "./race/race";
import { createInitialState } from "./state";
import { countOf, findSpot, layPaths } from "./testkit";
import { TICKS_PER_DAY, tick } from "./tick";
import type { GameState } from "./types";

const RESERVE = 400_000;

export interface Report {
  seed: number;
  outcome: string;
  /** The day the scenario was won (or the last day played). */
  endDay: number;
  /** First days at each era, or null. */
  eraDays: (number | null)[];
  /** First day at #1 on the Arena, and the worst rank seen after that. */
  firstTop: number | null;
  worstAfterTop: number;
  /** Cards seen, by id. */
  cards: Record<string, number>;
  /** Auctions won: Datacenters standing at the end. */
  datacenters: number;
  minCash: number;
}

/** What the bot answers, by card: mid bid at auctions, a price cut for open weights, the fountain for water. */
function choice(s: GameState, id: string): number {
  if (id === "computeAuction") return 1;
  if (id === "waterDiscourse") return s.cash > 900_000 ? 1 : 0;
  return 0;
}

export function playBot(seed: number, opts: { halls?: number; days?: number; keepPlaying?: boolean } = {}): Report {
  const s = createInitialState(seed);
  layPaths(s);
  const maxHalls = opts.halls ?? 7;
  const cards: Record<string, number> = {};
  const eraDays: (number | null)[] = [0, null, null, null];
  let firstTop: number | null = null;
  let worstAfterTop = 0;
  let wonDay: number | null = null;
  let minCash = Infinity;
  const maxTicks = (opts.days ?? 1100) * TICKS_PER_DAY;
  for (let i = 0; i < maxTicks && outcomeOf(s) !== "lost"; i++) {
    const cmds: Command[] = [];
    const open = openEventOf(s);
    if (open) {
      cards[open.id] = (cards[open.id] ?? 0) + 1;
      cmds.push({ type: "chooseEvent", eventId: open.id, choiceIndex: choice(s, open.id) });
    } else if (i % (TICKS_PER_DAY * 4) === 0) {
      const halls = countOf(s, "hall");
      const clusters = countOf(s, "cluster");
      const gateways = countOf(s, "gateway");
      const datacenters = countOf(s, "datacenter");
      let kind: PlaceableKind | null = null;
      // Keep the researchers fed and rested, or they hand in their boxes: a bar, a snack wall and pods per few halls.
      if (datacenters > countOf(s, "gas") && s.flags["unlocked:gas"] !== undefined) kind = "gas";
      else if (s.day > 20 && countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 40 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (s.day > 60 && countOf(s, "snack") < 1 + Math.floor(halls / 3)) kind = "snack";
      else if (gateways < Math.min(5, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (clusters + 6 * datacenters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(maxHalls, 3 + Math.floor(s.day / 90))) kind = "hall";
      else if (clusters < 12) kind = "cluster";
      if (kind && s.cash >= BUILDINGS[kind].price + RESERVE) {
        const spot = findSpot(s, kind);
        if (spot) cmds.push({ type: "placeBuilding", kind, x: spot[0], z: spot[1] });
      }
    }
    tick(s, cmds);
    minCash = Math.min(minCash, s.cash);
    const era = eraOfState(s);
    for (let e = 2; e <= era; e++) eraDays[e - 1] ??= s.day;
    if (s.race.rank === 1) firstTop ??= s.day;
    if (firstTop !== null) worstAfterTop = Math.max(worstAfterTop, s.race.rank);
    if (outcomeOf(s) === "won") {
      wonDay ??= s.day;
      if (!opts.keepPlaying) break;
    }
  }
  return { seed, outcome: outcomeOf(s), endDay: wonDay ?? s.day, eraDays, firstTop, worstAfterTop, cards, datacenters: countOf(s, "datacenter"), minCash };
}

describe("a reasonable player", () => {
  const bots = [1, 2, 3].map((seed) => playBot(seed));

  it("wins the scenario with time to spare: Era 3 and the top of the Arena, well inside Y3", () => {
    for (const r of bots) {
      expect(r.outcome).toBe("won");
      expect(r.endDay).toBeGreaterThan(250); // not a walkover
      expect(r.endDay).toBeLessThan(SCENARIO.deadlineDay - 300);
      expect(r.eraDays[2]).not.toBeNull();
    }
  });

  it("meets the eras in order: Coding Automation early, Superhuman Coder late", () => {
    for (const r of bots) {
      expect(r.eraDays[1]!).toBeGreaterThanOrEqual(30);
      expect(r.eraDays[1]!).toBeLessThanOrEqual(150);
      expect(r.eraDays[2]!).toBeGreaterThan(r.eraDays[1]! + 100);
    }
  });

  it("takes the lead on the Arena at some point, and the rivals do not just let it stand", () => {
    for (const r of bots) {
      expect(r.firstTop).not.toBeNull();
      expect(r.worstAfterTop).toBeGreaterThanOrEqual(3); // the drop from #1 to the middle of the pack is the point
    }
  });

  it("is called to the auction, offered an open-weights drop, and gets a datacenter to power", () => {
    for (const r of bots) {
      expect(r.cards.computeAuction ?? 0).toBeGreaterThanOrEqual(3);
      expect(r.cards.openWeights ?? 0).toBeGreaterThanOrEqual(1);
      expect(r.cards.era2).toBe(1);
      expect(r.datacenters).toBeGreaterThanOrEqual(1);
    }
  });

  it("can keep going after the win and reach the Intelligence Explosion before the old deadline", () => {
    const r = playBot(1, { keepPlaying: true, days: SCENARIO.deadlineDay + 40 });
    expect(r.eraDays[3]).not.toBeNull();
    expect(r.eraDays[3]!).toBeLessThan(SCENARIO.deadlineDay + 40);
  });
});

describe("an absent player", () => {
  it("loses at the deadline, having answered every card with its last choice and built nothing", () => {
    const s = createInitialState(1);
    for (let i = 0; i < (SCENARIO.deadlineDay + 20) * TICKS_PER_DAY && outcomeOf(s) === "playing"; i++) {
      const open = openEventOf(s);
      tick(s, open ? [{ type: "chooseEvent", eventId: open.id, choiceIndex: 99 }] : []);
      // (an out-of-range pick is ignored by the arc, so answer properly)
      if (openEventOf(s)) tick(s, [{ type: "chooseEvent", eventId: openEventOf(s)!.id, choiceIndex: 0 }]);
    }
    expect(outcomeOf(s)).toBe("lost");
    expect(s.day).toBeLessThanOrEqual(SCENARIO.deadlineDay);
  });
});
