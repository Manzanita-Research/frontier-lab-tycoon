// What the HUD reads about the auditors: where the visit is, where the group is standing, and the last report card.
// Plain JSON for the snapshot; the pin's screen position is the renderer's (it follows the leader every frame).
import { BUILDINGS } from "../../content/buildings";
import { dwellProgress, groupsOf } from "../groups";
import type { GameState } from "../types";
import { daysUntilVisit } from "./driver";
import { OWNER, type Prep } from "./pack";
import type { AuditReport, AuditStage } from "./state";

export interface AuditView {
  enabled: boolean;
  stage: AuditStage;
  prep: Prep | null;
  /** Days until they arrive, during the countdown. */
  daysLeft: number | null;
  /** Auditors on campus, and their names. */
  visitors: number;
  names: string[];
  /** The group's phase: walking, inspecting, evaluating or leaving (null when nobody is here). */
  phase: string | null;
  /** The stop they are at (or walking to): its kind and whether it is the evals stop. */
  stop: { building: number; kind: string; name: string; evals: boolean } | null;
  /** How far through this stop (0 to 1), while they stand at one. */
  progress: number | null;
  /** Stops finished, and the whole plan. */
  done: number;
  stops: number;
  /** Agents are in boxes (Tidy up). */
  boxed: boolean;
  report: AuditReport | null;
  visits: number;
}

export const NO_AUDIT: AuditView = {
  enabled: false, stage: "quiet", prep: null, daysLeft: null, visitors: 0, names: [], phase: null, stop: null, progress: null,
  done: 0, stops: 0, boxed: false, report: null, visits: 0,
};

const nameOf = (kind: string) => (BUILDINGS as Record<string, { name: string } | undefined>)[kind]?.name ?? kind;

export function auditView(s: GameState): AuditView {
  const a = s.auditors;
  if (!a?.enabled) return NO_AUDIT;
  const ctx = a.machine.context;
  const g = groupsOf(s, OWNER).find((x) => x.machine.value !== "gone");
  const stop = g?.stops[g.at];
  return {
    enabled: true,
    stage: a.machine.value,
    prep: (ctx.prep || null) as Prep | null,
    daysLeft: daysUntilVisit(s),
    visitors: g?.members.length ?? 0,
    names: g?.members.map((m) => m.name) ?? [],
    phase: g ? g.machine.value : null,
    stop: stop && g!.machine.value !== "leaving" ? { building: stop.building, kind: stop.kind, name: nameOf(stop.kind), evals: stop.evals } : null,
    progress: g ? dwellProgress(g) : null,
    done: a.inspected.length,
    stops: g?.stops.length ?? 0,
    boxed: s.disguises?.agent === "box",
    report: a.report,
    visits: ctx.visits,
  };
}
