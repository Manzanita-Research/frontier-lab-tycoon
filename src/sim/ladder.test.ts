// The ladder's pace (FLT-58), headless: the journey test's sensible player (e2e/journey.mjs) from the real opening, one
// purchase a game day at most, keeping $1M in the bank. Each level must take between LEVEL_WINDOW days and ask for
// something the level before did not: the Level 2 goal needs a visitor building, Level 3 needs a hire, Level 4 a model.
import { BUILDINGS, type PlaceableKind } from "../content/buildings";
import { eventById } from "../content/events";
import { canPlace, type Command } from "./commands";
import { coachOf } from "./coach";
import { openEventOf } from "./events";
import { pendingConfirmOf } from "./guardrails";
import { levelOf, staffUnlocked, buildingUnlocked } from "./progression";
import { createInitialState } from "./state";
import { slopStats } from "./slop";
import { applyNow, TICKS_PER_DAY, tick } from "./tick";
import type { GameState, StaffJob } from "./types";

/** Game days a level may take for the journey's player: long enough to be a level, short enough not to be a wall. */
export const LEVEL_WINDOW: Record<number, [number, number]> = { 2: [5, 25], 3: [5, 40], 4: [5, 40], 5: [5, 45] };

const RESERVE = 1_000_000;
/** What the sensible player wants at each level, as totals; hires are "staff:<job>". Mirrors e2e/journey.mjs. */
export const WANTS: Record<number, [string, number][]> = {
  2: [["gateway", 1], ["kombucha", 1], ["gateway", 2], ["kombucha", 2], ["cluster", 2]],
  3: [["staff:sre", 1], ["staff:janitor", 1], ["snack", 1], ["staff:janitor", 2], ["hall", 2], ["nap", 1], ["cluster", 3]],
  4: [["cluster", 4], ["gateway", 3], ["cluster", 5], ["hall", 3], ["cluster", 6]],
  5: [["staff:security", 1], ["staff:comms", 1], ["demo", 1]],
};
const ROADS: [number, number][] = [
  ...[18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((z) => [11, z] as [number, number]),
  ...[14, 10, 6].flatMap((z) => [...[10, 9, 8, 7, 6, 5, 4, 3, 2], ...[12, 13, 14, 15, 16, 17, 18, 19, 20, 21]].map((x) => [x, z] as [number, number])),
];

function spot(s: GameState, kind: PlaceableKind): [number, number] | null {
  for (let z = 21; z >= 2; z--) for (let x = 2; x <= 20; x++) if (canPlace(s, kind, x, z).ok) return [x, z];
  return null;
}

/** The player's one move today, or nothing. */
function act(s: GameState): Command[] {
  const level = levelOf(s);
  const have = (k: string) => (k.startsWith("staff:") ? s.staff.filter((w) => w.job === k.slice(6)).length : s.buildings.filter((b) => b.kind === k).length);
  for (const [kind, count] of [...(WANTS[level] ?? []), ...(WANTS[level - 1] ?? [])]) {
    if (have(kind) >= count) continue;
    if (kind.startsWith("staff:")) {
      const job = kind.slice(6) as StaffJob;
      if (!staffUnlocked(s, job)) continue;
      return [{ type: "hire", job }];
    }
    const k = kind as PlaceableKind;
    if (!buildingUnlocked(s, k)) continue;
    if (s.cash < BUILDINGS[k].price + RESERVE) return [];
    const at = spot(s, k);
    if (at) return [{ type: "placeBuilding", kind: k, x: at[0], z: at[1] }];
    const todo = ROADS.filter(([x, z]) => canPlace(s, "path", x, z).ok).slice(0, 4);
    return todo.map(([x, z]) => ({ type: "placePath", x, z }));
  }
  return [];
}

/** A sensible answer: the cheapest bid you can afford at an auction, the first choice elsewhere. */
function choose(id: string): number {
  const def = eventById(id)!;
  if (id === "computeAuction") return 0;
  return def.choices.length > 1 && /decline|pass|no/i.test(def.choices[0]!.label) ? 1 : 0;
}

export interface LadderReport {
  seed: number;
  /** The game day each level was reached (index = level). */
  days: (number | null)[];
  firstModelDay: number | null;
  models: number[];
  cash: number;
  /** Every tenth day: what the goal is waiting for. */
  trace: string[];
}

export function playLadder(seed: number, maxDays = 220): LadderReport {
  const s = createInitialState(seed);
  // The coach's opening: the suggested path from the gate and a Training Hall beside it.
  applyNow(s, [{ type: "buildPanelOpened" }, ...[18, 17, 16, 15].map((z) => ({ type: "placePath" as const, x: 11, z }))]);
  const hall = coachOf(s)?.suggest;
  applyNow(s, [{ type: "placeBuilding", kind: "hall", x: hall?.kind === "building" ? hall.x : 12, z: hall?.kind === "building" ? hall.z : 16 }]);
  const days: (number | null)[] = [null, 0, null, null, null, null];
  const models: number[] = [];
  const trace: string[] = [];
  let firstModelDay: number | null = null;
  for (let i = 0; i < maxDays * TICKS_PER_DAY && levelOf(s) < 5; i++) {
    let cmds: Command[] = [];
    const pending = pendingConfirmOf(s);
    const open = openEventOf(s);
    if (pending) cmds = [s.cash >= pending.cost + RESERVE ? { ...pending.command, confirmed: true } : { type: "cancelConfirm" }];
    else if (open) cmds = [{ type: "chooseEvent", eventId: open.id, choiceIndex: choose(open.id) }];
    else if (s.unlockCards?.length) cmds = [{ type: "dismissUnlock" }];
    else if (i % TICKS_PER_DAY === 5) cmds = act(s);
    const before = levelOf(s);
    const shipped = s.models.length;
    tick(s, cmds);
    if (s.models.length > shipped) models.push(s.day);
    if (firstModelDay === null && s.models.length > 0) firstModelDay = s.day;
    if (levelOf(s) > before) days[levelOf(s)] = s.day;
    if (i % (TICKS_PER_DAY * 10) === 0) trace.push(`d${s.day} L${levelOf(s)} $${Math.round(s.cash / 1e3)}K inc${s.ledger.income} served${s.flags.visitorsServed ?? 0} vis${s.walkers.filter((w) => w.kind === "visitor").length} fix${s.flags.repaired ?? 0} mop${s.flags.mopped ?? 0} ag${s.walkers.filter((w) => w.kind === "agent").length} slop${Math.round(slopStats(s).share * 100)}% rank${s.race.rank} b:${s.buildings.map((b) => b.kind[0] + (b.broken ? "!" : "")).join("")} st:${s.staff.map((w) => w.job[0]).join("")}`);
  }
  return { seed, days, firstModelDay, models, cash: s.cash, trace };
}

describe("the ladder's pace (FLT-58)", () => {
  it.each([1, 2, 3])("each level takes its window of game days (seed %i)", (seed) => {
    const r = playLadder(seed);
    console.log(JSON.stringify({ ...r, trace: undefined }) + "\n" + r.trace.join("\n"));
    for (let level = 2; level <= 5; level++) {
      const at = r.days[level];
      expect(at, `level ${level} reached`).not.toBeNull();
      const took = at! - r.days[level - 1]!;
      const [lo, hi] = LEVEL_WINDOW[level]!;
      expect(took, `level ${level - 1} → ${level} took ${took} days`).toBeGreaterThanOrEqual(lo);
      expect(took, `level ${level - 1} → ${level} took ${took} days`).toBeLessThanOrEqual(hi);
    }
  });
});
