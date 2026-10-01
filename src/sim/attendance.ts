// RCT footfall: something to see, a reputation, and a campus worth walking around.
import { getReach } from "./pathfind";
import type { GameState } from "./types";
import { defs } from "./defs";
import { auraVisitors } from "./birdapp/effects";

export function visitorDemand(state: GameState): { perDay: number; cap: number } {
  const reach = getReach(state);
  let attractions = 0;
  let campus = 0;
  for (const b of state.buildings) {
    if (!reach.buildings.has(b.id) || b.broken || defs().buildings[b.kind].scenery) continue;
    campus++;
    if (b.kind === "gateway") attractions += 0.7;
    if (b.kind === "demo") attractions += 2;
  }
  const paths = reach.tiles.reduce((n, on) => n + on, 0);
  const size = Math.max(0, campus - 1) * 0.08 + Math.max(0, paths - 5) * 0.006;
  // FLT-69: the lab's Aura on the Bird App brings people to see it.
  const reputation = (0.4 + state.hype / 50) * (state.vibes.value / 600) * auraVisitors(state);
  // Word of mouth takes time, even when the slide deck says exponential growth.
  const wordOfMouth = Math.min(1, state.day / 60);
  const draw = (0.025 + attractions + size) * reputation * 0.4;
  return { perDay: draw * wordOfMouth, cap: Math.min(400, Math.round(4 + draw * 24)) };
}
