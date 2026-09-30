// The Promise Tracker's machine: the pack's chart (dormant → recess → campaign → rollCall → passed | failed → recess),
// compiled by the Circus chart compiler, plus the Senate's arithmetic. The fold takes the motion the driver puts on the
// docket, a lobbyist's visit (a CHOSE "lobby:<senator>": the fee, capture and heat as verbs), and the counted roll call
// (the driver rolls the votes): each senator's record, promises kept and broken. No dice here.
import { compileChart, type CallOut, type Fold } from "../circus/chart";
import { BILL_MOTION, motionById, PROMISES, SENATORS, type MotionLike } from "./pack";
import type { PromisesContext, PromisesStored, SenatorRecord } from "./state";

const R = PROMISES.rules;
/** How many votes a senator's log keeps. */
const LOG = 8;

/** The stats the promises chart measures itself: the driver's `tabled`, the fold's `counted` and `ayes`. */
export const PROMISES_STATS = ["tabled", "counted", "ayes"] as const;

/** A motion by id: one of the pack's, or the bill (FLT-22) under the title it was tabled with. */
export function motionOf(id: string, title = ""): MotionLike | undefined {
  if (id === BILL_MOTION) return { ...R.bill, id, title: title || R.bill.title };
  return motionById(id);
}

const fold: Fold<PromisesContext> = (ctx, beat, stage) => {
  let next = ctx;
  const calls: CallOut[] = [];
  const d = beat.data;
  if (beat.type === "DAY" && stage === "recess" && d && typeof d.motion === "string") {
    next = { ...ctx, motion: d.motion, title: String(d.title ?? ""), lobbied: [], votes: {}, ayes: 0 };
  }
  if (beat.type === "CHOSE" && (stage === "campaign" || stage === "rollCall") && beat.choice?.startsWith("lobby:")) {
    const who = beat.choice.slice("lobby:".length);
    const fee = R.senators[who]?.lobby;
    if (fee !== undefined && !next.lobbied.includes(who)) {
      next = { ...next, lobbied: [...next.lobbied, who] };
      calls.push({ verb: "cash.delta", params: { amount: -fee } });
      if (R.lobby.capture) calls.push({ verb: "capture.delta", params: { amount: R.lobby.capture } });
      if (R.lobby.heat) calls.push({ verb: "heat.delta", params: { amount: R.lobby.heat } });
    }
  }
  let counted = 0;
  const m = motionOf(next.motion, next.title);
  if (beat.type === "DAY" && stage === "rollCall" && m && d && typeof d.votes === "object" && d.votes !== null && !Array.isArray(d.votes)) {
    const votes: Record<string, string> = {};
    const records: Record<string, SenatorRecord> = { ...next.records };
    let ayes = 0;
    for (const sen of SENATORS) {
      const voted: "aye" | "nay" = d.votes[sen.id] === "aye" ? "aye" : "nay";
      votes[sen.id] = voted;
      if (voted === "aye") ayes++;
      const said = m.promises[sen.id]!.says;
      const kept = said === "both" || said === voted;
      const was = records[sen.id] ?? { kept: 0, broken: 0, log: [] };
      const log = [...was.log, { motion: m.id, title: m.title, day: beat.day, said, voted, kept, lobbied: next.lobbied.includes(sen.id) }].slice(-LOG);
      records[sen.id] = { kept: was.kept + (kept ? 1 : 0), broken: was.broken + (kept ? 0 : 1), log };
    }
    next = { ...next, votes, ayes, records, held: next.held + 1 };
    counted = 1;
  }
  return { ctx: next, calls, stats: { counted, ayes: next.ayes } };
};

export const promisesChart = compileChart<PromisesContext>(PROMISES.chart, fold);
export const freshPromises = (tick = 0): PromisesStored =>
  promisesChart.fresh({ enteredTick: tick, motion: "", title: "", lobbied: [], votes: {}, ayes: 0, records: {}, held: 0 });
export const stepPromises = promisesChart.step;
