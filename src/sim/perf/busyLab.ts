// FLT-39: the busiest lab the tick budget has to carry, and a stopwatch that times every system in the tick.
// Test and report code, not game code: nothing in the sim imports it.
import type { BuildingKind } from "../../content/buildings";
import type { StaffJob } from "../types";
import { applyNow, setTickProbe, tick } from "../tick";
import { answer, createTestCampus, readyForPressure } from "../testkit";
import { createRng } from "../rng";
import { enableEarnedPacks } from "../progression";
import { enableEndings } from "../endings/state";
import { fillAgents, seedWalkers } from "../walkers";
import { syncProtesters } from "../protest";
import { settleFactions } from "../factions/driver";
import { groupKind, spawnGroup } from "../groups";
import { OWNER as AUDITORS } from "../auditors/pack";
import type { GameState, Walker } from "../types";

const count = (s: GameState, kind: Walker["kind"]) => s.walkers.filter((w) => w.kind === kind).length;

/** Where the extra buildings go: beside the cross path along z = 16, as in the Crowd's own 800-walker test. */
const SPOTS: [BuildingKind, number, number][] = [["nap", 6, 17], ["snack", 9, 17], ["demo", 14, 17]];
const HIRES: StaffJob[] = ["janitor", "janitor", "sre", "sre", "comms", "security"];

export interface BusyLab {
  s: GameState;
  /** Refill the crowd (visitors leave and unhappy researchers quit): before each timed batch. */
  topUp: () => void;
  /** One tick, answering every card: the first choice, but The Memo as the lab was told to. */
  play: () => void;
}

/**
 * 800+ walkers on the test campus with the ladder complete, so every system is earned and every pack is awake:
 * 400 agents, 300 researchers fighting over three small buildings, 110 visitors, 40 protesters, the factions marching at
 * a fast lab's pace, six staff, a rogue swarm loose and Evals Without Borders on a tour. The endings are on, and in Era 4
 * The Memo gets `memo`'s answer: Slow Down starts Regulated, whose chart then runs every tick; Race, with the lab ahead in
 * the Arena, starts the Takeover, whose autopilot builds a new building every day or so until the campus is full.
 */
export function busyLab(seed = 1, memo: "race" | "slow" = "slow"): BusyLab {
  const s = createTestCampus(seed);
  s.cash = 1_000_000_000;
  applyNow(s, SPOTS.map(([kind, x, z]) => ({ type: "placeBuilding" as const, kind, x, z })));
  readyForPressure(s);
  s.progression = { value: "complete", context: { level: 5 } };
  enableEarnedPacks(s);
  enableEndings(s);
  const rng = createRng(11);
  s.capability = 4000; // agentTarget caps at 400
  fillAgents(s, rng);
  s.waterDiscourse = 160;
  s.factions!.pace = 3;
  settleFactions(s);
  syncProtesters(s, rng, true);
  applyNow(s, HIRES.map((job) => ({ type: "hire" as const, job, confirmed: true })));
  applyNow(s, [{ type: "disaster", id: "rogueSwarm" }]);
  spawnGroup(s, groupKind("auditor")!, AUDITORS, rng);
  const topUp = () => {
    seedWalkers(s, "researcher", Math.max(0, 300 - count(s, "researcher")), rng);
    seedWalkers(s, "visitor", Math.max(0, 110 - count(s, "visitor")), rng);
    s.cash = Math.max(s.cash, 100_000_000);
  };
  topUp();
  const pick = (id: string) => (id === "memo" ? (memo === "race" ? 0 : 1) : 0);
  return { s, topUp, play: () => tick(s, answer(s, pick)) };
}

export interface SystemTiming {
  system: string;
  /** Ticks it ran in (the daily systems: one in TICKS_PER_DAY). */
  calls: number;
  /** Mean over every tick, µs: what it costs the budget. */
  meanUs: number;
  /** 95th percentile over every tick, µs. */
  p95Us: number;
  maxUs: number;
}

export interface TickProfile {
  ticks: number;
  /** Mean of the whole tick, µs, with the stopwatch running (it adds a little). */
  meanUs: number;
  p95Us: number;
  /** Every system, costliest first. */
  systems: SystemTiming[];
}

/** What the stopwatch saw: each tick's µs per system (a row per tick, a column per name). */
export interface Laps {
  names: string[];
  rows: Float64Array[];
  calls: Int32Array;
}

/** Play `ticks` ticks of the lab (topping it up each `batch` ticks) with the stopwatch on, and keep every lap. */
export function lapTicks({ topUp, play }: BusyLab, ticks: number, batch = 200): Laps {
  const names: string[] = [];
  const index = new Map<string, number>();
  let row = new Float64Array(64);
  const rows: Float64Array[] = [];
  const calls = new Int32Array(64);
  let last = 0;
  setTickProbe({
    start() {
      last = performance.now();
    },
    lap(system) {
      const now = performance.now();
      let i = index.get(system);
      if (i === undefined) {
        index.set(system, (i = names.length));
        names.push(system);
      }
      row[i]! += now - last;
      calls[i]!++;
      last = now;
    },
  });
  try {
    for (let t = 0; t < ticks; t++) {
      if (t % batch === 0) topUp();
      play();
      rows.push(row);
      row = new Float64Array(64);
    }
  } finally {
    setTickProbe(null);
  }
  return { names, rows, calls };
}

/** Total each system over the laps. */
function summarize({ names, rows, calls }: Laps): TickProfile {
  const ticks = rows.length;
  const p95 = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))]!;
  const us = (ms: number) => ms * 1000;
  const systems = names.map((system, i): SystemTiming => {
    const xs = rows.map((r) => r[i]!);
    return {
      system,
      calls: calls[i]!,
      meanUs: us(xs.reduce((a, b) => a + b, 0) / xs.length),
      p95Us: us(p95(xs)),
      maxUs: us(Math.max(...xs)),
    };
  });
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0));
  return {
    ticks,
    meanUs: us(totals.reduce((a, b) => a + b, 0) / ticks),
    p95Us: us(p95(totals)),
    systems: systems.sort((a, b) => b.meanUs - a.meanUs),
  };
}

/** Play `ticks` ticks of the lab (topping it up each `batch` ticks) with the stopwatch on, and total each system. */
export function profileTicks(lab: BusyLab, ticks: number, batch = 200): TickProfile {
  return summarize(lapTicks(lab, ticks, batch));
}

/**
 * FLT-111: each system's best mean over a few windows of the same kind (say, 200 ordinary ticks each). A garbage
 * collection or a busy neighbour on a shared CI runner lands in whichever system was running at the time, and in one
 * window, not all of them; a system that really got slower is slower in every window.
 */
export function bestOf(profiles: TickProfile[]): TickProfile {
  const best = new Map<string, SystemTiming>();
  for (const p of profiles) {
    for (const t of p.systems) {
      const b = best.get(t.system);
      best.set(t.system, b ? { ...b, meanUs: Math.min(b.meanUs, t.meanUs), p95Us: Math.min(b.p95Us, t.p95Us), maxUs: Math.min(b.maxUs, t.maxUs) } : t);
    }
  }
  return {
    ticks: profiles[0]!.ticks,
    meanUs: Math.min(...profiles.map((p) => p.meanUs)),
    p95Us: Math.min(...profiles.map((p) => p.p95Us)),
    systems: [...best.values()].sort((a, b) => b.meanUs - a.meanUs),
  };
}

/**
 * FLT-111: the best of a few passes over the same scene, tick by tick: each system's time on a pass's tick `t` is its
 * best over every pass's tick `t`. For a moment that comes once (a late lunch's worst hours), where a whole window's mean
 * is a handful of beats: one 1.6 ms collection charged to a 20-tick window's beat adds 80 µs to that system's mean. A
 * pause lands on a different tick each pass; a slower beat is slower on every pass. The passes must line up (each one
 * starts at the same moment of the scene), so the same tick does the same work.
 */
export function bestTicks(passes: Laps[]): TickProfile {
  const names = [...new Set(passes.flatMap((p) => p.names))];
  const ticks = Math.min(...passes.map((p) => p.rows.length));
  const calls = new Int32Array(Math.max(64, names.length));
  const rows = Array.from({ length: ticks }, () => new Float64Array(names.length).fill(Infinity));
  for (const p of passes) {
    names.forEach((name, i) => {
      const j = p.names.indexOf(name);
      calls[i] = Math.max(calls[i]!, j < 0 ? 0 : p.calls[j]!);
      for (let t = 0; t < ticks; t++) rows[t]![i] = Math.min(rows[t]![i]!, j < 0 ? 0 : p.rows[t]![j]!);
    });
  }
  return summarize({ names, rows, calls });
}

/** The table for the PR and `docs/ARCHITECTURE.md`. */
export function profileTable(p: TickProfile): string {
  const f = (x: number) => x.toFixed(1);
  return [
    "| System | Mean µs/tick | p95 µs | Max µs | Ticks it ran |",
    "|---|---:|---:|---:|---:|",
    ...p.systems.map((t) => `| ${t.system} | ${f(t.meanUs)} | ${f(t.p95Us)} | ${f(t.maxUs)} | ${t.calls}/${p.ticks} |`),
    `| **whole tick (stopwatch on)** | **${f(p.meanUs)}** | **${f(p.p95Us)}** | | |`,
  ].join("\n");
}

/** The strict number, measured like the Crowd's 800-walker test: best of `batches` x `ticks` ticks, the crowd topped up before each. */
export function timeTicks({ topUp, play }: BusyLab, batches = 3, ticks = 200): number {
  let best = Infinity;
  for (let b = 0; b < batches; b++) {
    topUp();
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) play();
    best = Math.min(best, (performance.now() - t0) / ticks);
  }
  return best;
}
