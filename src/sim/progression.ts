import { enableLeapfrog } from "./race/leapfrog/driver";
import { enablePapers } from "./race/papers/driver";
import { seedField } from "./race/arena";
import { formatMoney } from "./format";
import { BUILDINGS, type BuildingKind } from "../content/buildings";
import { STAFF } from "../content/staff";
import { HUD_PANELS, PROGRESSION, type HudPanel, type Level, type ProgressView, type SystemId } from "../content/progression";
import { progressionMachine } from "./machines/progression";
import { step } from "./machines/run";
import type { GameState, StaffJob } from "./types";

type ProgressState = Pick<GameState, "progression" | "progressionContent">;
const rows = (s: ProgressState) => s.progressionContent ?? PROGRESSION;
export const levelOf = (s: ProgressState): Level => (s.progression?.context.level ?? 5) as Level;
const unlockedRows = (s: ProgressState) => rows(s).filter((r) => r.level <= levelOf(s));
export const systemUnlocked = (s: ProgressState, id: SystemId): boolean => !s.progression || unlockedRows(s).some((r) => r.systems.includes(id));
export const staffUnlocked = (s: GameState, job: StaffJob): boolean => !s.progression || unlockedRows(s).some((r) => r.staff.includes(job));
// Offices are hidden infrastructure created by incident verbs, not palette unlocks.
export const buildingUnlocked = (s: GameState, kind: BuildingKind): boolean => !s.progression ||
  unlockedRows(s).some((r) => r.buildings.includes(kind)) ||
  (BUILDINGS[kind].office === true && (systemUnlocked(s, "disasters") || systemUnlocked(s, "collusion"))) ||
  (levelOf(s) >= 4 && s.flags[`unlocked:${kind}`] !== undefined);
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
  const { current, status } = goalValue(s);
  return { level, levelName: active.name,
    unlocked: { buildings: [...new Set([...unlockedRows(s).flatMap((r) => [...r.buildings]), ...Object.keys(BUILDINGS).filter((k) => level >= 4 && s.flags[`unlocked:${k}`] !== undefined) as BuildingKind[]])], staff: unlockedRows(s).flatMap((r) => [...r.staff]), systems: unlockedRows(s).flatMap((r) => [...r.systems]) },
    goal: { text: active.goal.text, current: active.goal.metric === "arena" ? current : Math.min(current, active.goal.target), target: active.goal.target, status, ...(active.goal.metric === "arena" ? { lowerIsBetter: true } : {}) },
    teasers: teasers(s, level),
  };
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
  const result = step(progressionMachine, s.progression, { type: "CHECK", met: goalValue(s).met });
  s.progression = result.stored;
  for (const event of result.effects) {
    const row = rows(s).find((r) => r.level === event.level)!;
    if (row.systems.includes("leapfrog") && !s.flags.leapfrogOff) enableLeapfrog(s);
    if (row.systems.includes("papers") && !s.flags.papersOff) enablePapers(s);
    // The Race: the field did not stand still while you were in the garage. You start behind most of it.
    if (row.systems.includes("arena")) seedField(s);
    if (row.systems.includes("breakdowns")) s.flags.firstBreakdownDay ??= s.day + FIRST_BREAKDOWN_DAYS;
    if (row.systems.includes("slop")) s.flags.firstSpillDay ??= s.day + FIRST_SPILL_DAYS;
    const items = [...row.buildings.map((k) => BUILDINGS[k].name), ...row.staff.map((k) => STAFF[k].title), ...row.systems];
    s.unlockCards ??= [];
    s.unlockCards.push({ id: row.id, title: `New! ${row.name}`, body: row.goal.text, items });
  }
}
