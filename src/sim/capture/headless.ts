// Evidence harness for Regulatory Capture (FLT-22) and the Promise Tracker (FLT-23): a year of real ticks on the test
// campus with the Circus and both packs awake, every card answered by a fixed policy. A slick witness raises Capture
// at the hearings, so the staffer calls; the bot drafts the clauses it is given and, if `lobby`, pays every senator
// leaning the wrong way on each motion. No forced stage.
import { eventById } from "../../content/events";
import { openEventOf } from "../events";
import { outcomeOf } from "../goals";
import { createTestCampus, answer, layPaths, readyForPressure } from "../testkit";
import { tick, TICKS_PER_DAY } from "../tick";
import type { Command } from "../commands";
import { enableLeapfrog } from "../race/leapfrog/driver";
import { enableHearing } from "../hearing/driver";
import { enableYacht } from "../yacht/driver";
import { enablePromises } from "../promises/driver";
import { promisesView } from "../promises/view";
import { enableEndings } from "../endings/state";
import { enableCapture } from "./driver";
import { DRAFT_CARD, EXPOSED_CARD } from "./pack";

export interface SenatePolicy {
  /** Clauses to tick on the draft; an empty list shreds it. */
  clauses: string[];
  lobby: boolean;
  /** Which answer to the leak: 0 intern, 1 typo, 2 own it. */
  exposed?: number;
  capture?: boolean;
  promises?: boolean;
  /** FLT-11's endings awake too; the run stops at the front page. */
  endings?: boolean;
}

export function runSenateYear(seed: number, policy: SenatePolicy, days = 365) {
  const s = createTestCampus(seed);
  readyForPressure(s);
  enableLeapfrog(s);
  enableHearing(s);
  enableYacht(s);
  if (policy.promises !== false) enablePromises(s);
  if (policy.capture !== false) enableCapture(s);
  if (policy.endings) enableEndings(s);
  layPaths(s);
  const cards: { day: number; id: string; pick: number }[] = [];
  let lobbied = 0;
  for (let i = 0; s.day < days && outcomeOf(s) !== "lost" && outcomeOf(s) !== "ended" && i < days * TICKS_PER_DAY * 3; i++) {
    const open = openEventOf(s);
    const cmds: Command[] = [];
    let pick = 0;
    if (open && eventById(open.id)?.kind === "hearing") pick = 1;
    else if (open?.id === DRAFT_CARD) {
      for (const clause of policy.clauses) cmds.push({ type: "draftClause", clause, on: true });
      pick = policy.clauses.length ? 0 : 1;
    } else if (open?.id === EXPOSED_CARD) pick = policy.exposed ?? 0;
    else if (open?.id === "computeAuction") pick = 1;
    if (policy.lobby && !open && i % TICKS_PER_DAY === 0) {
      const v = promisesView(s);
      for (const sen of v.senators) if (v.lobbying && !sen.lobbied && sen.leaning !== v.motion?.labSide) { cmds.push({ type: "lobby", senator: sen.id }); lobbied++; }
    }
    if (open) cards.push({ day: s.day, id: open.id, pick });
    tick(s, open ? [...cmds, ...answer(s, pick)] : cmds);
  }
  return { seed, day: s.day, outcome: outcomeOf(s), cards, lobbied, bill: s.bill, promises: s.promises, world: s };
}
