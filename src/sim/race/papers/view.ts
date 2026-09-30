import type { GameState } from "../../types";
import type { PublicationPolicy } from "./policy";
export function papersView(s: GameState) {
  const ps = s.papers;
  return {
    enabled: ps?.enabled ?? false,
    policy: (ps?.policy.value ?? "Selective") as PublicationPolicy,
    reputation: ps?.reputation ?? 0,
    recruitingPull: s.recruitingPull ?? 1,
    publishPressure: ps?.policy.context.publishPressure ?? 0,
    knowledgeSpill: ps?.knowledgeSpill ?? 0,
    papers: (ps?.list ?? []).map((p) => ({
      id: p.id, source: p.source, title: p.title, authors: p.authors, venue: p.venue, route: p.route,
      status: p.machine.value as "draft" | "review" | "published" | "criticized" | "awarded",
      importance: p.machine.context.importance, value: p.machine.context.value,
      citations: p.machine.context.citations, award: p.machine.context.award || null,
      submittedDay: p.machine.context.submittedDay, publishedDay: p.machine.context.publishedDay,
      dueDay: p.machine.context.dueDay,
      daysLeft: p.machine.value === "review" ? Math.max(0, (p.machine.context.dueDay ?? s.day) - s.day) : null,
      scoopedBy: p.machine.context.scoopedBy || null, scoopedDay: p.machine.context.scoopedDay,
    })),
  };
}
export type PapersView = ReturnType<typeof papersView>;
