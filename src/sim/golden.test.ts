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

/** A busy player: builds every 30 ticks, paves a bit, bulldozes a path, answers every event card differently. */
function play(seed: number, ticks: number, checkpoints: number[]): Record<number, string> {
  const s = createInitialState(seed);
  const out: Record<number, string> = {};
  let built = 0;
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
    }
    if (i === 250) cmds.push({ type: "placePath", x: 5, z: 16 });
    // Operations: a Janitor Bot, an SRE and a guard, one of them with a patrol zone.
    if (i === 300) cmds.push({ type: "hire", job: "janitor" }, { type: "hire", job: "sre" });
    if (i === 900) cmds.push({ type: "hire", job: "security" }, { type: "hire", job: "comms" });
    if (i === 1000 && s.staff[0]) for (const x of [8, 9, 10]) cmds.push({ type: "paintZone", id: s.staff[0]!.id, x, z: 16, on: true });
    if (i === 700) cmds.push({ type: "bulldoze", x: 13, z: 16 });
    // This stress script deliberately approves its own spending; ordinary play uses the 3-month dialog.
    tick(s, cmds.map((c) => c.type === "placeBuilding" || c.type === "placePath" || c.type === "hire" ? { ...c, confirmed: true } : c));
    if (checkpoints.includes(i + 1)) out[i + 1] = digest(s);
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
// FLT-56 lines a walk-out up as a conga line on the founder's route (positions only: same RNG stream, same ids). Only
// seed 3's Defection walks more than one person out before 4000, so only its 4000 moved. Then the auditors huddle for an
// hour before they leave, and the report draws a rival's reaction and (for a month) the visitors' talk from the
// auditors' own stream: every seed's first visit ends before 3200, so 3200 and 4000 moved and nothing earlier did.
// Then the Hearing got twelve more questions: the same draw picks a different docket from a longer list, so the first
// summons (between 800 and 1600 on every seed) asks other things, and 1600 onward moved. The old pack reproduces the old values.
// Phase 2 made the Promise Tracker's motions matter: every motion names its stakes, and a pass or a fail now nudges the
// factions and lasts longer (mods/base-promises). The first roll call lands between 1600 and 2400 on every seed, so 2400
// onward moved. With the old motions the new capture driver (leak meter, warning, bury) reproduces the old values.
const GOLDEN: Record<number, Record<number, string>> = {
  1: { 200: "d3826cd0", 800: "ed628bb9", 1600: "5090f149", 2400: "4f7fbe80", 3200: "03219dee", 4000: "c41f0fc2" },
  2: { 200: "e548b1af", 800: "552cae60", 1600: "031fbba6", 2400: "db5b6feb", 3200: "7c0e1c28", 4000: "badde67b" },
  3: { 200: "58bb415c", 800: "920699d6", 1600: "1e68dec4", 2400: "db23cad4", 3200: "dafa3df6", 4000: "76e3adb8" },
};

describe("golden runs", () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed} reproduces the recorded digests at every checkpoint`, () => {
      const actual = play(seed, 4000, CHECKPOINTS);
      expect(actual).toEqual(GOLDEN[seed]);
    });
  }
});
