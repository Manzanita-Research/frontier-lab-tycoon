// What the Staff panel and the world labels read (FLT-10): a small plain snapshot of the operations side of the World.
import type { BuildingKind } from "../content/buildings";
import { MAX_PER_JOB, STAFF, STAFF_JOBS } from "../content/staff";
import { slopStats } from "./slop";
import { canHire, payroll, statusOfStaff } from "./staff";
import type { GameState, StaffJob } from "./types";
import { defs } from "./defs";

export interface StaffRow {
  id: number;
  job: StaffJob;
  title: string;
  name: string;
  status: string;
  salary: number;
  /** Tiles in their patrol zone (0: the whole campus). */
  zone: number;
  done: number;
  leaving: boolean;
}

export interface JobRow {
  job: StaffJob;
  title: string;
  blurb: string;
  salary: number;
  count: number;
  max: number;
  canHire: boolean;
  reason: string;
}

export interface OpsView {
  staff: StaffRow[];
  /** Salaries per game day. */
  payroll: number;
  jobs: JobRow[];
  /** Whole percent of the path tiles that are slopped. */
  slopPct: number;
  slopTiles: number;
  /** Buildings out of order, and whether an SRE is on the way to each. */
  broken: { id: number; kind: BuildingKind; name: string; sre: boolean }[];
  /** People waiting outside each building with a line. */
  queues: { id: number; n: number }[];
}

export function opsView(s: GameState): OpsView {
  const stats = slopStats(s);
  const waiting = new Map<number, number>();
  for (const w of s.walkers) if (w.machine.value === "queuing") waiting.set(w.targetId, (waiting.get(w.targetId) ?? 0) + 1);
  return {
    staff: s.staff.map((o) => ({
      id: o.id,
      job: o.job,
      title: STAFF[o.job].title,
      name: o.name,
      status: statusOfStaff(s, o),
      salary: STAFF[o.job].salary,
      zone: o.zone.length,
      done: o.done,
      leaving: o.machine.value === "leaving",
    })),
    payroll: payroll(s),
    jobs: STAFF_JOBS.map((job) => {
      const can = canHire(s, job);
      return { job, title: STAFF[job].title, blurb: STAFF[job].blurb, salary: STAFF[job].salary, count: s.staff.filter((o) => o.job === job && o.machine.value !== "leaving").length, max: MAX_PER_JOB, canHire: can.ok, reason: can.ok ? "" : can.reason };
    }),
    slopPct: Math.round(stats.share * 100),
    slopTiles: stats.tiles,
    broken: s.buildings.filter((b) => b.broken).map((b) => ({ id: b.id, kind: b.kind, name: defs().buildings[b.kind].name, sre: s.staff.some((o) => o.job === "sre" && o.task === b.id && (o.machine.value === "going" || o.machine.value === "working")) })),
    queues: [...waiting].map(([id, n]) => ({ id, n })),
  };
}
