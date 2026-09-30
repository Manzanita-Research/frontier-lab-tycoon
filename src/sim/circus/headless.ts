// Evidence harness for the Circus packs (FLT-21 The Hearing, FLT-24 the yacht): a year of real ticks on the test campus
// with both packs awake, every card answered by a fixed policy. No forced stage: hearings happen when the triggers say so.
import { eventById } from "../../content/events";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { createTestCampus, answer, layPaths, readyForPressure } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import { enableLeapfrog } from "../race/leapfrog/driver";
import { enableHearing } from "../hearing/driver";
import { enableYacht } from "../yacht/driver";

/** How the bot testifies (one answer every time, or round the three) and how it RSVPs and replies to the leak. */
export type Witness = "earnest" | "slick" | "chaotic" | "mixed";
const ANSWER = { earnest: 0, slick: 1, chaotic: 2 } as const;

export function runCircusYear(seed: number, witness: Witness, yacht: { rsvp: number; reply: number } = { rsvp: 0, reply: 0 }) {
  const s = createTestCampus(seed);
  readyForPressure(s);
  enableLeapfrog(s);
  enableHearing(s);
  enableYacht(s);
  layPaths(s);
  let asked = 0;
  const cards: { day: number; id: string; pick: number }[] = [];
  for (let i = 0; s.day < 365 && outcomeOf(s) !== "lost" && i < 365 * TICKS_PER_DAY * 3; i++) {
    const open = openEventOf(s);
    let pick = 0;
    if (open && eventById(open.id)?.kind === "hearing") pick = witness === "mixed" ? asked++ % 3 : ANSWER[witness];
    else if (open?.id === "yacht-invite") pick = yacht.rsvp;
    else if (open?.id === "yacht-leak") pick = yacht.reply;
    else if (open?.id === "computeAuction") pick = 1;
    if (open) cards.push({ day: s.day, id: open.id, pick });
    tick(s, open ? answer(s, pick) : []);
  }
  return {
    seed, witness, day: s.day, outcome: outcomeOf(s), cards,
    hearings: s.hearing?.history ?? [], yacht: { rsvp: s.yacht?.rsvp ?? null, ending: s.yacht?.ending ?? null, leakDay: s.yacht?.leakDay ?? null },
    trust: s.disasters.trust, capture: s.capture ?? 0, hype: s.hype, world: s,
  };
}
