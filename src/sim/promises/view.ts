// What the HUD reads about the Promise Tracker: the motion on the docket, what each senator promised, how they are
// leaning, what lobbying them costs, and their Truth-o-meter. Plain data; the skins never see the pack.
import { TICKS_PER_DAY } from "../constants";
import { fillTemplate } from "../format";
import type { GameState } from "../types";
import { labOdds, leaning, truthScore } from "./driver";
import { motionOf } from "./machine";
import { PROMISES, SENATORS, truthLabel, type Side } from "./pack";
import type { MotionResult, VoteRecord } from "./state";

export interface TrackerSenatorView {
  id: string;
  name: string;
  role: string;
  seat: string;
  look: { skin: string; suit: string; hair: string; tie: string; glasses: boolean };
  /** What they promised about the motion on the docket ("aye", "nay" or "both"), and the quote. */
  said: "aye" | "nay" | "both" | null;
  line: string;
  /** How they would vote today, and the odds (0 to 1) they vote the lab's way. */
  leaning: Side | null;
  odds: number;
  lobbied: boolean;
  fee: number;
  /** Truth-o-meter, 0 to 100 (null before any vote), and its label ("Pants Ablaze"). */
  truth: number | null;
  truthLabel: string;
  kept: number;
  broken: number;
  /** Their last votes, newest last. */
  log: VoteRecord[];
}
export interface PromisesView {
  enabled: boolean;
  /** "dormant", "recess", "campaign", "rollCall", "passed" or "failed". */
  stage: string;
  motion: { id: string; title: string; summary: string; labSide: Side } | null;
  /** Days until the roll call, while campaigning. */
  daysUntilVote: number | null;
  /** Lobbying is open (campaign or roll call). */
  lobbying: boolean;
  senators: TrackerSenatorView[];
  last: MotionResult | null;
  held: number;
}

const OFF: PromisesView = { enabled: false, stage: "dormant", motion: null, daysUntilVote: null, lobbying: false, senators: [], last: null, held: 0 };
const CAMPAIGN_DAYS = 5;

export function promisesView(s: GameState): PromisesView {
  const p = s.promises;
  if (!p?.enabled) return OFF;
  const stage = p.machine.value;
  const c = p.machine.context;
  const live = stage === "campaign" || stage === "rollCall";
  const m = live || stage === "passed" || stage === "failed" ? motionOf(c.motion, c.title) : undefined;
  return {
    enabled: true, stage,
    motion: m ? { id: m.id, title: m.title, summary: fillTemplate(m.summary, { lab: s.labName }), labSide: m.labSide } : null,
    daysUntilVote: stage === "campaign" ? Math.max(0, CAMPAIGN_DAYS - Math.floor((s.tick - c.enteredTick) / TICKS_PER_DAY)) : null,
    lobbying: live,
    senators: SENATORS.map((sen) => {
      const rec = c.records[sen.id] ?? { kept: 0, broken: 0, log: [] };
      const pledge = m?.promises[sen.id];
      const truth = truthScore(rec.kept, rec.broken);
      return {
        id: sen.id, name: sen.name, role: sen.role, seat: sen.seat, look: { ...sen.look },
        said: pledge?.says ?? null, line: pledge ? fillTemplate(pledge.line, { lab: s.labName, motion: m!.title }) : "",
        leaning: m && live ? leaning(s, m, sen.id, c.lobbied) : null,
        odds: m ? (c.lobbied.includes(sen.id) ? 1 : labOdds(s, m, sen.id)) : 0,
        lobbied: c.lobbied.includes(sen.id), fee: PROMISES.rules.senators[sen.id]?.lobby ?? 0,
        truth, truthLabel: truthLabel(truth), kept: rec.kept, broken: rec.broken, log: rec.log.map((r) => ({ ...r })),
      };
    }),
    last: p.last ? { ...p.last, lobbied: [...p.last.lobbied] } : null,
    held: c.held,
  };
}
