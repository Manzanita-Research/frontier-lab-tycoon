// Review moments use the same card/tick paths as play. No renderer or UI dependencies.
import { openEventOf } from "../events";
import { answer } from "../testkit";
import { hire } from "../staff";
import { applyNow, tick } from "../tick";
import type { GameState } from "../types";
import { enableCollusion, dailyCollusion, updateCollusion } from "./driver";
import { freshSwarm } from "./machine";
import { SIGN_CARD } from "./pack";
import { dailyEvents } from "../events";
export const COLLUSION_MOMENTS = ["collusion-sign", "collusion-traffic", "collusion-scandal"] as const;
export function isCollusionMoment(value: string | null | undefined): value is typeof COLLUSION_MOMENTS[number] {
  return (COLLUSION_MOMENTS as readonly unknown[]).includes(value);
}
export function stageCollusion(s: GameState, moment: typeof COLLUSION_MOMENTS[number]) {
  for (let i = 0; i < 100; i++) tick(s, answer(s));
  enableCollusion(s);
  s.cash = Math.max(s.cash, 12_000_000);
  s.day = 150; s.tick = 3000;
  s.collusion!.machine = { value: "spreading", context: { ...freshSwarm().context, seededDay: 120, score: 40, noticed: true } };
  if (moment === "collusion-sign") {
    for (let i = 0; i < 3; i++) hire(s, "security");
    s.flags[`offer:${SIGN_CARD}`] = s.day;
    // A previously queued baseline card is answered, retaining normal slot arbitration.
    while (openEventOf(s) && openEventOf(s)?.id !== SIGN_CARD) {
      // applyNow avoids aging the staged moment
      applyNow(s, answer(s));
    }
    dailyEvents(s);
  } else if (moment === "collusion-scandal") {
    s.day = 260; s.tick = 5200;
    s.collusion!.machine = { value: "organized", context: { ...freshSwarm().context, seededDay: 120, score: 100, noticed: true } };
    dailyCollusion(s);
  } else {
    s.tick = 3018;
    updateCollusion(s);
    s.tick = 3020;
    updateCollusion(s);
  }
}
