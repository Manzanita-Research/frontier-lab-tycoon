import type { AuditStored } from "./machine";
import type { Grade, Prep } from "./pack";

export type AuditStage = "quiet" | "notice" | "countdown" | "visit" | "report";
export interface AuditGradeRow { id: string; label: string; score: number; grade: Grade; comment: string }
/** The last published report card: what the ReportCard slot and the front page show. */
export interface AuditReport {
  day: number;
  /** Visit number, 1 for the first. */
  visit: number;
  prep: Prep | null;
  grades: AuditGradeRow[];
  average: number;
  overall: Grade;
  /** Found hiding (Tidy up went wrong). */
  caught: boolean;
  /** Found the Swarm (FLT-18). */
  swarm: boolean;
  /** Building kinds they inspected, in order. */
  inspected: string[];
  /** They finished their own evals. */
  evals: boolean;
  moves: { trust: number; heat: number; hype: number };
  headline: string;
}
export interface AuditorsState {
  enabled: boolean;
  /** Its own random stream: a lab that never sees an auditor draws exactly the numbers it did before. */
  rngState: number;
  machine: AuditStored;
  report: AuditReport | null;
  /** Persistent front-page hook, independent of the ticker's retention. */
  frontPage: { day: number; title: string; grade: Grade } | null;
  history: { day: number; overall: Grade; caught: boolean }[];
  /** Building kinds this visit has inspected so far, in order. */
  inspected: string[];
  /** Presentation bookkeeping for the visit: the group phase last seen, and the next chat tick. */
  seenPhase: string;
  chatTick: number;
}
