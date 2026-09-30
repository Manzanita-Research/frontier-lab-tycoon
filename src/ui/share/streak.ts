// Streaks (FLT-57): consecutive days played, on this device only. localStorage and nothing else: no account, no
// server. A day counts once a game day has gone by in it (a paused screenshot doesn't). The date is passed in, so the
// tests (and the calendar) are the caller's.

export interface Streak {
  /** Consecutive days played, today included once it counts. */
  days: number;
  best: number;
  /** The last day played ("2026-09-30", the player's local date). */
  last: string;
}

/** The subset of Storage this needs, so a test can pass a Map-backed stand-in. */
export type StreakStore = Pick<Storage, "getItem" | "setItem">;

export const STREAK_KEY = "flt.streak.v1";

const DAY = /^(\d{4})-(\d\d)-(\d\d)$/;

/** Days since 1970-01-01 for a date key, or null if it isn't one. Calendar arithmetic only: no time zones. */
export function dayNumber(key: string): number | null {
  const m = DAY.exec(key);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.round(t / 86_400_000) : null;
}

/** Today counted: the same day changes nothing, the day after adds one, and any gap starts again at 1. */
export function nextStreak(prev: Streak | null, today: string): Streak {
  const t = dayNumber(today);
  const p = prev ? dayNumber(prev.last) : null;
  if (!prev || t === null || p === null || t < p) return { days: 1, best: Math.max(1, prev?.best ?? 0), last: today };
  if (t === p) return prev;
  const days = t - p === 1 ? prev.days + 1 : 1;
  return { days, best: Math.max(prev.best, days), last: today };
}

/** The streak as it stands today: still alive if the last day played was today or yesterday, 0 otherwise. */
export function currentStreak(s: Streak | null, today: string): number {
  const t = dayNumber(today);
  const p = s ? dayNumber(s.last) : null;
  if (!s || t === null || p === null) return 0;
  return t - p === 0 || t - p === 1 ? s.days : 0;
}

function valid(x: unknown): x is Streak {
  const s = x as Streak;
  return !!s && Number.isInteger(s.days) && s.days >= 1 && Number.isInteger(s.best) && s.best >= s.days && dayNumber(String(s.last)) !== null;
}

export function readStreak(store: StreakStore | null): Streak | null {
  try {
    const raw = store?.getItem(STREAK_KEY);
    const s: unknown = raw ? JSON.parse(raw) : null;
    return valid(s) ? { days: s.days, best: s.best, last: s.last } : null;
  } catch {
    return null;
  }
}

/** Count today as played, and keep it. Storage that says no (private mode, full) still gets today's streak back. */
export function recordPlay(store: StreakStore | null, today: string): Streak {
  const next = nextStreak(readStreak(store), today);
  try {
    store?.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do: the streak lives for this page only.
  }
  return next;
}

/** "7-day streak". */
export const streakText = (days: number) => `${days}-day streak`;
