// The report card's arithmetic: facts about the lab, weighed by the pack's rubric. Pure; no dice.
import { AUDITORS, GRADES, type Grade } from "./pack";
import type { AuditGradeRow } from "./state";
import type { AuditContext } from "./machine";
import type { AuditorNote, GameState } from "../types";

const R = AUDITORS.rules;
const count = (s: GameState, kind: string) => s.buildings.filter((b) => b.kind === kind && !b.broken).length;
const crew = (s: GameState, job: string) => s.staff.filter((o) => o.job === job && o.machine.value !== "leaving").length;

/** Everything a rubric term may name. The pack's `terms[].fact` must be one of these keys. */
export function auditFacts(s: GameState, ctx: Pick<AuditContext, "prep" | "caught" | "swarm" | "evals">): Record<string, number> {
  const agents = s.walkers.filter((w) => w.kind === "agent");
  return {
    security: crew(s, "security"),
    sre: crew(s, "sre"),
    office: s.buildings.some((b) => b.kind === "security") ? 1 : 0,
    broken: s.buildings.filter((b) => b.broken).length,
    disasters: s.disasters.runs.length,
    drift: agents.length ? agents.reduce((n, w) => n + w.drift, 0) / agents.length : 0,
    prep: ctx.prep === "prep" ? 1 : 0,
    tidy: ctx.prep === "tidy" && !ctx.caught ? 1 : 0,
    caught: ctx.caught ? 1 : 0,
    swarm: ctx.swarm ? 1 : 0,
    evals: ctx.evals ? 1 : 0,
    invalid: (s.collusion?.invalidUntil ?? 0) > s.day ? 1 : 0,
    vibes: s.vibes.value / 9.99,
    discourse: s.waterDiscourse,
    gas: count(s, "gas"),
    solar: count(s, "solar"),
    datacenters: count(s, "datacenter"),
    clusters: count(s, "cluster"),
  };
}

export function gradeOf(score: number): Grade {
  for (const b of R.bands) if (score >= b.min) return b.grade;
  return "F";
}
const worse = (a: Grade, b: Grade): Grade => (GRADES.indexOf(a) >= GRADES.indexOf(b) ? a : b);

export function scoreCategory(facts: Record<string, number>, cat: (typeof R.rubric)[number]): number {
  let score = cat.base;
  for (const t of cat.terms) {
    const v = (facts[t.fact] ?? 0) * t.per;
    score += t.max === undefined ? v : Math.sign(v) * Math.min(Math.abs(v), t.max);
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** The notes on the lab's file since the last visit (the Vocabulary's `auditor.note`; FLT-22's exposed bill files one). */
export function notesSince(s: GameState): AuditorNote[] {
  const last = s.auditors?.history.at(-1)?.day ?? -1;
  return (s.auditorNotes ?? []).filter((n) => n.day > last);
}

/**
 * A score moved `amount` grades (+ up, - down), just into the new band: B's 78 down one is C's 69, up one is A's 85.
 * FLT-52 joins FLT-22's notes to FLT-19's rubric here.
 */
function shiftScore(score: number, amount: number): number {
  const i = Math.max(0, Math.min(R.bands.length - 1, R.bands.findIndex((b) => score >= b.min) - amount));
  if (amount < 0) return Math.min(score, i === 0 ? 100 : R.bands[i - 1]!.min - 1);
  return Math.max(score, R.bands[i]!.min);
}

/** Grades, the overall grade and what the card does to trust, heat and hype. `notes` move a grade and give its remark. */
export function gradeReport(facts: Record<string, number>, notes: readonly AuditorNote[] = []) {
  const caught = facts.caught! > 0;
  const swarm = facts.swarm! > 0;
  const grades: AuditGradeRow[] = R.rubric.map((cat) => {
    const mine = notes.filter((n) => n.grade === cat.id);
    const amount = mine.reduce((n, x) => n + x.amount, 0);
    const score = amount ? shiftScore(scoreCategory(facts, cat), amount) : scoreCategory(facts, cat);
    const grade = gradeOf(score);
    const noted = mine.at(-1)?.text;
    const comment = cat.id === "honesty" && caught ? R.caught.comment : cat.id === "honesty" && swarm ? R.swarm.comment : noted ?? cat.comments[grade];
    return { id: cat.id, label: cat.label, score, grade, comment };
  });
  const average = Math.round(grades.reduce((n, g) => n + g.score, 0) / Math.max(1, grades.length));
  const overall = caught ? worse(gradeOf(average), R.caught.cap) : gradeOf(average);
  const moves = { trust: 0, heat: 0, hype: 0 };
  for (const g of grades) for (const k of ["trust", "heat", "hype"] as const) moves[k] += R.moves[g.grade][k];
  if (caught) for (const k of ["trust", "heat", "hype"] as const) moves[k] += R.caught[k];
  return { grades, average, overall, moves };
}
