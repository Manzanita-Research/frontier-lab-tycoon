// The hearing's machine: the pack's chart (quiet → summoned → inSession → a verdict → quiet), compiled by the Circus
// chart compiler, plus the session arithmetic. A CHOSE in session scores the answer from the pack's numbers and emits
// the meter verbs; the tallies are stats the verdict edges read. No dice: the driver rolls the docket.
import { compileChart, type Fold } from "../circus/chart";
import { ANSWER_KEYS, HEARING, type AnswerKey } from "./pack";
import type { HearingContext, HearingStored } from "./state";

const R = HEARING.rules;
const METERS = [["trust", "trust.delta"], ["capture", "capture.delta"], ["hype", "hype.delta"], ["heat", "heat.delta"]] as const;

/** The stats a hearing measures itself: the driver's `summons`, and the session tallies the fold adds. */
export const HEARING_STATS = ["summons", "done", "asked", "chaos", "sessionTrust", "sessionCapture"] as const;

const fold: Fold<HearingContext> = (ctx, beat, stage) => {
  let next = ctx;
  const calls: { verb: string; params: { amount: number } }[] = [];
  const d = beat.data;
  if (beat.type === "DAY" && stage === "quiet" && d && Array.isArray(d.docket)) {
    next = { ...ctx, topic: String(d.topic ?? ""), trigger: String(d.trigger ?? ""), docket: d.docket.map(String), answers: [], sessionTrust: 0, sessionCapture: 0, chaos: 0 };
  }
  if (beat.type === "CHOSE" && stage === "inSession" && next.answers.length < next.docket.length && (ANSWER_KEYS as readonly string[]).includes(beat.choice ?? "")) {
    const key = beat.choice as AnswerKey;
    const a = R.questions[next.docket[next.answers.length]!]?.answers[key];
    if (a) {
      next = { ...next, answers: [...next.answers, key], sessionTrust: next.sessionTrust + a.trust, sessionCapture: next.sessionCapture + a.capture, chaos: next.chaos + (key === "chaotic" ? 1 : 0) };
      for (const [field, verb] of METERS) if (a[field] !== 0) calls.push({ verb, params: { amount: a[field] } });
    }
  }
  const done = next.docket.length > 0 && next.answers.length >= next.docket.length ? 1 : 0;
  return { ctx: next, calls, stats: { done, asked: next.answers.length, chaos: next.chaos, sessionTrust: next.sessionTrust, sessionCapture: next.sessionCapture } };
};

export const hearingChart = compileChart<HearingContext>(HEARING.chart, fold);
export const freshHearing = (tick = 0): HearingStored => hearingChart.fresh({ enteredTick: tick, topic: "", trigger: "", docket: [], answers: [], sessionTrust: 0, sessionCapture: 0, chaos: 0 });
export const stepHearing = hearingChart.step;
