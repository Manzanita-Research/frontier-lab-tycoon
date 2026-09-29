// A scripted "reasonable player": builds a gateway first, adds compute and more gateways as cash allows,
// answers event cards. Checks that the scenario is winnable on a sensible timeline and when the event lands.
import { BUILDINGS, type PlaceableKind } from "../content/buildings";
import { canPlace, type Command } from "./commands";
import { openEventOf } from "./events";
import { outcomeOf } from "./goals";
import { createInitialState } from "./state";
import { TICKS_PER_DAY, tick } from "./tick";
import type { GameState } from "./types";

const ORDER: PlaceableKind[] = ["gateway", "cluster", "gateway", "gateway", "cluster", "gateway", "hall", "gateway", "cluster", "gateway"];
const RESERVE = 600_000;

function findSpot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 8; z <= 21; z++) for (let x = 3; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

export interface Report {
  seed: number;
  outcome: string;
  endDay: number;
  eventDay: number | null;
  goalDays: (number | null)[];
  builds: string;
  minCash: number;
}

export function playBot(seed: number, opts: { fountain?: boolean; days?: number; every?: number } = {}): Report {
  const s = createInitialState(seed);
  const goalDays: (number | null)[] = s.goals.context.goals.map(() => null);
  let eventDay: number | null = null;
  let built = 0;
  let minCash = Infinity;
  const builds: string[] = [];
  const maxTicks = (opts.days ?? 400) * TICKS_PER_DAY;
  for (let i = 0; i < maxTicks && outcomeOf(s) !== "lost"; i++) {
    const cmds: Command[] = [];
    if (openEventOf(s)) {
      eventDay ??= s.day;
      cmds.push({ type: "chooseEvent", eventId: openEventOf(s)!.id, choiceIndex: opts.fountain === false ? 0 : s.cash > 900_000 ? 1 : 0 });
    } else if (i % (TICKS_PER_DAY * (opts.every ?? 1)) === 0 && built < ORDER.length) {
      const kind = ORDER[built]!;
      if (s.cash >= BUILDINGS[kind].price + RESERVE) {
        const spot = findSpot(s, kind);
        if (spot) {
          cmds.push({ type: "placeBuilding", kind, x: spot[0], z: spot[1] });
          builds.push(`${kind}@${s.day}`);
          built++;
        }
      }
    }
    tick(s, cmds);
    minCash = Math.min(minCash, s.cash);
    s.goals.context.goals.forEach((g, gi) => {
      if (g.met && goalDays[gi] === null) goalDays[gi] = s.day;
    });
    if (outcomeOf(s) === "won") break;
  }
  return { seed, outcome: outcomeOf(s), endDay: s.day, eventDay, goalDays, builds: builds.join(" "), minCash };
}

describe("a reasonable player", () => {
  const bots = [1, 2, 3].map((seed) => playBot(seed, { every: 8 }));

  it("wins the scenario well before the deadline, with revenue in hand a good while before the last release", () => {
    for (const r of bots) {
      expect(r.outcome).toBe("won");
      expect(r.endDay).toBeGreaterThan(120); // not a walkover
      expect(r.endDay).toBeLessThan(250);
      expect(r.goalDays[1]!).toBeLessThan(r.endDay - 30);
    }
  });

  it("meets the Water Discourse card on the way, around day 60 to 120", () => {
    for (const r of bots) {
      expect(r.eventDay).toBeGreaterThanOrEqual(60);
      expect(r.eventDay).toBeLessThanOrEqual(120);
    }
  });
});

describe("an absent player", () => {
  it("loses at the deadline, having ignored the water", () => {
    const s = createInitialState(1);
    for (let i = 0; i < 400 * TICKS_PER_DAY && outcomeOf(s) === "playing"; i++) {
      tick(s, openEventOf(s) ? [{ type: "chooseEvent", eventId: openEventOf(s)!.id, choiceIndex: 2 }] : []);
    }
    expect(outcomeOf(s)).toBe("lost");
    expect(s.day).toBeLessThanOrEqual(360);
    expect(s.arcs.waterDiscourse!.context.openedDay).toBeDefined();
  });
});
