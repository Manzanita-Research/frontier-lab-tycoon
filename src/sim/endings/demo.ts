// Debug scenes for the endings (FLT-11): `?moment=memo` (The Memo on screen), `takeover` (the autopilot mid-glide),
// `thanks` (the last card), and `front-<id>` (an ending's front page, fresh off the press). They start from the curated
// mid-game campus (it looks lived-in), put it in Era 4, and move it along the ordinary way: the ending's own chart, the
// ordinary tick. Pure sim; the game itself never calls it.
import { openEventOf } from "../events";
import { createRng } from "../rng";
import { createMidgameScenario } from "../scenarios/midgame";
import { tick, TICKS_PER_DAY } from "../tick";
import type { Command } from "../commands";
import type { GameState } from "../types";
import { cursorOf } from "./view";
import { startEnding } from "./driver";
import { ENDINGS, MEMO_RACE, MEMO_SLOW } from "./pack";
import { enableEndings } from "./state";

export const ENDING_MOMENTS = ["memo", "takeover", "thanks", ...ENDINGS.map((e) => `front-${e.id}`)] as const;
export const isEndingMoment = (m: string | null | undefined): m is string => !!m && (ENDING_MOMENTS as readonly string[]).includes(m);

/** Tick until `done`, answering every card that opens (The Memo stays open only if `keepMemo`). */
function until(s: GameState, done: (s: GameState) => boolean, maxDays: number, keepMemo = false) {
  for (let i = 0; i < maxDays * TICKS_PER_DAY && !done(s); i++) {
    const open = openEventOf(s);
    if (open?.id === "memo" && keepMemo) return;
    const cmds: Command[] = open ? [{ type: "chooseEvent", eventId: open.id, choiceIndex: 0 }] : [];
    tick(s, cmds);
  }
}

function start(s: GameState, id: string) {
  const rng = createRng(s.rngState);
  startEnding(s, rng, id);
  s.rngState = rng.state();
}

/** The mid-game campus, a little later: Era 4, and a history of eras for the run summary's strip. */
function lateGame(): GameState {
  const s = createMidgameScenario();
  enableEndings(s);
  s.race.era = { value: "era4", context: { peak: Math.max(30, s.race.mult) } } as typeof s.race.era;
  s.endings!.eraDays = [0, Math.round(s.day * 0.3), Math.round(s.day * 0.62), s.day];
  s.endings!.peakProtesters = Math.max(s.endings!.peakProtesters, 23);
  s.endings!.agentsEscaped = 11;
  s.cash = Math.max(s.cash, 25_000_000);
  return s;
}

export function stageEndingMoment(moment: string): GameState {
  const s = lateGame();
  if (moment === "memo") {
    until(s, (w) => openEventOf(w)?.id === "memo", 4, true);
    return s;
  }
  // Every other scene is The Memo answered one way or the other (the goals machine steps aside), then the ending.
  const id = moment.startsWith("front-") ? moment.slice(6) : "takeover";
  s.flags["memo:offered"] = s.day;
  s.flags[id === "regulated" ? MEMO_SLOW : MEMO_RACE] = s.day;
  if (id === "captured") s.capture = 100;
  if (id === "escaped" && s.escape) s.escape.escaped = Math.max(s.escape.escaped, 10);
  start(s, id);
  if (moment === "takeover") {
    // Two buildings down, the cursor halfway to the third.
    until(s, (w) => w.endings!.autopilot.placed >= 2 && (cursorOf(w)?.t ?? 0) >= 0.5, 12);
  } else if (moment === "thanks") {
    until(s, (w) => typeof w.endings!.look.thanks === "string", 12);
  } else {
    until(s, (w) => w.endings!.endedDay !== null, 15);
  }
  return s;
}
