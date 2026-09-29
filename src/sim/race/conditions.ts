// Which of the race's thought conditions hold today (see content/raceThoughts.ts).
import type { RaceThoughtCondition } from "../../content/raceThoughts";
import type { GameState } from "../types";
import { openDropActive } from "./finance";
import { powerOf } from "./power";
import { eraOfState } from "./race";

export function raceConditions(state: GameState): RaceThoughtCondition[] {
  const out: RaceThoughtCondition[] = [`era${eraOfState(state)}` as RaceThoughtCondition];
  if (openDropActive(state)) out.push("openDrop");
  const power = powerOf(state);
  if (power.datacenters > power.powered) out.push("unpowered");
  if (state.race.rank === 1) out.push("top");
  if (state.race.rankDelta < 0) out.push("rankFell");
  return out;
}
