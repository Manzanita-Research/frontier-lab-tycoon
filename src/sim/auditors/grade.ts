// The report card's arithmetic: facts about the lab, weighed by the pack's rubric. Pure; no dice.
import { AUDITORS, GRADES, type Grade } from "./pack";
import type { AuditGradeRow } from "./state";
import type { AuditContext } from "./machine";
import type { GameState } from "../types";

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

/** Grades, the overall grade and what the card does to trust, heat and hype. */
export function gradeReport(facts: Record<string, number>) {
  const caught = facts.caught! > 0;
  const swarm = facts.swarm! > 0;
  const grades: AuditGradeRow[] = R.rubric.map((cat) => {
    const score = scoreCategory(facts, cat);
    const grade = gradeOf(score);
    const comment = cat.id === "honesty" && caught ? R.caught.comment : cat.id === "honesty" && swarm ? R.swarm.comment : cat.comments[grade];
    return { id: cat.id, label: cat.label, score, grade, comment };
  });
  const average = Math.round(grades.reduce((n, g) => n + g.score, 0) / Math.max(1, grades.length));
  const overall = caught ? worse(gradeOf(average), R.caught.cap) : gradeOf(average);
  const moves = { trust: 0, heat: 0, hype: 0 };
  for (const g of grades) for (const k of ["trust", "heat", "hype"] as const) moves[k] += R.moves[g.grade][k];
  if (caught) for (const k of ["trust", "heat", "hype"] as const) moves[k] += R.caught[k];
  return { grades, average, overall, moves };
}
