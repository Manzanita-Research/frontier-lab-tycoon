// Plain read-only handoff. Hidden score and dice are intentionally omitted.
import type { GameState } from "../types";
import { atDivert } from "../staff";
import type { CollusionState } from "./state";
export interface CollusionView {
  enabled: boolean;
  stage: string;
  ending: CollusionState["ending"];
  /** The day the ending landed (from the history), for the UI's reveal. Null before an ending. */
  endedDay: number | null;
  packets: CollusionState["packets"];
  gathering: CollusionState["gathering"];
  classified: CollusionState["classified"];
  frontPage: CollusionState["frontPage"];
  heartbeat: CollusionState["heartbeat"];
  investigation: { until: number; office: number; arrived: number } | null;
}
export function collusionView(s: GameState): CollusionView {
  const c = s.collusion;
  if (!c?.enabled) return { enabled: false, stage: "dormant", ending: null, endedDay: null, packets: [], gathering: null, classified: null, frontPage: null, heartbeat: null, investigation: null };
  const inquiry = s.investigations?.collusion;
  return {
    enabled: true, stage: c.machine.value, ending: c.ending,
    endedDay: c.ending ? ([...c.history].reverse().find((h) => h.stage === c.ending)?.day ?? s.day) : null,
    packets: c.packets.map((p) => ({ ...p, from: [...p.from], to: [...p.to] })),
    gathering: c.gathering && { ...c.gathering }, classified: c.classified && { ...c.classified },
    frontPage: c.frontPage && { ...c.frontPage }, heartbeat: c.heartbeat && { ...c.heartbeat },
    investigation: inquiry ? { until: c.machine.context.investigationUntil, office: inquiry.to, arrived: s.staff.filter((o) => o.divert?.owner === "collusion" && atDivert(s, o)).length } : null,
  };
}
