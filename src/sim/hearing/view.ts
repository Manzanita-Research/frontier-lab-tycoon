// What the HUD reads about The Hearing: the witness table as it stands. Plain data; the skins never see the pack.
import type { GameState } from "../types";
import { TICKS_PER_DAY } from "../constants";
import { HEARING, isVerdict, NOTICE_DAYS, type SenatorData } from "./pack";

export interface HearingOptionView { key: string; trust: number; capture: number; hype: number; heat: number }
export interface HearingView {
  enabled: boolean;
  /** "quiet", "summoned", "inSession", or the verdict ("viral", "captured", "commended", "grilled"). */
  stage: string;
  topic: string;
  /** The two meters, 0 to 100: public trust (the Vocabulary's `trust`) and regulatory capture. */
  trust: number;
  capture: number;
  labels: { trust: string; capture: string };
  senators: (SenatorData & { asking: boolean; answered: string | null })[];
  asked: number;
  total: number;
  /** The question on the table: whose it is and what each answer would move. */
  current: { card: string; senator: string; options: HearingOptionView[] } | null;
  session: { trust: number; capture: number; chaos: number };
  verdict: { id: string; title: string; line: string } | null;
  /** Days until the lab testifies, while summoned. */
  daysUntil: number | null;
  hearings: number;
}

const OFF: HearingView = {
  enabled: false, stage: "quiet", topic: "", trust: 50, capture: 0, labels: { trust: "Trust", capture: "Capture" }, senators: [], asked: 0, total: 0,
  current: null, session: { trust: 0, capture: 0, chaos: 0 }, verdict: null, daysUntil: null, hearings: 0,
};

export function hearingView(s: GameState): HearingView {
  const h = s.hearing;
  if (!h?.enabled) return OFF;
  const R = HEARING.rules;
  const c = h.machine.context;
  const stage = h.machine.value;
  const askingId = stage === "inSession" ? c.docket[c.answers.length] : undefined;
  const asking = askingId ? R.questions[askingId] : undefined;
  return {
    enabled: true, stage, topic: c.topic,
    trust: s.disasters.trust, capture: s.capture ?? 0,
    labels: { trust: R.meters.trustLabel, capture: R.meters.captureLabel },
    senators: R.senators.map((sen) => {
      const i = c.docket.findIndex((id) => R.questions[id]?.senator === sen.id);
      return { ...sen, look: { ...sen.look }, asking: asking?.senator === sen.id, answered: i >= 0 ? c.answers[i] ?? null : null };
    }),
    asked: c.answers.length, total: c.docket.length,
    current: askingId && asking ? { card: askingId, senator: asking.senator, options: Object.entries(asking.answers).map(([key, a]) => ({ key, ...a })) } : null,
    session: { trust: c.sessionTrust, capture: c.sessionCapture, chaos: c.chaos },
    verdict: isVerdict(stage) ? { id: stage, ...R.verdicts[stage]! } : null,
    daysUntil: stage === "summoned" ? Math.max(0, NOTICE_DAYS - Math.floor((s.tick - c.enteredTick) / TICKS_PER_DAY)) : null,
    hearings: h.history.length,
  };
}
