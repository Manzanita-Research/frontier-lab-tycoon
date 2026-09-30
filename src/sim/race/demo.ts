// Debug scenes for the race (`?moment=shuffle|era|era3|auction|funding`): the game is staged a moment before
// something happens, so a link or a screenshot script lands right on it. Pure sim: it only moves the World along,
// deterministically, the way a player could have; it isn't used by the game itself.
import { canPlace } from "../commands";
import type { RivalContext, RivalStored } from "./rival";
import { applyNow, tick, TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";

export const MOMENTS = ["shuffle", "era", "era3", "auction", "funding"] as const;
export type Moment = (typeof MOMENTS)[number];
export const isMoment = (s: string | null | undefined): s is Moment => !!s && (MOMENTS as readonly string[]).includes(s);

/** Replace a rival's stored context (and, if given, its state) with a patched copy. */
function patch(s: GameState, id: string, over: Partial<RivalContext>, value?: string) {
  const i = s.race.rivals.findIndex((r) => r.context.id === id);
  const r = s.race.rivals[i]!;
  s.race.rivals[i] = { value: value ?? r.value, context: { ...r.context, ...over } } as RivalStored;
}

/** Put the clock `ticks` before the midnight that starts `day`. */
function before(s: GameState, day: number, ticks: number) {
  s.tick = day * TICKS_PER_DAY - ticks;
  s.day = Math.floor(s.tick / TICKS_PER_DAY);
}

/** A lab with a gateway and revenue, still in Era 1. */
function withRevenue(s: GameState) {
  for (const [x, z] of [[6, 14], [15, 13], [7, 17]] as const) {
    if (canPlace(s, "gateway", x, z).ok) {
      applyNow(s, [{ type: "placeBuilding", kind: "gateway", x, z }]);
      break;
    }
  }
  s.cash = 12_000_000;
  s.hype = 68;
  s.vibes = { ...s.vibes, value: 640 };
  s.capability = 42;
  s.models = ["Frontier-2", "Frontier-3-Reasoner", "Frontier-4"];
}

export function stageMoment(s: GameState, moment: Moment) {
  switch (moment) {
    case "shuffle": {
      // Week 1: you are on top. A moment before week 2, three labs surge, and Sirocco is about to drop a free model.
      withRevenue(s);
      for (const id of ["anthro", "openish", "metameta", "sirocco", "macrohard"]) patch(s, id, { capability: 34, hype: 45 });
      before(s, 7, 1);
      tick(s);
      patch(s, "openish", { capability: 52, hype: 68 });
      patch(s, "macrohard", { capability: 49, hype: 64 });
      patch(s, "sirocco", { weeks: 1, capability: 44, hype: 72 }, "training");
      before(s, 14, 16); // 1.6 seconds at 1x
      return;
    }
    case "era":
    case "era3":
      withRevenue(s);
      // The agents in the crowd grow toward their new target on the first midnight: about 3.4x and about 9x.
      s.capability = moment === "era" ? 90 : 200;
      before(s, 3, 6);
      return;
    case "auction":
      withRevenue(s);
      before(s, 40, 6);
      return;
    case "funding":
      s.cash = 450_000;
      s.capability = 40;
      s.hype = 62;
      s.vibes = { ...s.vibes, value: 640 };
      before(s, 3, 6);
      return;
  }
}
