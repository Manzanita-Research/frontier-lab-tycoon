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
//
// The busy-player script and the projection live here, not in golden.test.ts, so scripts/engines.mjs (FLT-106) can bundle
// the same replay into a browser.
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
export function flagsOf(s: GameState): Record<string, unknown> {
  const flags: Record<string, unknown> = { ...s.flags };
  if (s.economy.context.lastBailout !== null) flags.lastBailout = s.economy.context.lastBailout;
  if (s.goals.context.outcomeDay !== null) flags.outcomeDay = s.goals.context.outcomeDay;
  for (const [id, arc] of Object.entries(s.arcs)) if (arc.context.openedDay !== null) flags[`event:${id}`] = arc.context.openedDay;
  return flags;
}

/** Everything a player could observe or that feeds the next tick, in a shape-independent form. */
export function view(s: GameState) {
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
export function digest(s: GameState): string {
  const text = JSON.stringify(view(s));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function spot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 8; z <= 21; z++) for (let x = 3; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

export const BUILD_ORDER: PlaceableKind[] = ["hall", "gateway", "kombucha", "snack", "cluster", "nap", "gateway", "hall", "cluster", "gateway"];
/** FLT-54: The Race's climb, once Level 4 names the Arena: compute and halls, while the money lasts. */
export const CLIMB: PlaceableKind[] = ["cluster", "cluster", "hall", "cluster", "cluster", "hall", "cluster", "gateway"];

/** A busy player (the golden script; scripts/engines.mjs replays it in other JS engines): builds every 30 ticks, paves a bit, bulldozes a path, answers every event card differently. */
export function play(seed: number, ticks: number, checkpoints: number[], levels?: Record<number, number>, onTick?: (s: GameState) => void): Record<number, string> {
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
    onTick?.(s);
    if (checkpoints.includes(i + 1)) out[i + 1] = digest(s);
    if (levels && levels[levelOf(s)] === undefined) levels[levelOf(s)] = i + 1;
  }
  return out;
}
