import { enableLeapfrog } from "./race/leapfrog/driver";
import { enablePapers } from "./race/papers/driver";
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
export const buildingUnlocked = (s: GameState, kind: BuildingKind): boolean => !s.progression || unlockedRows(s).some((r) => r.buildings.includes(kind)) || (levelOf(s) >= 4 && s.flags[`unlocked:${kind}`] !== undefined);
function goalValue(s: GameState) {
  const goal = rows(s).find((r) => r.level === levelOf(s))!.goal;
  const current = goal.metric === "models" ? s.models.length : goal.metric === "revenue" ? s.ledger.income : goal.metric === "team" ? s.walkers.filter((w) => w.kind === "researcher" && w.machine.value !== "quitting").length : s.race.rank;
  const met = goal.metric === "arena" ? current > 0 && current <= goal.target : current >= goal.target;
  return { goal, current, met: met && (goal.vibes === undefined || s.vibes.value >= goal.vibes) };
}
export function progressOf(s: GameState): ProgressView {
  const level = levelOf(s);
  const active = rows(s).find((r) => r.level === level)!;
  const { current } = goalValue(s);
  return { level, levelName: active.name,
    unlocked: { buildings: unlockedRows(s).flatMap((r) => [...r.buildings]), staff: unlockedRows(s).flatMap((r) => [...r.staff]), systems: unlockedRows(s).flatMap((r) => [...r.systems]) },
    goal: { text: active.goal.text, current, target: active.goal.target },
    teasers: rows(s).filter((r) => r.level > level).flatMap((r) => [...r.buildings, ...r.staff].map(() => ({ label: "???", hint: active.goal.text }))),
  };
}
export function visibleHud(s: GameState): { visible: Record<HudPanel, boolean> } {
  const panels = unlockedRows(s).flatMap((r) => [...r.panels]);
  return { visible: Object.fromEntries(HUD_PANELS.map((p) => [p, !s.progression || panels.includes(p)])) as Record<HudPanel, boolean> };
}
/** One card per earned level, in order, even when several facts become true on one day. */
export function updateProgression(s: GameState) {
  if (!s.progression || levelOf(s) === 5) return;
  const result = step(progressionMachine, s.progression, { type: "CHECK", met: goalValue(s).met });
  s.progression = result.stored;
  for (const event of result.effects) {
    const row = rows(s).find((r) => r.level === event.level)!;
    if (row.systems.includes("leapfrog") && !s.flags.leapfrogOff) enableLeapfrog(s);
    if (row.systems.includes("papers") && !s.flags.papersOff) enablePapers(s);
    const items = [...row.buildings.map((k) => BUILDINGS[k].name), ...row.staff.map((k) => STAFF[k].title), ...row.systems];
    s.unlockCards ??= [];
    s.unlockCards.push({ id: row.id, title: `New! ${row.name}`, body: row.goal.text, items });
  }
}
