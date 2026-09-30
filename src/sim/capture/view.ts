// What the HUD reads about Regulatory Capture: the draft on the staffer's desk, the law in force and what it does to
// each rival, and the odds someone opens the file properties. Plain data; the skins never see the pack.
import type { RivalId } from "../../content/rivals";
import { defs } from "../defs";
import { TICKS_PER_DAY } from "../constants";
import { fillTemplate } from "../format";
import { rivalRules } from "../race/rules";
import type { GameState } from "../types";
import { buryCost, leakDaysLeft, leakOdds, projectedLeak } from "./driver";
import { CAPTURE } from "./pack";

export interface BillClauseView { id: string; title: string; legal: string; plain: string; effect: string; shame: number; on: boolean }
export interface BillRivalView { id: string; name: string; growth: number; pace: number; closed: boolean }
export interface CaptureView {
  enabled: boolean;
  /** "quiet", "invited", "declined", "floor", "failed", "law", "exposed", "fallout" or "sunset". */
  stage: string;
  act: string;
  /** Who the file properties say wrote it ("Acme Legal"), and who will read them. */
  author: string;
  reporter: string;
  /** The five clauses; `on` is ticked on the draft (while invited) or in the bill (after). */
  clauses: BillClauseView[];
  pick: number;
  /** Days the law has stood, while it stands. */
  lawDays: number | null;
  /** Ayes out of three at the last roll call on the bill. */
  ayes: number | null;
  /** Today's odds, 0 to 1, that journalists read the file properties. */
  leakOdds: number;
  /** FLT-56: the odds, 0 to 1, the file leaks before the sunset: for the draft as ticked, or the law's days left. */
  risk: number;
  /** FLT-56: the meter's label for `risk` ("Somebody will check"). */
  riskLabel: string;
  /** FLT-56: a reporter is asking: days until the story runs, and what burying it costs now. Null: nobody is. */
  warning: { daysLeft: number; cost: number } | null;
  /** FLT-56: times the lab has buried the story under this law. */
  buried: number;
  /** What the law does to each rival, while it stands (1 and false mean untouched). */
  rivals: BillRivalView[];
  history: { day: number; act: string; clauses: string[]; outcome: string }[];
}

const OFF: CaptureView = { enabled: false, stage: "quiet", act: "", author: "", reporter: "", clauses: [], pick: 2, lawDays: null, ayes: null, leakOdds: 0, risk: 0, riskLabel: "", warning: null, buried: 0, rivals: [], history: [] };

export function captureView(s: GameState): CaptureView {
  const b = s.bill;
  if (!b?.enabled) return OFF;
  const R = CAPTURE.rules;
  const stage = b.machine.value;
  const c = b.machine.context;
  const vars = { lab: s.labName, act: b.act };
  const on = stage === "invited" ? b.draft : c.clauses;
  const law = stage === "law";
  const risk = projectedLeak(s);
  const daysLeft = leakDaysLeft(s);
  return {
    enabled: true, stage, act: b.act, author: fillTemplate(R.author, vars), reporter: R.reporter,
    clauses: R.clauses.map((k) => ({ id: k.id, title: k.title, legal: fillTemplate(k.legal, vars), plain: fillTemplate(k.plain, vars), effect: k.effect, shame: k.shame, on: on.includes(k.id) })),
    pick: R.pick,
    lawDays: law ? Math.floor((s.tick - c.enteredTick) / TICKS_PER_DAY) : null,
    ayes: b.ayes,
    leakOdds: leakOdds(s),
    risk,
    riskLabel: R.warning.meter.find((m) => risk >= m.atLeast)?.label ?? "",
    warning: daysLeft === null ? null : { daysLeft, cost: buryCost(s) },
    buried: law ? (b.buried ?? 0) : 0,
    rivals: law ? s.race.rivals.map((r) => ({ id: r.context.id, name: defs().rivalById[r.context.id as RivalId]?.name ?? r.context.id, ...rivalRules(s, r.context) })) : [],
    history: b.history.map((h) => ({ ...h, clauses: [...h.clauses] })),
  };
}
