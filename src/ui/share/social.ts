// Streaks, friend links and the Memo's extra edition (FLT-57): the UI state they need, in Effect atoms like the rest,
// and the hooks that keep it. Nothing here reaches a server: the streak is localStorage, the challenge is the URL.
import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo, useRef } from "react";
import { registry, send } from "../../app/game";
import { todayKey } from "../../debug";
import { dailySeed } from "../../sim/daily";
import { parseChallenge, type Challenge } from "./link";
import { currentStreak, readStreak, recordPlay, streakText, type StreakStore } from "./streak";

const search = () => (typeof window === "undefined" ? "" : window.location.search);

function storage(): StreakStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** `?streak=7` shows a 7-day streak without living through the week (screenshots). Never stored. */
function pinnedStreak(): number | null {
  const n = Number(new URLSearchParams(search()).get("streak"));
  return Number.isInteger(n) && n >= 1 && n <= 9999 ? n : null;
}

/** Days in a row, as it stands (0 once it has lapsed). */
export const streakAtom = Atom.keepAlive(Atom.make<number>(pinnedStreak() ?? currentStreak(readStreak(storage()), todayKey())));

/** The friend's result from the URL, and whether its banner is still up. */
export const challengeAtom = Atom.keepAlive(Atom.make<{ challenge: Challenge | null; open: boolean }>(
  (() => {
    const challenge = parseChallenge(search(), dailySeed);
    return { challenge, open: challenge !== null };
  })(),
));

/** The Memo's extra edition that has been read ("seed:day"), so it shows once. */
export const memoSeenAtom = Atom.keepAlive(Atom.make<string | null>(null));

/** This page's address without the query: what a friend link is built on. */
export const linkBase = () => (typeof window === "undefined" ? null : `${window.location.origin}${window.location.pathname}`);

/**
 * Today counts once a game day has gone by in this page (so a paused screenshot doesn't). The first time it does, the
 * streak is stored, and from two days in a row a toast says so.
 */
export function useStreak(day: number) {
  const first = useRef<number | null>(null);
  const counted = useRef(false);
  useEffect(() => {
    if (first.current === null) first.current = day;
    if (counted.current || day <= first.current || pinnedStreak() !== null) return;
    counted.current = true;
    const s = recordPlay(storage(), todayKey());
    registry.set(streakAtom, s.days);
    if (s.days >= 2) send({ type: "TOAST", text: `🔥 ${streakText(s.days)}. See you tomorrow.`, tone: "good" });
  }, [day]);
}

export const dismissChallenge = () => registry.set(challengeAtom, { ...registry.get(challengeAtom), open: false });
export const dismissMemo = (key: string) => registry.set(memoSeenAtom, key);

/** What the view-model gets. */
export function useSocialInput() {
  const streak = useAtomValue(streakAtom);
  const { challenge, open } = useAtomValue(challengeAtom);
  const memoSeen = useAtomValue(memoSeenAtom);
  return useMemo(() => ({ streak, challenge, challengeOpen: open, memoSeen, linkBase: linkBase() }), [streak, challenge, open, memoSeen]);
}
