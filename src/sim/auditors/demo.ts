// Staged moments for links and screenshots (`?moment=audit-*`; FLT-56 adds audit-huddle and audit-graded), through the same chart, cards and ticks as play.
// No renderer or UI dependencies. Works on any campus; `?scenario=midgame` gives the auditors the most to look at.
import { TICKS_PER_DAY } from "../constants";
import { dailyEvents, openEventOf, unpaced } from "../events";
import { TICKS_PER_HOUR } from "../daylight";
import { dwellProgress, groupKind, groupsOf } from "../groups";
import { doorPoint } from "../pathfind";
import { answer, readyForPressure } from "../testkit";
import { applyNow, tick } from "../tick";
import type { GameState } from "../types";
import { dailyAuditors, enableAuditors } from "./driver";
import { freshAudit } from "./machine";
import { NOTICE_CARD, OWNER, REPORT_CARD, REPORT_CHOICES } from "./pack";

export const AUDIT_MOMENTS = ["audit-notice", "audit-tidy", "audit-visit", "audit-evals", "audit-huddle", "audit-report", "audit-caught", "audit-graded"] as const;
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
  unpaced(s);
  // Cards need a campus past the opening (day 40, a model, a gateway); a thin `?warp=` campus gets the minimum.
  if (!s.progression) readyForPressure(s);
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
  if (moment === "audit-report" || moment === "audit-caught" || moment === "audit-graded") {
    const caught = moment === "audit-caught";
    // The tour is over (nobody on campus); the next DAY beat publishes the card.
    a.machine = { value: "visit", context: { ...fresh, prep: caught ? "tidy" : "prep", visitDay: s.day - 20, inspected: 4, caught: caught ? 1 : 0, evals: 1 } };
    a.inspected = s.buildings.map((b) => b.kind).filter((k, i, all) => all.indexOf(k) === i && k !== "fountain").slice(0, 3).concat("hall");
    if (caught) s.flags["auditors:caught"] = s.day;
    dailyAuditors(s);
    openCard(s, REPORT_CARD);
    if (moment !== "audit-graded") return;
    // FLT-56: the card answered and a couple of days on: the plaque is up by the gate and the visitors have heard.
    applyNow(s, answer(s, REPORT_CHOICES.indexOf("frame")));
    for (let i = 0; i < 2 * TICKS_PER_DAY; i++) tick(s, answer(s));
    return;
  }
  // A tour: the countdown is up; they come in through the gate on the next DAY beat, then we walk them to the moment.
  const prep = moment === "audit-tidy" ? "tidy" : "prep";
  if (prep === "tidy") s.disguises = { agent: "box" };
  a.machine = { value: "countdown", context: { ...fresh, prep, enteredTick: s.tick - 7 * TICKS_PER_DAY } };
  dailyAuditors(s);
  const ready = (w: GameState) => {
    const g = groupsOf(w, OWNER)[0];
    if (!g) return true;
    const dwell = dwellProgress(g) ?? 0;
    // The huddle (FLT-56): once the ring has closed.
    if (moment === "audit-huddle") return g.machine.value === "huddling" && g.timer <= Math.round((groupKind(g.kind)?.route.huddleHours ?? 1) * TICKS_PER_HOUR) - 8;
    return moment === "audit-evals" ? g.machine.value === "evaluating" && dwell >= 0.45 : g.machine.value === "inspecting" && dwell >= 0.35;
  };
  // Rehearse on a copy for a stop whose door faces the default camera (it looks in from +x/+z), so the auditors are not
  // standing behind the building they are inspecting; then play the real World that many ticks. Same dice, same ticks.
  const facing = (w: GameState) => {
    const g = groupsOf(w, OWNER)[0];
    const b = g && w.buildings.find((x) => x.id === g.stops[g.at]?.building);
    const door = b && doorPoint(w, b);
    return !b || !door || door[0] + door[1] > b.x + b.w / 2 + b.z + b.d / 2;
  };
  const copy = structuredClone(s);
  let first = -1;
  let best = -1;
  for (let i = 0; i < 4000 && best < 0 && groupsOf(copy, OWNER)[0]; i++) {
    if (ready(copy)) {
      if (first < 0) first = i;
      if (facing(copy)) best = i;
    }
    tick(copy, answer(copy));
  }
  const n = best >= 0 ? best : first >= 0 ? first : 4000;
  for (let i = 0; i < n; i++) tick(s, answer(s));
}
