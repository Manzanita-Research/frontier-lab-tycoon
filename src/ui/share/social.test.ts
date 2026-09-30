// FLT-57: streaks (localStorage, an injected date) and friend links (results only, the same seed).
import { describe, expect, it } from "vitest";
import { dailySeed } from "../../sim/daily";
import { readDebugParams } from "../../debug";
import { challengeLine, challengeQuery, challengeUrl, compareRuns, parseChallenge, type Challenge } from "./link";
import { currentStreak, nextStreak, readStreak, recordPlay, STREAK_KEY, type StreakStore } from "./streak";

function memoryStore(init: Record<string, string> = {}): StreakStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("streaks", () => {
  it("counts consecutive days, keeps the best, and starts again after a gap", () => {
    let s = nextStreak(null, "2026-09-28");
    expect(s).toEqual({ days: 1, best: 1, last: "2026-09-28" });
    s = nextStreak(s, "2026-09-28");
    expect(s.days).toBe(1);
    s = nextStreak(s, "2026-09-29");
    s = nextStreak(s, "2026-09-30");
    expect(s).toEqual({ days: 3, best: 3, last: "2026-09-30" });
    s = nextStreak(s, "2026-10-02");
    expect(s).toEqual({ days: 1, best: 3, last: "2026-10-02" });
  });

  it("crosses months, years and leap days by the calendar", () => {
    expect(nextStreak({ days: 4, best: 4, last: "2026-12-31" }, "2027-01-01").days).toBe(5);
    expect(nextStreak({ days: 4, best: 4, last: "2028-02-28" }, "2028-02-29").days).toBe(5);
    expect(nextStreak({ days: 4, best: 4, last: "2028-02-28" }, "2028-03-01").days).toBe(1);
    // A clock that went backwards starts over rather than going negative.
    expect(nextStreak({ days: 4, best: 9, last: "2026-09-30" }, "2026-09-20")).toEqual({ days: 1, best: 9, last: "2026-09-20" });
  });

  it("is alive today and yesterday, and over the day after", () => {
    const s = { days: 6, best: 6, last: "2026-09-29" };
    expect(currentStreak(s, "2026-09-29")).toBe(6);
    expect(currentStreak(s, "2026-09-30")).toBe(6);
    expect(currentStreak(s, "2026-10-01")).toBe(0);
    expect(currentStreak(null, "2026-10-01")).toBe(0);
  });

  it("lives in localStorage under one key, and shrugs off junk and storage that says no", () => {
    const store = memoryStore();
    recordPlay(store, "2026-09-29");
    recordPlay(store, "2026-09-30");
    expect(JSON.parse(store.data.get(STREAK_KEY)!)).toEqual({ days: 2, best: 2, last: "2026-09-30" });
    expect(readStreak(memoryStore({ [STREAK_KEY]: "{nope" }))).toBeNull();
    expect(readStreak(memoryStore({ [STREAK_KEY]: JSON.stringify({ days: -3, best: 1, last: "2026-09-30" }) }))).toBeNull();
    const full: StreakStore = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(recordPlay(full, "2026-09-30")).toEqual({ days: 1, best: 1, last: "2026-09-30" });
    expect(recordPlay(null, "2026-09-30").days).toBe(1);
  });
});

describe("friend links", () => {
  const captured: Challenge = { ending: "captured", day: 212, vibes: 88, models: 7, seed: 4242, daily: null };

  it("encodes the ending, the day, two stats and the seed: nothing else", () => {
    expect(challengeQuery(captured)).toBe("seed=4242&vs=captured.212.88.7");
    const daily = { ...captured, seed: dailySeed("2026-09-30"), daily: "2026-09-30" };
    expect(challengeQuery(daily)).toBe("seed=daily&date=2026-09-30&vs=captured.212.88.7");
    expect(challengeUrl("https://example.test/", captured)).toBe("https://example.test/?seed=4242&vs=captured.212.88.7");
  });

  it("round-trips, and replays the same seed the game reads from the URL", () => {
    for (const c of [captured, { ...captured, ending: "takeover", seed: dailySeed("2026-09-30"), daily: "2026-09-30" }]) {
      const q = "?" + challengeQuery(c);
      expect(parseChallenge(q, dailySeed)).toEqual(c);
      expect(readDebugParams(q).seed).toBe(c.seed);
    }
  });

  it("refuses links it can't trust", () => {
    for (const q of ["", "?vs=captured.212.88.7", "?seed=4242&vs=escapedToMars.1.1.1", "?seed=4242&vs=captured.212.88", "?seed=4242&vs=captured.-1.88.7", "?seed=4242&vs=captured.2e3.88.7", "?seed=daily&vs=captured.212.88.7", "?seed=0&vs=captured.1.1.1", "?seed=<b>&vs=captured.1.1.1"])
      expect(parseChallenge(q, dailySeed), q).toBeNull();
  });

  it("says it like a friend would", () => {
    expect(challengeLine(captured)).toBe("Your friend's lab was Captured on day 212.");
    expect(challengeLine({ ...captured, ending: "pivot", day: 1440 })).toBe("Your friend's lab pivoted to NFTs on day 1,440.");
  });

  it("decides who did better: the better ending, then sooner (or, going down, later), then Vibes, then models", () => {
    const r = (ending: string, day: number, vibes = 50, models = 5) => ({ ending, day, vibes, models });
    expect(compareRuns(r("takeover", 900), r("captured", 212))).toBe("win");
    expect(compareRuns(r("acquihired", 100), r("regulated", 900))).toBe("lose");
    expect(compareRuns(r("captured", 200), r("captured", 212))).toBe("win");
    expect(compareRuns(r("pivot", 1440), r("acquihired", 300))).toBe("win");
    expect(compareRuns(r("captured", 212, 90), r("captured", 212, 88))).toBe("win");
    expect(compareRuns(r("captured", 212, 88, 7), r("captured", 212, 88, 7))).toBe("tie");
  });
});
