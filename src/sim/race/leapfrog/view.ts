// What the HUD reads about Release Leapfrog: the benchmark leaderboard, the share-of-voice meter and the launch that
// just happened, as a small plain snapshot rebuilt with each publish (about 5 Hz). No panels are drawn from it yet
// (FLT-31 does that); the World's `race.board` (the Frontier Arena) stays as it was.
import type { LabKind } from "../../../content/leapfrog";
import { LEAPFROG, BENCH_BY_ID } from "../../../content/leapfrog";
import { RIVAL_BY_ID, YOU, type RivalId } from "../../../content/rivals";
import type { GameState } from "../../types";
import { honestScore, shownScore } from "./driver";
import { labIds, nameOf } from "./ops";
import { bugChance, readiness, shipGains } from "./vars";
import { sharesOf } from "./voice";

export interface BenchColumn {
  id: string;
  name: string;
  short: string;
  kind: "score" | "elo";
  /** live: open. crowded: a photo finish at the ceiling. saturated: declared solved (the column is about to retire). */
  status: "live" | "crowded" | "saturated";
  best: number;
  holder: string;
  /** Joined the leaderboard within the last four days. */
  isNew: boolean;
}

export interface LeaderRow {
  id: string;
  name: string;
  short: string;
  color: string;
  you: boolean;
  kind: LabKind | "you";
  /** Their latest model ("" if they have no product). */
  model: string;
  /** One entry per column in `benchmarks`, in the same order; null when there is no product to score. */
  scores: (number | null)[];
  /** They hold the record in this column, and that record was tuned for (benchmaxxed or leaked): show an asterisk. */
  sota: boolean[];
  maxx: boolean[];
  /** How many columns they lead. */
  wins: number;
  /** They launched in the last two days: the row flashes. */
  flash: boolean;
}

export interface VoiceShare {
  id: string;
  name: string;
  color: string;
  /** 0 to 1; everyone's add up to 1. */
  share: number;
  you: boolean;
}

export interface LeapfrogView {
  enabled: boolean;
  benchmarks: BenchColumn[];
  /** Best (most columns led, then the higher Arena Elo) first. */
  rows: LeaderRow[];
  voice: { shares: VoiceShare[]; owner: string; ownerName: string; streak: number; yours: number };
  /** 0 to 100. */
  trust: number;
  /** The latest launch, with the records it claimed. */
  drop: {
    day: number;
    daysAgo: number;
    slot: "lead" | "answer";
    lab: string;
    name: string;
    model: string;
    lead: string;
    claims: { bench: string; name: string; short: string; score: number; prev: number; maxx: boolean }[];
  } | null;
  /** The calendar: days to the next lead drop, and whether an answer is due tomorrow. */
  next: { days: number; answering: boolean };
  /** The forced response: idle, a card is due, or you are holding for a counter-launch. */
  response: { state: "idle" | "offered" | "holding"; holdDaysLeft: number; ready: number; ship: number; hold: number; bug: number };
  stats: { drops: number; leads: number; answers: number; sota: number; maxxed: number; solved: number; owned: number; streams: number; mishaps: number };
}

const colorOf = (id: string): string => (id === YOU ? "#ff8a4c" : (RIVAL_BY_ID[id as RivalId]?.color ?? "#888"));

const OFF: LeapfrogView = {
  enabled: false,
  benchmarks: [],
  rows: [],
  voice: { shares: [], owner: "", ownerName: "", streak: 0, yours: 0 },
  trust: 0,
  drop: null,
  next: { days: 0, answering: false },
  response: { state: "idle", holdDaysLeft: 0, ready: 0, ship: 0, hold: 0, bug: 0 },
  stats: { drops: 0, leads: 0, answers: 0, sota: 0, maxxed: 0, solved: 0, owned: 0, streams: 0, mishaps: 0 },
};

export function leapfrogView(state: GameState): LeapfrogView {
  const lf = state.leapfrog;
  if (!lf.enabled) return OFF;
  const open = lf.benchmarks.filter((e) => e.machine.value !== "retired");
  const benchmarks: BenchColumn[] = open.map((e) => ({
    id: e.def.id,
    name: e.def.name,
    short: e.def.short,
    kind: e.def.kind,
    status: e.machine.value === "saturated" ? "saturated" : e.machine.value === "crowded" ? "crowded" : "live",
    best: e.machine.context.best,
    holder: e.machine.context.holder,
    isNew: state.day - e.machine.context.introduced < 4 && e.machine.context.introduced > 0,
  }));

  const rows: LeaderRow[] = labIds(state).map((id) => {
    const product = id === YOU || RIVAL_BY_ID[id as RivalId]?.models != null;
    const claims = lf.labs[id]!;
    const scores = open.map((e) => (product ? shownScore(state, id, e.def) : null));
    const maxx = open.map((e) => product && claims.maxx[e.def.id] !== undefined && claims.maxx[e.def.id]! > (honestScore(state, id, e.def) ?? 0) + 1e-9);
    const sota = open.map((e) => e.machine.context.holder === id && e.machine.value !== "saturated");
    const model =
      id === YOU ? (state.models[state.models.length - 1] ?? "") : (RIVAL_BY_ID[id as RivalId].models ? (state.race.rivals.find((r) => r.context.id === id)!.context.model || `${RIVAL_BY_ID[id as RivalId].models!.base} (current)`) : "");
    return {
      id,
      name: nameOf(state, id),
      short: id === YOU ? state.labName : RIVAL_BY_ID[id as RivalId].short,
      color: colorOf(id),
      you: id === YOU,
      kind: id === YOU ? "you" : (LEAPFROG.labs[id]?.kind ?? "frontier"),
      model,
      scores,
      sota,
      maxx,
      wins: sota.filter(Boolean).length,
      flash: state.day <= claims.flash,
    };
  });
  const arena = open.findIndex((e) => e.def.kind === "elo");
  rows.sort((a, b) => b.wins - a.wins || (arena >= 0 ? (b.scores[arena] ?? -1) - (a.scores[arena] ?? -1) : 0) || (a.id < b.id ? -1 : 1));

  const voice = lf.voice.context;
  const shares = sharesOf(voice).map((s) => ({ id: s.id, name: nameOf(state, s.id), color: colorOf(s.id), share: s.share, you: s.id === YOU }));
  const last = lf.last;
  const gains = shipGains(state);
  const ready = readiness(state);
  return {
    enabled: true,
    benchmarks,
    rows,
    voice: { shares, owner: voice.owner, ownerName: voice.owner ? nameOf(state, voice.owner) : "", streak: voice.streak, yours: shares.find((s) => s.you)?.share ?? 0 },
    trust: lf.trust,
    drop: last && {
      day: last.day,
      daysAgo: state.day - last.day,
      slot: last.slot,
      lab: last.lab,
      name: nameOf(state, last.lab),
      model: last.model,
      lead: last.lead,
      claims: last.claims.map((c) => ({ bench: c.bench, name: BENCH_BY_ID[c.bench]?.name ?? c.bench, short: BENCH_BY_ID[c.bench]?.short ?? c.bench, score: c.score, prev: c.prev, maxx: c.maxx })),
    },
    next: { days: lf.calendar.context.daysLeft, answering: lf.calendar.value === "answering" },
    response: {
      state: lf.response.value as "idle" | "offered" | "holding",
      holdDaysLeft: lf.response.value === "holding" ? Math.max(0, lf.response.context.holdUntil - state.day) : 0,
      ready,
      ship: gains.ship,
      hold: gains.hold,
      bug: bugChance(ready),
    },
    stats: {
      drops: lf.calendar.context.leads + lf.calendar.context.answers,
      leads: lf.calendar.context.leads,
      answers: lf.calendar.context.answers,
      sota: lf.stats.sota,
      maxxed: lf.stats.maxxed,
      solved: lf.stats.solved.length,
      owned: lf.stats.owned,
      streams: lf.livestream.context.streams,
      mishaps: lf.livestream.context.mishaps,
    },
  };
}
