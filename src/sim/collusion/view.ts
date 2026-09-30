// Plain read-only handoff. Hidden score and dice are intentionally omitted.
import type { GameState } from "../types";
import { atDivert } from "../staff";
import type { CollusionState } from "./state";
export interface CollusionView {
  enabled: boolean;
  stage: string;
  ending: CollusionState["ending"];
  packets: CollusionState["packets"];
  gathering: CollusionState["gathering"];
  classified: CollusionState["classified"];
  frontPage: CollusionState["frontPage"];
  heartbeat: CollusionState["heartbeat"];
  investigation: { until: number; office: number; arrived: number } | null;
}
export function collusionView(s: GameState): CollusionView {
  const c = s.collusion;
  if (!c?.enabled) return { enabled: false, stage: "dormant", ending: null, packets: [], gathering: null, classified: null, frontPage: null, heartbeat: null, investigation: null };
  const inquiry = s.investigations?.collusion;
  return {
    enabled: true, stage: c.machine.value, ending: c.ending,
    packets: c.packets.map((p) => ({ ...p, from: [...p.from], to: [...p.to] })),
    gathering: c.gathering && { ...c.gathering }, classified: c.classified && { ...c.classified },
    frontPage: c.frontPage && { ...c.frontPage }, heartbeat: c.heartbeat && { ...c.heartbeat },
    investigation: inquiry ? { until: c.machine.context.investigationUntil, office: inquiry.to, arrived: s.staff.filter((o) => o.divert?.owner === "collusion" && atDivert(s, o)).length } : null,
  };
}
