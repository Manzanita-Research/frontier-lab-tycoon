// FLT-93: the HUD's own `survive()` (FLT-81). [Show me] clicks through menus the skin drew, and a skin is allowed to be
// wrong: a door that throws, an anchor that moved. That must cost the player one pointer, never the game. So a UI-side
// action runs inside `guard`: the cause goes to the console, the player gets the snag toast (FLT-84, once a minute at
// most; the app machine rate-limits it), and the click returns as if nothing had been asked.
import { describe, snagReport } from "../../app/snag";

export type SnagSink = (report: string) => void;

/** `f()`, or `fallback` if it throws, reporting the failure as `where`. The report itself is best effort. */
export function guardWith<T>(sink: SnagSink, where: string, f: () => T, fallback: T, at: () => { seed: number; tick: number; day: number } = () => ({ seed: 0, tick: 0, day: 0 })): T {
  try {
    return f();
  } catch (e) {
    console.error(`[flt] ${where} failed; the game carries on`, e);
    try {
      sink(snagReport({ where, ...describe(e), ...at() }));
    } catch {
      /* the console has it */
    }
    return fallback;
  }
}

/**
 * `guardWith`, reporting to the app actor. The game is imported only when something has gone wrong, so the coach layer
 * and its tests do not boot a game to be safe.
 */
export const guard = <T>(where: string, f: () => T, fallback: T): T =>
  guardWith(
    (report) =>
      void import("../../app/game").then(({ send }) => send({ type: "SNAG", report, now: Date.now() }), () => undefined),
    where,
    f,
    fallback,
  );
