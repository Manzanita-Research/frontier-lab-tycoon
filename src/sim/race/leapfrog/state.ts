// Release Leapfrog's slice of the World (FLT-27). Plain JSON, like everything in GameState. Five machines (the release
// calendar, the benchmarks, the news cycle, the forced response and the launch livestream) plus the little bookkeeping
// they share. Off by default in `createInitialState`; `enableLeapfrog` is the "pack loaded" switch (FLT-15's loader will
// flip it from the mod list).
import { LEAPFROG, type BenchmarkDef } from "../../../content/leapfrog";
import { RIVAL_DEFS, YOU } from "../../../content/rivals";
import { initialStored } from "../../machines/run";
import type { GameState } from "../../types";
import { benchMachine, type BenchStored } from "./benchmark";
import { calendarMachine, type CalendarStored } from "./calendar";
import { livestreamMachine, type LivestreamStored } from "./livestream";
import { responseMachine, type ResponseStored } from "./response";
import { voiceMachine, type VoiceStored } from "./voice";

/** A finished model waiting for its launch date, one per lab (a newer one adds to it). */
export interface PendingLaunch {
  id: string;
  model: string;
  /** Capability it adds when it ships, and the hype the launch earns. */
  gain: number;
  hype: number;
  open: boolean;
  /** The day it finished training. */
  since: number;
}

/** One SOTA claim: `maxx` means the lab tuned for it (a custom prompt, best of 64). */
export interface Claim {
  bench: string;
  lab: string;
  score: number;
  prev: number;
  prevHolder: string;
  maxx: boolean;
}

/** A launch: a lead drop or its day-after answer. */
export interface DropRecord {
  day: number;
  slot: "lead" | "answer";
  lab: string;
  model: string;
  /** The lab this one answers (answers only), or "". */
  lead: string;
  claims: Claim[];
}

/** What a lab's row on the leaderboard carries beyond its capability. */
export interface LabClaims {
  /** Benchmaxxed scores by benchmark id, held until the lab's next launch (or until the real ones land). */
  maxx: Record<string, number>;
  /** The benchmark whose screenshot you leaked, or "". */
  leaked: string;
  /** The row flashes until this day. */
  flash: number;
  /** Capability a point release paid out ahead of the lab's next finished model: taken off that model's gain, so a lab's growth is the same however often it launches. */
  advance: number;
}

export interface BenchEntry {
  def: BenchmarkDef;
  machine: BenchStored;
}

export interface LeapfrogStats {
  /** SOTA claims made, and how many were benchmaxxed. */
  sota: number;
  maxxed: number;
  /** Benchmarks declared solved, and when. */
  solved: { id: string; day: number }[];
  /** Times a lab took the news cycle. */
  owned: number;
}

export interface LeapfrogState {
  /** The pack is loaded. Everything below sleeps until it is: no dice are drawn and nothing changes. */
  enabled: boolean;
  calendar: CalendarStored;
  response: ResponseStored;
  livestream: LivestreamStored;
  voice: VoiceStored;
  /** Benchmarks in the order they joined: the live ones, the solved ones and the retired. */
  benchmarks: BenchEntry[];
  /** Finished models waiting for a launch date. */
  queue: PendingLaunch[];
  /** By lab id, yours is "you". */
  labs: Record<string, LabClaims>;
  /** How many of your models the driver has already seen, to tell when a run finished. */
  modelsSeen: number;
  /** "Ship now" ships a preview and the run carries on: what the preview paid out is taken off the full release, and the full release lands quieter. */
  credit: number;
  previewed: boolean;
  /** 0 to 100: how much the world believes your screenshots. Starts at 70. */
  trust: number;
  /** The latest launch, and the last twelve. */
  last: DropRecord | null;
  log: DropRecord[];
  stats: LeapfrogStats;
}

const R = LEAPFROG.rules;

export const benchStored = (def: BenchmarkDef, day: number): BenchStored =>
  initialStored(benchMachine, {
    id: def.id,
    best: 0,
    holder: "",
    introduced: day,
    crowdedAt: def.kind === "elo" ? 1e9 : R.benchmarks.crowdedAt,
    solvedAt: def.kind === "elo" ? 1e9 : R.benchmarks.solvedAt,
    retireAfter: R.benchmarks.retireAfterDays,
    solvedDay: -1,
    claims: 0,
  });

/** What each lab gets every day: the floor of the news cycle. */
export const baselineOf = (hype: number): number => R.voice.baseline + R.voice.baselinePerHype * hype;

export function createLeapfrog(): LeapfrogState {
  const ids = [YOU, ...RIVAL_DEFS.map((d) => d.id)];
  const labs: Record<string, LabClaims> = {};
  for (const id of ids) labs[id] = { maxx: {}, leaked: "", flash: -1, advance: 0 };
  // Everyone starts at the level their hype would settle at, so the first days aren't a jump.
  const attention: Record<string, number> = { [YOU]: baselineOf(30) / (1 - R.voice.decay) };
  for (const d of RIVAL_DEFS) attention[d.id] = baselineOf(d.startHype) / (1 - R.voice.decay);
  const c = R.cadence;
  return {
    enabled: false,
    calendar: initialStored(calendarMachine, { daysLeft: c.firstDropDay, gapMin: c.gapMin, gapMax: c.gapMax, minGap: c.minGapDays, leads: 0, answers: 0 }),
    response: initialStored(responseMachine, { lastOffer: -999, holdUntil: 0, offers: 0, ships: 0, holds: 0, leaks: 0, counters: 0 }),
    livestream: initialStored(livestreamMachine, { since: -1, streams: 0, mishaps: 0, kind: "" }),
    voice: initialStored(voiceMachine, { attention, owner: "", streak: 0 }),
    benchmarks: LEAPFROG.starters.map((def) => ({ def, machine: benchStored(def, 0) })),
    queue: [],
    labs,
    modelsSeen: 0,
    credit: 0,
    previewed: false,
    trust: R.trust.start,
    last: null,
    log: [],
    stats: { sota: 0, maxxed: 0, solved: [], owned: 0 },
  };
}

export const leapfrogOn = (state: GameState): boolean => state.leapfrog.enabled;
