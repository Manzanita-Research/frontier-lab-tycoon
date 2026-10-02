// Behaviour guard, first written for the XState/Effect port (FLT-3): same seed + same commands must give the same
// numbers, RNG stream included. The FLT-3 digests were recorded from the hand-written sim before any system moved
// into a machine, and the port kept them. FLT-8 (the Crowd) changes the game on purpose (names, needs, queues,
// Vibes, new buildings, who spawns and when), so the digests below were re-recorded from that sim; the projection
// now also covers the new walker fields and the Vibes. FLT-10 (Operations) did it again: slop, breakdowns (a random
// draw per building per day), queues you can see, and staff; the script below now hires a few, and the projection
// covers the slop, the payroll and every building's reliability.
// FLT-32 put the Security Office on the Scrutiny rung, so its unlock card lists one more item: the digests from the
// card on (it arrives between ticks 800 and 1600) moved for that alone: same RNG state and world at 4000, one more item.
//
// The digest reads the game through `view()`, not the raw state, so the persisted shape can change (machine
// snapshots, moved fields) without touching the recorded values. Only `view()` follows the shape.
import { canPlace, type Command } from "./commands";
import { eventById } from "../content/events";
import { openEventOf } from "./events";
import { outcomeOf } from "./goals";
import { levelOf } from "./progression";
import { createInitialState } from "./state";
import { modeOf } from "./walkers";
import { tick } from "./tick";
import type { GameState } from "./types";
import type { PlaceableKind } from "../content/buildings";

const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The flag bag as the pre-port sim kept it: values that moved into machine contexts are folded back in here. */
function flagsOf(s: GameState): Record<string, unknown> {
  const flags: Record<string, unknown> = { ...s.flags };
  if (s.economy.context.lastBailout !== null) flags.lastBailout = s.economy.context.lastBailout;
  if (s.goals.context.outcomeDay !== null) flags.outcomeDay = s.goals.context.outcomeDay;
  for (const [id, arc] of Object.entries(s.arcs)) if (arc.context.openedDay !== null) flags[`event:${id}`] = arc.context.openedDay;
  return flags;
}

/** Everything a player could observe or that feeds the next tick, in a shape-independent form. */
function view(s: GameState) {
  return {
    tick: s.tick,
    day: s.day,
    rngState: s.rngState,
    nextId: s.nextId,
    version: s.version,
    cash: s.cash,
    capability: s.capability,
    compute: s.compute,
    hype: s.hype,
    vibes: s.vibes,
    outcome: outcomeOf(s),
    event: openEventOf(s),
    waterDiscourse: s.waterDiscourse,
    ledger: s.ledger,
    training: s.training.context,
    coach: s.coach,
    progression: s.progression,
    unlockCards: s.unlockCards,
    tutorial: s.tutorial,
    guardrails: s.guardrails,
    models: s.models,
    goals: s.goals.context.goals,
    flags: sorted(flagsOf(s)),
    news: s.news,
    // FLT-51 tags toasts (source, importance, reply) for the app; the numbers pinned here are the text, tone and id.
    toasts: s.toasts.map((t) => ({ id: t.id, text: t.text, tone: t.tone })),
    thoughts: s.thoughts,
    pops: s.pops,
    buildings: s.buildings,
    slop: s.slop.reduce((acc, level, i) => (level ? acc + `${i}:${level},` : acc), ""),
    staff: s.staff.map((o) => ({ id: o.id, job: o.job, name: o.name, x: o.x, z: o.z, phase: o.machine.value, task: o.task, done: o.done, zone: o.zone })),
    paths: s.grid.paths.reduce((acc, on, i) => (on ? acc + `${i},` : acc), ""),
    walkers: s.walkers.map((w) => ({
      id: w.id,
      kind: w.kind,
      x: w.x,
      z: w.z,
      px: w.px,
      pz: w.pz,
      dir: w.dir,
      route: w.route,
      targetId: w.targetId,
      mode: modeOf(w),
      timer: w.timer,
      name: w.name,
      role: w.role,
      energy: w.energy,
      focus: w.focus,
      fomo: w.fomo,
      patience: w.patience,
      impressed: w.impressed,
      drift: w.drift,
      need: w.need,
      lost: w.lost,
      mood: w.mood,
      stats: w.stats,
      mess: w.mess,
      queue: [w.queued, w.qtile, w.qslot],
      phase: w.machine.value,
      visits: w.visits,
      step: w.step,
      loiter: w.machine.value === "loitering",
      fountain: w.fountain,
      homeX: w.homeX,
      homeZ: w.homeZ,
    })),
  };
}

/** FNV-1a over the JSON of the view. */
function digest(s: GameState): string {
  const text = JSON.stringify(view(s));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function spot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 8; z <= 21; z++) for (let x = 3; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

const BUILD_ORDER: PlaceableKind[] = ["hall", "gateway", "kombucha", "snack", "cluster", "nap", "gateway", "hall", "cluster", "gateway"];
/** FLT-54: The Race's climb, once Level 4 names the Arena: compute and halls, while the money lasts. */
const CLIMB: PlaceableKind[] = ["cluster", "cluster", "hall", "cluster", "cluster", "hall", "cluster", "gateway"];

/** A busy player: builds every 30 ticks, paves a bit, bulldozes a path, answers every event card differently. */
function play(seed: number, ticks: number, checkpoints: number[], levels?: Record<number, number>): Record<number, string> {
  const s = createInitialState(seed);
  const out: Record<number, string> = {};
  let built = 0;
  let climbed = 0;
  let staffed = false;
  for (let i = 0; i < ticks; i++) {
    const cmds: Command[] = [];
    if (i === 0) {
      for (let z = 18; z >= 10; z--) cmds.push({ type: "placePath", x: 11, z });
      for (let x = 6; x <= 17; x++) cmds.push({ type: "placePath", x, z: 16 });
      cmds.push({ type: "continueTutorial" });
    }
    const open = openEventOf(s);
    if (open) cmds.push({ type: "chooseEvent", eventId: open.id, choiceIndex: (s.tick + seed) % eventById(open.id)!.choices.length });
    else if (i % 30 === 5 && built < BUILD_ORDER.length) {
      const kind = BUILD_ORDER[built]!;
      const at = spot(s, kind);
      if (at) {
        cmds.push({ type: "placeBuilding", kind, x: at[0], z: at[1] });
        built++;
      }
    } else if (i % 30 === 5 && levelOf(s) >= 4 && climbed < CLIMB.length && s.cash > 1_500_000) {
      const at = spot(s, CLIMB[climbed]!);
      if (at) {
        cmds.push({ type: "placeBuilding", kind: CLIMB[climbed]!, x: at[0], z: at[1] });
        climbed++;
      }
    }
    if (i === 250) cmds.push({ type: "placePath", x: 5, z: 16 });
    // Operations: a Janitor Bot, an SRE and a guard, one of them with a patrol zone.
    if (i === 300) cmds.push({ type: "hire", job: "janitor" }, { type: "hire", job: "sre" });
    // FLT-54: the tick-300 hires bounce off the locked Staff Manager; hire again once Level 3 earns it.
    if (!staffed && levelOf(s) >= 3) {
      cmds.push({ type: "hire", job: "janitor" }, { type: "hire", job: "sre" });
      staffed = true;
    }
    if (i === 900) cmds.push({ type: "hire", job: "security" }, { type: "hire", job: "comms" });
    if (i === 1000 && s.staff[0]) for (const x of [8, 9, 10]) cmds.push({ type: "paintZone", id: s.staff[0]!.id, x, z: 16, on: true });
    if (i === 700) cmds.push({ type: "bulldoze", x: 13, z: 16 });
    // This stress script deliberately approves its own spending; ordinary play uses the 3-month dialog.
    tick(s, cmds.map((c) => c.type === "placeBuilding" || c.type === "placePath" || c.type === "hire" ? { ...c, confirmed: true } : c));
    if (checkpoints.includes(i + 1)) out[i + 1] = digest(s);
    if (levels && levels[levelOf(s)] === undefined) levels[levelOf(s)] = i + 1;
  }
  return out;
}

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
const GOLDEN: Record<number, Record<number, string>> = {
  1: { 200: "7566b028", 800: "4c87ace4", 1600: "f2254ab6", 2400: "e521939b", 3200: "b1e0fe8f", 4000: "52512aac" },
  2: { 200: "3263645c", 800: "31bf7516", 1600: "d4438b25", 2400: "9fa821a1", 3200: "b4ee6965", 4000: "feb5a25d" },
  3: { 200: "09887c12", 800: "40547ab6", 1600: "2af29753", 2400: "a0a69cf1", 3200: "08505149", 4000: "d7fa34a4" },
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
