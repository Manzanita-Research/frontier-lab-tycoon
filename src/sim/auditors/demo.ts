// Staged moments for links and screenshots (`?moment=audit-*`), through the same chart, cards and ticks as play.
// No renderer or UI dependencies. Works on any campus; `?scenario=midgame` gives the auditors the most to look at.
import { TICKS_PER_DAY } from "../constants";
import { dailyEvents, openEventOf } from "../events";
import { dwellProgress, groupsOf } from "../groups";
import { answer } from "../testkit";
import { applyNow, tick } from "../tick";
import type { GameState } from "../types";
import { dailyAuditors, enableAuditors } from "./driver";
import { freshAudit } from "./machine";
import { NOTICE_CARD, OWNER, REPORT_CARD } from "./pack";

export const AUDIT_MOMENTS = ["audit-notice", "audit-tidy", "audit-visit", "audit-evals", "audit-report", "audit-caught"] as const;
export type AuditMoment = (typeof AUDIT_MOMENTS)[number];
export function isAuditMoment(value: string | null | undefined): value is AuditMoment {
  return (AUDIT_MOMENTS as readonly unknown[]).includes(value);
}

/** Open `card`, answering whatever else is queued first (so the moment shows our card, not another). */
function openCard(s: GameState, card: string) {
  for (let i = 0; i < 8 && openEventOf(s)?.id !== card; i++) {
    if (openEventOf(s)) applyNow(s, answer(s));
    else dailyEvents(s);
  }
}

export function stageAudit(s: GameState, moment: AuditMoment) {
  enableAuditors(s);
  const a = s.auditors!;
  const fresh = freshAudit().context;
  while (openEventOf(s)) applyNow(s, answer(s));
  if (moment === "audit-notice") {
    a.machine = { value: "notice", context: { ...fresh, nextDay: s.day } };
    s.flags[`offer:${NOTICE_CARD}`] = s.day;
    openCard(s, NOTICE_CARD);
    return;
  }
  if (moment === "audit-report" || moment === "audit-caught") {
    const caught = moment === "audit-caught";
    // The tour is over (nobody on campus); the next DAY beat publishes the card.
    a.machine = { value: "visit", context: { ...fresh, prep: caught ? "tidy" : "prep", visitDay: s.day - 20, inspected: 4, caught: caught ? 1 : 0, evals: 1 } };
    a.inspected = s.buildings.map((b) => b.kind).filter((k, i, all) => all.indexOf(k) === i && k !== "fountain").slice(0, 3).concat("hall");
    if (caught) s.flags["auditors:caught"] = s.day;
    dailyAuditors(s);
    openCard(s, REPORT_CARD);
    return;
  }
  // A tour: the countdown is up; they come in through the gate on the next DAY beat, then we walk them to the moment.
  const prep = moment === "audit-tidy" ? "tidy" : "prep";
  if (prep === "tidy") s.disguises = { agent: "box" };
  a.machine = { value: "countdown", context: { ...fresh, prep, enteredTick: s.tick - 7 * TICKS_PER_DAY } };
  dailyAuditors(s);
  const ready = () => {
    const g = groupsOf(s, OWNER)[0];
    if (!g) return true;
    const dwell = dwellProgress(g) ?? 0;
    return moment === "audit-evals" ? g.machine.value === "evaluating" && dwell >= 0.45 : g.machine.value === "inspecting" && dwell >= 0.35;
  };
  for (let i = 0; i < 4000 && !ready(); i++) tick(s, answer(s));
}
