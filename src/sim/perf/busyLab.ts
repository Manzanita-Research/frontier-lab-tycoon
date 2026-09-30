// FLT-39: the busiest lab the tick budget has to carry, and a stopwatch that times every system in the tick.
// Test and report code, not game code: nothing in the sim imports it.
import type { BuildingKind } from "../../content/buildings";
import type { StaffJob } from "../types";
import { applyNow, setTickProbe, tick } from "../tick";
import { answer, createTestCampus, readyForPressure } from "../testkit";
import { createRng } from "../rng";
import { enableEarnedPacks } from "../progression";
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

/**
 * 800+ walkers on the test campus with the ladder complete, so every system is earned and every pack is awake:
 * 400 agents, 300 researchers fighting over three small buildings, 110 visitors, 40 protesters, the factions marching at
 * a fast lab's pace, six staff, a rogue swarm loose and Evals Without Borders on a tour. `topUp` refills the crowd
 * (visitors leave and unhappy researchers quit) before each timed batch.
 */
export function busyLab(seed = 1): { s: GameState; topUp: () => void } {
  const s = createTestCampus(seed);
  s.cash = 1_000_000_000;
  applyNow(s, SPOTS.map(([kind, x, z]) => ({ type: "placeBuilding" as const, kind, x, z })));
  readyForPressure(s);
  s.progression = { value: "complete", context: { level: 5 } };
  enableEarnedPacks(s);
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
  return { s, topUp };
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

/** Run `ticks` ticks of `s` (answering every card, and calling `every` each `batch` ticks) with the stopwatch on, and total each system. */
export function profileTicks(s: GameState, ticks: number, every?: () => void, batch = 200): TickProfile {
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
      if (every && t % batch === 0) every();
      tick(s, answer(s));
      rows.push(row);
      row = new Float64Array(64);
    }
  } finally {
    setTickProbe(null);
  }
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
export function timeTicks(s: GameState, topUp: () => void, batches = 3, ticks = 200): number {
  let best = Infinity;
  for (let b = 0; b < batches; b++) {
    topUp();
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) tick(s, answer(s));
    best = Math.min(best, (performance.now() - t0) / ticks);
  }
  return best;
}
