// The parts of Release Leapfrog's panels that live on the wall clock rather than the game's: a row that flashes for a few
// real seconds after its lab launches, a SOTA badge that blinks when a record changes hands, a solved benchmark that
// stays on the board (struck through, stamped SOLVED) after the sim has retired it, and the last sixty days of the
// news cycle for the traffic graph. At 10x a game day lasts a fifth of a second, so the sim's own two-day flash would
// be over before anyone saw it; this keeps it up for a moment of real time at every speed.
//
// Pure: `now` comes in from the caller, so it can be tested with a fake clock. `useLeapfrogMotion` (useHudVM.ts) is the
// thin hook that feeds it the snapshot and `performance.now()`.
import type { BenchColumn, LeapfrogView } from "../../sim/race/leapfrog/view";

/** How long a launch flashes a row and a new record blinks a badge, in real milliseconds. */
export const FLASH_MS = 4200;
/** How long a solved benchmark stays on the board after the sim has retired it. */
export const GHOST_MS = 24_000;
/** Game days of news-cycle history the traffic graph keeps. */
export const HISTORY_DAYS = 60;

export interface GhostCell {
  score: number | null;
  sota: boolean;
  maxx: boolean;
}

/** A retired benchmark, as it was on the board the last time it was there. */
export interface GhostColumn {
  column: BenchColumn;
  /** By lab id. */
  cells: Record<string, GhostCell>;
  until: number;
}

export interface VoiceSample {
  day: number;
  /** Everyone's share of the news cycle that day, by lab id. */
  shares: Record<string, number>;
}

/** What the view-model gets: the active flashes, the ghosts, the history. Same identity until something changes. */
export interface MotionView {
  flashRows: readonly string[];
  /** "labId|benchId" */
  flashCells: readonly string[];
  ghosts: readonly GhostColumn[];
  history: readonly VoiceSample[];
}

export interface Motion {
  seen: boolean;
  lastDay: number;
  wasFlashing: Record<string, boolean>;
  holders: Record<string, string>;
  known: Record<string, { column: BenchColumn; cells: Record<string, GhostCell> }>;
  flashRows: Record<string, number>;
  flashCells: Record<string, number>;
  ghosts: GhostColumn[];
  history: VoiceSample[];
  view: MotionView;
  sig: string;
}

export const NO_MOTION: MotionView = { flashRows: [], flashCells: [], ghosts: [], history: [] };

export const newMotion = (): Motion => ({ seen: false, lastDay: -1, wasFlashing: {}, holders: {}, known: {}, flashRows: {}, flashCells: {}, ghosts: [], history: [], view: NO_MOTION, sig: "" });

const reset = (m: Motion) => Object.assign(m, newMotion());

/**
 * Take one snapshot of the Leapfrog view (and the game day it was taken on) at real time `now`. Mutates `m` and returns
 * the view for the view-model: the previous object again when nothing visible changed, so memoised consumers stay put.
 */
export function stepMotion(m: Motion, lf: LeapfrogView, day: number, now: number): MotionView {
  if (!lf.enabled) {
    if (m.seen) reset(m);
    return NO_MOTION;
  }
  if (day < m.lastDay) reset(m); // a new lab
  const first = !m.seen;

  // A lab launched: its row flashes (a rising edge on the sim's own two-game-day flag, so every launch in a busy publish counts).
  for (const row of lf.rows) {
    if (row.flash && !m.wasFlashing[row.id] && !first) m.flashRows[row.id] = now + FLASH_MS;
    m.wasFlashing[row.id] = row.flash;
  }

  // A record changed hands: the new holder's badge blinks.
  for (const col of lf.benchmarks) {
    const before = m.holders[col.id];
    if (!first && before !== undefined && before !== col.holder && col.holder) m.flashCells[`${col.holder}|${col.id}`] = now + FLASH_MS;
    m.holders[col.id] = col.holder;
  }

  // A benchmark disappeared from the sim's board (retired three game days after being solved): keep it, struck through.
  const current = new Set(lf.benchmarks.map((b) => b.id));
  for (const [id, was] of Object.entries(m.known)) {
    if (current.has(id)) continue;
    m.ghosts.push({ column: { ...was.column, status: "saturated" }, cells: was.cells, until: now + GHOST_MS });
    delete m.known[id];
  }
  lf.benchmarks.forEach((column, k) => {
    const cells: Record<string, GhostCell> = {};
    for (const row of lf.rows) cells[row.id] = { score: row.scores[k] ?? null, sota: row.sota[k] ?? false, maxx: row.maxx[k] ?? false };
    m.known[column.id] = { column, cells };
  });

  // One sample of the news cycle per game day.
  if (day !== m.lastDay) {
    const shares: Record<string, number> = {};
    for (const s of lf.voice.shares) shares[s.id] = s.share;
    m.history.push({ day, shares });
    if (m.history.length > HISTORY_DAYS) m.history.splice(0, m.history.length - HISTORY_DAYS);
  }

  // Time moves on: flashes and ghosts expire.
  for (const [k, until] of Object.entries(m.flashRows)) if (until <= now) delete m.flashRows[k];
  for (const [k, until] of Object.entries(m.flashCells)) if (until <= now) delete m.flashCells[k];
  m.ghosts = m.ghosts.filter((g) => g.until > now);

  m.seen = true;
  m.lastDay = day;
  const flashRows = Object.keys(m.flashRows);
  const flashCells = Object.keys(m.flashCells);
  const sig = `${flashRows.join(",")}/${flashCells.join(",")}/${m.ghosts.map((g) => g.column.id).join(",")}/${m.history.length}:${m.history.at(-1)?.day ?? ""}`;
  if (sig !== m.sig) {
    m.sig = sig;
    m.view = { flashRows, flashCells, ghosts: m.ghosts.slice(), history: m.history.slice() };
  }
  return m.view;
}
