import { enableLeapfrog } from "./race/leapfrog/driver";
import { enablePapers } from "./race/papers/driver";
import { enableAuditors } from "./auditors/driver";
import { enableCollusion } from "./collusion/driver";
import { enableDefection } from "./defection/driver";
import { enableHearing } from "./hearing/driver";
import { enablePoaching } from "./poaching/driver";
import { enableYacht } from "./yacht/driver";
import type { BuildingKind } from "../content/buildings";
import { STAFF } from "../content/staff";
import { HUD_PANELS, type HudPanel, type Level, type ProgressView, type SystemId } from "../content/progression";
import { progressionMachine } from "./machines/progression";
import { step } from "./machines/run";
import { defs } from "./defs";
import type { GameState, StaffJob } from "./types";

type ProgressState = Pick<GameState, "progression">;
// The ladder is content: a mod can retune a goal or move an unlock (FLT-37).
const rows = (_s: ProgressState) => defs().progression;
export const levelOf = (s: ProgressState): Level => (s.progression?.context.level ?? 5) as Level;
const unlockedRows = (s: ProgressState) => rows(s).filter((r) => r.level <= levelOf(s));
export const systemUnlocked = (s: ProgressState, id: SystemId): boolean => !s.progression || unlockedRows(s).some((r) => r.systems.includes(id));
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
];
/** The flags behind `?leapfrog=off`, `?papers=off`, `?collusion=off`, `?hearing=off`, `?yacht=off`, `?defection=off`, `?poaching=off` and `?auditors=off`. */
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
function goalValue(s: GameState) {
  const goal = rows(s).find((r) => r.level === levelOf(s))!.goal;
  const current = goal.metric === "models" ? s.models.length : goal.metric === "revenue" ? s.ledger.income : goal.metric === "team" ? s.walkers.filter((w) => w.kind === "researcher" && w.machine.value !== "quitting").length : s.race.rank;
  const met = goal.metric === "arena" ? current > 0 && current <= goal.target : current >= goal.target;
  return { goal, current, met: met && (goal.vibes === undefined || s.vibes.value >= goal.vibes) };
}
export function progressOf(s: GameState): ProgressView {
  const level = levelOf(s);
  const active = rows(s).find((r) => r.level === level)!;
  const { current, met } = goalValue(s);
  return { level, levelName: active.name,
    unlocked: { buildings: [...new Set([...unlockedRows(s).flatMap((r) => [...r.buildings]), ...defs().buildingKinds.filter((k) => level >= 4 && s.flags[`unlocked:${k}`] !== undefined) as BuildingKind[]])], staff: unlockedRows(s).flatMap((r) => [...r.staff]), systems: unlockedRows(s).flatMap((r) => [...r.systems]) },
    goal: met && !rows(s).some((r) => r.level > level) ? afterLadder(s) : { text: active.goal.text, current, target: active.goal.target },
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
/** One card per earned level, in order, even when several facts become true on one day. */
export function updateProgression(s: GameState) {
  if (!s.progression || levelOf(s) === 5) return;
  const result = step(progressionMachine, s.progression, { type: "CHECK", met: goalValue(s).met });
  s.progression = result.stored;
  for (const event of result.effects) {
    const row = rows(s).find((r) => r.level === event.level)!;
    enablePacks(s, row.systems);
    const items = [...row.buildings.map((k) => defs().buildings[k]?.name ?? k), ...row.staff.map((k) => STAFF[k].title), ...row.systems];
    s.unlockCards ??= [];
    s.unlockCards.push({ id: row.id, title: `New! ${row.name}`, body: row.goal.text, items });
  }
}
