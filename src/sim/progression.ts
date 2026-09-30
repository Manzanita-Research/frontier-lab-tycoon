import { enableLeapfrog } from "./race/leapfrog/driver";
import { enablePapers } from "./race/papers/driver";
import { enableAuditors } from "./auditors/driver";
import { enableCollusion } from "./collusion/driver";
import { enableDefection } from "./defection/driver";
import { enableHearing } from "./hearing/driver";
import { enablePoaching } from "./poaching/driver";
import { enableBirdApp } from "./birdapp/driver";
import { enableYacht } from "./yacht/driver";
import { enableFactions } from "./factions/state";
import type { BuildingKind } from "../content/buildings";
import { enableCapture } from "./capture/driver";
import { enablePromises } from "./promises/driver";
import { seedField } from "./race/arena";
import { formatMoney } from "./format";
import { STAFF } from "../content/staff";
import { HUD_PANELS, type HudPanel, type Level, type ProgressionLevel, type ProgressView, type SystemId } from "../content/progression";
import { progressionMachine } from "./machines/progression";
import { step } from "./machines/run";
import { defs } from "./defs";
import type { GameState, StaffJob } from "./types";

type ProgressState = Pick<GameState, "progression">;
// The ladder is content: a mod can retune a goal or move an unlock (FLT-37).
const rows = (_s: ProgressState) => defs().progression;
export const levelOf = (s: ProgressState): Level => (s.progression?.context.level ?? 5) as Level;
const unlockedRows = (s: ProgressState) => rows(s).filter((r) => r.level <= levelOf(s));
// The systems each level has earned, per ladder: the tick asks about thirty times, so work it out once (FLT-39).
let earned: { ladder: readonly ProgressionLevel[]; byLevel: Set<SystemId>[] } | null = null;
const systemsAt = (s: ProgressState): Set<SystemId> => {
  const ladder = rows(s);
  if (earned?.ladder !== ladder) earned = { ladder, byLevel: [] };
  const level = levelOf(s);
  return (earned.byLevel[level] ??= new Set(unlockedRows(s).flatMap((r) => r.systems)));
};
export const systemUnlocked = (s: ProgressState, id: SystemId): boolean => !s.progression || systemsAt(s).has(id);
export const staffUnlocked = (s: GameState, job: StaffJob): boolean => !s.progression || unlockedRows(s).some((r) => r.staff.includes(job));
// Offices are hidden infrastructure created by incident verbs, not palette unlocks.
export const buildingUnlocked = (s: GameState, kind: BuildingKind): boolean => !s.progression ||
  unlockedRows(s).some((r) => r.buildings.includes(kind)) ||
  (defs().buildings[kind]?.office === true && (systemUnlocked(s, "disasters") || systemUnlocked(s, "collusion"))) ||
  (levelOf(s) >= 4 && s.flags[`unlocked:${kind}`] !== undefined);
/**
 * The systems that are content packs with their own state, and the `?<id>=off` flag that keeps each one asleep.
 * Earning a system on the ladder switches its pack on (FLT-37); in table order, so collusion finds Leapfrog awake.
 */
const PACKS: readonly { id: SystemId; enable: (s: GameState) => void; off: string }[] = [
  { id: "leapfrog", enable: enableLeapfrog, off: "leapfrogOff" },
  { id: "papers", enable: enablePapers, off: "papersOff" },
  { id: "collusion", enable: enableCollusion, off: "collusionOff" },
  { id: "hearing", enable: enableHearing, off: "hearingOff" },
  { id: "yacht", enable: enableYacht, off: "yachtOff" },
  { id: "defection", enable: enableDefection, off: "defectionOff" },
  { id: "poaching", enable: enablePoaching, off: "poachingOff" },
  { id: "auditors", enable: enableAuditors, off: "auditorsOff" },
  { id: "promises", enable: enablePromises, off: "promisesOff" },
  { id: "capture", enable: enableCapture, off: "captureOff" },
  { id: "factions", enable: enableFactions, off: "factionsOff" },
  { id: "birdapp", enable: enableBirdApp, off: "birdappOff" },
];
/** The flags behind `?leapfrog=off`, `?papers=off`, `?collusion=off`, `?hearing=off`, `?yacht=off`, `?defection=off`, `?poaching=off`, `?auditors=off`, `?promises=off`, `?capture=off`, `?factions=off` and `?birdapp=off`. */
export const PACK_OFF_FLAGS = PACKS.map((p) => p.off);
function enablePacks(s: GameState, systems: readonly SystemId[]) {
  for (const pack of PACKS) if (systems.includes(pack.id) && !s.flags[pack.off]) pack.enable(s);
}
/**
 * Switch on the pack of every system the run has already earned: a new game whose first rung lists one (a mod can
 * move a system down the ladder), a campus or scenario that starts with the ladder complete, or a debug run with no
 * ladder at all (everything earned).
 */
export function enableEarnedPacks(s: GameState) {
  enablePacks(s, s.progression ? unlockedRows(s).flatMap((r) => [...r.systems]) : rows(s).flatMap((r) => [...r.systems]));
}
/** Days after Level 3 opens that the first thing breaks, so the SRE has a reason to exist (FLT-58). */
export const FIRST_BREAKDOWN_DAYS = 3;
/** And the day after it opens, the first slop (sim/slop.ts `firstSpill`), so the Janitor Bot does too. */
export const FIRST_SPILL_DAYS = 1;
const staffed = (s: GameState, job: StaffJob) => s.staff.some((w) => w.job === job && w.machine.value !== "leaving" && w.machine.value !== "gone");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function goalValue(s: GameState) {
  const goal = rows(s).find((r) => r.level === levelOf(s))!.goal;
  switch (goal.metric) {
    case "business": {
      const served = s.flags.visitorsServed ?? 0;
      const visitors = goal.visitors ?? 0;
      const status = `${formatMoney(s.ledger.income)} of ${formatMoney(goal.target)} a day · ${Math.min(served, visitors)} of ${visitors} visitors`;
      // One number for the bar: each half of the goal is worth half of it.
      const current = Math.round(goal.target * (Math.min(1, s.ledger.income / goal.target) + (visitors > 0 ? Math.min(1, served / visitors) : 1)) / 2);
      return { goal, current, status, met: s.ledger.income >= goal.target && served >= visitors };
    }
    case "ops": {
      // Keep it clean and running: the people who do it on the payroll, the puddles mopped, and nothing left broken.
      const mopped = s.flags.mopped ?? 0;
      const fixed = (s.flags.repaired ?? 0) > 0 && !s.buildings.some((b) => b.broken);
      const hires = [staffed(s, "sre") ? "SRE ✓" : "SRE ✗", staffed(s, "janitor") ? "Janitor ✓" : "Janitor ✗", fixed ? "fixed ✓" : "fixed ✗"].join(" · ");
      return { goal, current: mopped, status: `${hires} · ${Math.min(mopped, goal.target)} of ${plural(goal.target, "puddle", "puddles")}`, met: mopped >= goal.target && fixed && staffed(s, "sre") && staffed(s, "janitor") };
    }
    case "arena": {
      const current = s.race.rank;
      return { goal, current, status: `#${current} now`, met: current > 0 && current <= goal.target };
    }
    case "revenue":
      return { goal, current: s.ledger.income, status: `${formatMoney(s.ledger.income)} of ${formatMoney(goal.target)} a day`, met: s.ledger.income >= goal.target };
    default: {
      const current = goal.metric === "models" ? s.models.length : s.walkers.filter((w) => w.kind === "researcher" && w.machine.value !== "quitting").length;
      return { goal, current, status: `${Math.min(current, goal.target)} of ${goal.target}`, met: current >= goal.target && (goal.vibes === undefined || s.vibes.value >= goal.vibes) };
    }
  }
}
export function progressOf(s: GameState): ProgressView {
  const level = levelOf(s);
  const active = rows(s).find((r) => r.level === level)!;
  const { current, met, status } = goalValue(s);
  return { level, levelName: active.name,
    unlocked: { buildings: [...new Set([...unlockedRows(s).flatMap((r) => [...r.buildings]), ...defs().buildingKinds.filter((k) => level >= 4 && s.flags[`unlocked:${k}`] !== undefined) as BuildingKind[]])], staff: unlockedRows(s).flatMap((r) => [...r.staff]), systems: unlockedRows(s).flatMap((r) => [...r.systems]) },
    goal: met && !rows(s).some((r) => r.level > level) ? afterLadder(s)
      : { text: active.goal.text, current: active.goal.metric === "arena" ? current : Math.min(current, active.goal.target), target: active.goal.target, status, ...(active.goal.metric === "arena" ? { lowerIsBetter: true } : {}) },
    teasers: teasers(s, level),
  };
}
/** Past the last rung, with its goal met, the note names the first scenario objective still open; nothing if none is (FLT-48). */
function afterLadder(s: GameState): ProgressView["goal"] {
  const open = s.goals.context.goals.find((g) => !g.met);
  const def = open && defs().goals.find((d) => d.id === open.id);
  return open && def ? { text: def.label, current: open.value, target: open.target, objective: def.id } : { text: "", current: 0, target: 1 };
}
/** What is still locked, one row per milestone that unlocks it ("2 more · Ship your first model"), not one "???" per item. */
function teasers(s: GameState, level: Level): ProgressView["teasers"] {
  const all = rows(s);
  return all.filter((r) => r.level > level).flatMap((r) => {
    const count = r.buildings.length + r.staff.length;
    const earnedBy = all.filter((p) => p.level < r.level).at(-1)!;
    return count === 0 ? [] : [{ label: `${count} more`, hint: earnedBy.goal.text }];
  });
}
export function visibleHud(s: GameState): { visible: Record<HudPanel, boolean> } {
  const panels = unlockedRows(s).flatMap((r) => [...r.panels]);
  return { visible: Object.fromEntries(HUD_PANELS.map((p) => [p, !s.progression || panels.includes(p)])) as Record<HudPanel, boolean> };
}
/**
 * One card per earned level, in order, even when several facts become true on one day. Checked every tick, so the goal line
 * moves on the tick a goal is met.
 */
export function updateProgression(s: GameState) {
  if (!s.progression || levelOf(s) === 5) return;
  const { met } = goalValue(s);
  // FLT-39: an unmet goal leaves the machine as it is and emits nothing (its CHECK returns at once), so the tick skips transition().
  if (!met) return;
  const result = step(progressionMachine, s.progression, { type: "CHECK", met });
  s.progression = result.stored;
  for (const event of result.effects) {
    const row = rows(s).find((r) => r.level === event.level)!;
    enablePacks(s, row.systems);
    // The Race: the field did not stand still while you were in the garage. You start behind most of it.
    if (row.systems.includes("arena")) seedField(s);
    if (row.systems.includes("breakdowns")) s.flags.firstBreakdownDay ??= s.day + FIRST_BREAKDOWN_DAYS;
    if (row.systems.includes("slop")) s.flags.firstSpillDay ??= s.day + FIRST_SPILL_DAYS;
    const items = [...row.buildings.map((k) => defs().buildings[k]?.name ?? k), ...row.staff.map((k) => STAFF[k].title), ...row.systems];
    s.unlockCards ??= [];
    s.unlockCards.push({ id: row.id, title: `New! ${row.name}`, body: row.goal.text, items });
  }
}
