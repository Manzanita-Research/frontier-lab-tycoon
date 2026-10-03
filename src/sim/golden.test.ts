// The golden digests: the script and the projection are in golden.ts (read its header for what the digest covers).
import { play } from "./golden";

const CHECKPOINTS = [200, 800, 1600, 2400, 3200, 4000];

// FLT-16 intentionally re-records these for the quiet start, daily attraction-driven arrivals, delayed pressure,
// tutorial state and the paid opening paths. Movement uses sqrt for bounded tile distances (same geometry,
// deterministic floating-point differences). Each seed is independently replayed and JSON round-tripped.
// The playtest follow-up fixes unzoned staff patrol (new seeded route draws), records guardrails,
// and explicitly confirms the busy-player stress purchases so dialogs cannot freeze this replay.
// Recorded from the pre-port sim (origin/flt-3-slice-2 @ 8f9750a; sorted-flags projection), re-recorded by FLT-9 and
// again by FLT-10. FLT-9 changes the game on purpose: rivals, the Arena, eras, the R&D multiplier (training runs faster), bigger
// leaps per release, Training Halls that convert 30 compute a day, and a compute auction on day 40 that this
// script answers like any other card. The port itself was verified against the original numbers in FLT-3.
// FLT-49 intentionally records the new starting coach/progression state. Systems and purchases now
// wait for earned levels; the busy-player script first builds a Hall so it can earn access to a Gateway.
// Path exploration and the Comms break post change deterministic route draws from this new opening.
// FLT-47 polish rewords three thoughts (parody rule: no real brands); seed 1 shows one at tick 200. Text only, same RNG stream.
// FLT-37 wakes a system's pack when its rung is earned: Collusion (on Scrutiny, level 5) never started in normal play.
// Every seed reaches level 5 by tick 980-1120; only checkpoints after that move (seed 3 from 2400, seeds 1 and 2 from 3200).
// FLT-52 (merge train) adds five more packs to Scrutiny: the Hearing, the yacht summit, Defection, the Poaching War and
// Evals Without Borders. Level 5 lands at tick 980 (seeds 1, 3) and 1120 (seed 2), so 200 and 800 hold. First tick each
// pack moves the World (seed 1 / 2 / 3): Poaching 1120 / 1823 / 1683, the yacht 1220 / 1360 / 1220, the Hearing
// 1380 / 1520 / 1380, Evals Without Borders 3246 / 2183 / 2203, Defection 2626 / 3386 / 2806. So 1600 on moves on every seed.
// Then Regulatory Capture and the Promise Tracker (FLT-22/23), also on Scrutiny: they arm their card arcs the tick Level 5
// lands (980 / 1120 / 980) and first move a number or a headline at 1463 / 1603 / 1823 (Capture 1463 / 1603 / 3429,
// the Promise Tracker 1823 / 1623 / 1823). 200 and 800 still hold.
// Then the factions and the Water Discourse arc (FLT-33/25). Level 4 lands at 940 / 980 / 880: its rung now names the
// factions, which wake and first move the World 4 ticks later (944 / 984 / 884). The base-water arc's documentary crew
// (a new card, Level 5) first moves it at 1963 / 2043 / 2343 (2323 / 2383 / 2403 with the factions off). 200 and 800 hold.
// FLT-58 moves the ladder on purpose: the first run is a small model (100 compute, not 300), progression is checked every
// tick, Level 2 counts visitors served, Level 3 scripts the first spill and breakdown, Level 4 seeds the Arena field, and
// the coach has two more steps. So the opening ships sooner and every later checkpoint follows from that.
// On the merge train (FLT-52) these are FLT-58's own numbers, digit for digit: under the new ladder this script reaches
// Level 2 at tick 240 / 240 / 220 and Level 3 at 1380 / 1340 / 1360, and never earns Level 4 in 4000 ticks (its tick-300
// hires land while staff is still locked, so the ops goal never has its SRE and Janitor). No Race or Scrutiny pack wakes,
// so none of the wave moves a checkpoint. The wave's packs are pinned by the midgame digest (every pack awake for 480
// days) and by each pack's own determinism test.
// Merge train 2: FLT-56 (#68) re-recorded these on the old ladder, where its conga line, the auditors' huddle, the
// Hearing's docket and the motions' stakes all ran in this script. Under FLT-58's ladder none of those packs wakes
// here, so FLT-56 moves nothing and the train's values stand; its changes are pinned by the midgame digest.
// FLT-54 teaches the script the ladder: it hires its Janitor Bot and SRE again the tick Level 3 earns the Staff Manager
// (1380 / 1340 / 1360), and at Level 4 it climbs the Arena (eight more clusters, halls and a gateway, while it has $1.5M
// to spare). Level 4 lands at 1670 / 1613 / 1612 and Level 5 at 2240 on every seed (2380 / 2520 / 2380 without the
// climb), so Scrutiny's staggered wake-ups (6 to 86 days after the rung) all play inside the 4000 ticks. The card budget
// itself moved nothing here: before the script changed, every checkpoint held. 200 and 800 hold; 1600 on moves on every
// seed (the Level 3 hires land before it). The rival rename (#71) then moved 2400 on: the packs Level 5 wakes carry the
// rivals' names and ids; FLT-54's unread badges then tag the Arena, Papers and Discourse headlines with their panel
// (NewsItem.panel), and the record-taken toasts carry their group (Toast.group, folded by the app): 2400 on again.
// Merge train 2 then moves the late checkpoints here (4000; 3200 on seed 3): this script reaches Level 5, so FLT-56's packs
// wake in it, The Memo jumps the card line, and the Promise Tracker's whip and roll-call cards ask the card budget too.
// FLT-69 wakes the Bird App at Level 3 (1380 / 1340 / 1360 here) and moves the Comms Rep from Level 5 to Level 3, so
// 1600 on moves on every seed (its posts, Aura, headlines and toasts). With `flags.birdappOff` set, and the Comms Rep put
// back on the Level 5 card (with the Level 3 card's two new items left out), all three seeds reproduce the values above
// at every checkpoint, digit for digit: the Bird App is the whole difference.
// FLT-59 adds the Sandbox Escape to Scrutiny: the Level 5 card names the Sandbox, the Honeypot and the escape, and the
// pack wakes last (96 days after the rung). The card is in the World, so 2400 on moves on every seed. With the Scrutiny
// row put back as it was (no Sandbox, no Honeypot, no escape) all three seeds reproduce the values above, digit for digit.
// FLT-76 asks the first decision on Level 1: the Logo opens two days after the first path, while the first model trains,
// and this script answers it like any other card, so every checkpoint moves. Then the offsite (FLT-76's minor beat 106
// days into Scrutiny) adds flags.scrutinyDay on the tick Level 5 lands (2240); the card itself would open on day 218, past
// these 4000 ticks. With the card kept shut (`firstMinutes` false) and without the flag, all three seeds reproduce FLT-59's
// values (c403ae9a… / 766f3295… / b43cb9be…).
// Jem's labels for the Logo (A butthole / A butthole-ier butthole / Not a butthole) change its news lines, which sit in
// the World until the ticker rolls them off: 200 to 1600 move, 2400 on hold.
// FLT-86 (money and the win) moves every checkpoint, on purpose. The projection shows each goal's `hold`/`held` (the
// Arena objective is now "hold Top 3 for 30 days"), which is in the World from tick 0. With those two fields projected
// out and the goals' new toasts (each objective met, the hold starting and slipping) switched off, all three seeds
// reproduce the values above tick for tick, RNG stream included, until the game itself is meant to differ: seeds 1 and 3
// win the instant they reach Top 3 (ticks 3480 and 3600), and now start the 30-day hold instead; seed 2 dips below $0
// at 2680 and gets emergency round 1 (a card, signed for 10% of the lab) where the free bailout used to be. None of the
// three wins inside 4000 ticks. The goals' toasts take an id each, so with them on, the ids after the first "Objective
// met" (tick 2200 on seed 1) move too, and so does whatever is picked by id (a faction thread on seed 1 at 2380).
// FLT-92: the rival labs post on the Bird App too (their own stream, from Level 3), so 1600 on moves on every seed:
// their posts, the ticker lines and toasts, and the dunks and ratios. With the rivals off (`enableBirdRivals` a no-op)
// all three seeds reproduce FLT-86's values (af539c00… / 69cae759… / 5277ca60…), digit for digit.
// FLT-91: a garage starts on an entrance plaza and a short walk (14 tiles) instead of a five-tile stub, so every
// checkpoint moves on every seed: the opening researchers are seeded on different tiles (their own RNG draws), the
// plaza is in the World from tick 0, and the coach's path step counts 14 + 3 tiles instead of 5 + 3. With `openingPaths()`
// returning the old stub, all three seeds reproduce FLT-92's values (72d15c6c… / 97c3299b… / cd605dda…) digit for digit.
// FLT-106 moves every checkpoint but 200 on seeds 2 and 3 and 800 on seed 1, on purpose: the sim's maths no longer
// depends on the JS engine. Node 26 (V8 14) takes Math.pow from the C library and rounded one protester's spot an ulp
// away from Node 22, so seeds 2 and 3 split at 3140 and 3060 (seed 1 at 2880, healed before 3200); Chrome 153 rounds
// sin, cos, atan2, exp, log and tanh differently again. Every one of those calls (and hypot, and `**`) now goes through
// src/sim/dmath.ts, which gives the same bits everywhere, so the facings (`dir`) move from tick 27 and the rest follows.
// These values hold on Node 22 and 26, and `pnpm engines` shows the whole World (not just this view) is the same in
// Chromium 153, Firefox 155 and JavaScriptCore (Bun 1.4) too; CI's engines job adds Playwright's WebKit.
// FLT-109: the lab's lunch order can run three hours late from Level 3 (1360 here), rolled at each campus noon on the
// pack's own stream. On seed 1 it does, at noon on tick 3100 (the courier at 3175, fed at 3210): the crowd at the gate, the courier, the run
// sliding back, so 3200 and 4000 move (d4f484bb / b722d047 before). Seeds 2 and 3 roll at the same noons and never run
// late, so they hold. With the pack kept asleep all three seeds reproduce the values before, digit for digit.
const GOLDEN: Record<number, Record<number, string>> = {
  1: { 200: "04394bba", 800: "4c87ace4", 1600: "325c597f", 2400: "3cbcfb81", 3200: "2384a38d", 4000: "021ecb7f" },
  2: { 200: "3263645c", 800: "a65d0f09", 1600: "a884e14f", 2400: "ecb312da", 3200: "c22499ee", 4000: "ebbd0b3d" },
  3: { 200: "09887c12", 800: "27b8e5f3", 1600: "80714f5a", 2400: "c1f4fb4e", 3200: "3923d6d9", 4000: "060e209d" },
};

describe("golden runs", () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed} reproduces the recorded digests at every checkpoint`, () => {
      const levels: Record<number, number> = {};
      const actual = play(seed, 4000, CHECKPOINTS, levels);
      expect(actual).toEqual(GOLDEN[seed]);
      expect(levels[5]).toBeLessThanOrEqual(2400);
    });
  }
});
