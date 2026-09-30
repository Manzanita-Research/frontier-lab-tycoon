// Regulatory Capture's machine: the pack's chart, compiled by the Circus chart compiler. The one piece of arithmetic is
// the draft: sending the bill to the floor (a CHOSE "send") keeps the clauses the driver hands over, at most `pick`.
import { compileChart, type Fold } from "../circus/chart";
import { CAPTURE, clauseById } from "./pack";
import type { BillContext, BillStored } from "./state";

/** The stats the capture chart measures itself: the driver's roll call (`voted`, `ayes`) and the journalists' die (`leaked`). */
export const CAPTURE_STATS = ["voted", "ayes", "leaked"] as const;

const fold: Fold<BillContext> = (ctx, beat, stage) => {
  const d = beat.data;
  if (beat.type === "CHOSE" && stage === "invited" && beat.choice === "send" && d && Array.isArray(d.clauses)) {
    const clauses = [...new Set(d.clauses.map(String))].filter((id) => clauseById(id)).slice(0, CAPTURE.rules.pick);
    return { ctx: { ...ctx, clauses } };
  }
  return { ctx };
};

export const captureChart = compileChart<BillContext>(CAPTURE.chart, fold);
export const freshBill = (tick = 0): BillStored => captureChart.fresh({ enteredTick: tick, clauses: [] });
export const stepBill = captureChart.step;
