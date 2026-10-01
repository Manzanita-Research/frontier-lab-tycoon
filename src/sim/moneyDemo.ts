// Debug scenes for FLT-86 (`?moment=money-round1|money-lastround|money-overdraft|money-bankrupt|money-stretch|money-win`):
// the money and the win, one click each, on the curated mid-game campus. Each is moved along the ordinary way (the
// economy and goals machines, the ordinary tick); only the starting books are set by hand. Pure sim; the game never calls it.
import { MAX_ROUNDS, OVERDRAFT_CARD, bridgeCardId } from "../content/bridgeRounds";
import { FRESH_ECONOMY, type EconomyContext } from "./machines/economy";
import { createMidgameScenario } from "./scenarios/midgame";
import { enableEndings } from "./endings/state";
import { openEventOf } from "./events";
import { addToast } from "./news";
import { tick, TICKS_PER_DAY } from "./tick";
import { defs } from "./defs";
import type { Command } from "./commands";
import type { GameState } from "./types";

export const MONEY_MOMENTS = ["money-round1", "money-lastround", "money-overdraft", "money-bankrupt", "money-stretch", "money-win"] as const;
export type MoneyMoment = (typeof MONEY_MOMENTS)[number];
export const isMoneyMoment = (m: string | null | undefined): m is MoneyMoment => !!m && (MONEY_MOMENTS as readonly string[]).includes(m);

/** Tick until `done`, answering any card that isn't one of the money cards. */
function until(s: GameState, done: (s: GameState) => boolean, maxTicks: number) {
  for (let i = 0; i < maxTicks && !done(s); i++) {
    const open = openEventOf(s);
    const cmds: Command[] = open ? [{ type: "chooseEvent", eventId: open.id, choiceIndex: 0 }] : [];
    tick(s, cmds);
  }
}

/** The lab's money as if it had taken `rounds` rounds, all for equity (10%, then 15%, then 20%). */
function books(s: GameState, rounds: number, value: "solvent" | "funded" | "overdrawn" = rounds > 0 ? "funded" : "solvent", overdraftDay: number | null = null) {
  const stake = [100, 90, 75, 55][rounds]!;
  const context: EconomyContext = { ...FRESH_ECONOMY, rounds, stake, lastBailout: rounds > 0 ? s.day - 20 : null, overdraftDay };
  s.economy = { value, context } as GameState["economy"];
  for (let n = 1; n <= MAX_ROUNDS; n++) delete s.flags[`offer:${bridgeCardId(n)}`];
  delete s.flags[`offer:${OVERDRAFT_CARD}`];
}

/** Clear the screen, then go just below $0 and close the day: the economy machine does the rest. */
function broke(s: GameState) {
  lateEvening(s, 1);
  s.cash = -40_000;
  tick(s);
}

/** No card up, and `ticks` ticks to midnight. */
function lateEvening(s: GameState, ticks: number) {
  until(s, (w) => !openEventOf(w) && w.tick % TICKS_PER_DAY === TICKS_PER_DAY - ticks, 2 * TICKS_PER_DAY);
}

/** The objectives a step from done: the first two met (Era 3 reached), the Arena held `held` days of its hold. */
function goals(s: GameState, arenaHeld: number | null) {
  s.race.era = { value: "era3", context: { peak: Math.max(6, s.race.era.context.peak) } } as GameState["race"]["era"];
  const arena = defs().goals.find((g) => g.metric === "arena")!;
  const top = defs().arenaSize + 1 - arena.target;
  if (arenaHeld !== null && s.race.rank > top) s.race.rank = top;
  s.goals = {
    ...s.goals,
    context: {
      ...s.goals.context,
      goals: s.goals.context.goals.map((g) => {
        if (g.id === arena.id) return arenaHeld === null ? g : { ...g, value: g.target, held: arenaHeld, met: false };
        // money-stretch leaves Era 3 for tonight's close, so the stretch beat comes from the machine itself.
        if (arenaHeld === null && g.id !== "release") return g;
        return { ...g, value: g.target, met: true };
      }),
    },
  };
}

export function stageMoneyMoment(moment: MoneyMoment): GameState {
  const s = createMidgameScenario();
  enableEndings(s);
  if (moment === "money-round1") {
    books(s, 0);
    broke(s);
  } else if (moment === "money-lastround") {
    books(s, 2);
    broke(s);
  } else if (moment === "money-overdraft") {
    books(s, 3);
    broke(s);
  } else if (moment === "money-bankrupt") {
    // A day left on the bank's clock, and the account still in the red: the bank calls tonight.
    books(s, 3, "overdrawn", s.day + 1);
    s.cash = -400_000;
    until(s, (w) => w.endings?.endedDay != null || w.goals.value !== "tracking", 20 * TICKS_PER_DAY);
  } else if (moment === "money-stretch") {
    // Era 3 lands at tonight's close: 2 of 3, and the camera's "Final stretch" (replay it with `&beat`).
    goals(s, null);
    const day = s.day;
    until(s, (w) => w.day > day, 2 * TICKS_PER_DAY);
    // A card that opened the same night would cover the beat: answer it (the beat stays the latest cue).
    until(s, (w) => !openEventOf(w), TICKS_PER_DAY);
  } else {
    // Day 29 of 30 on the Arena, a few game hours before midnight, with a toast up: the win lands a second or two after
    // the page opens, and the toast steps aside for it.
    lateEvening(s, 8);
    goals(s, defs().goals.find((g) => g.metric === "arena")!.hold! - 1);
    addToast(s, "Your Arena lead is 40 Elo. The board would like it to be 400.", "neutral", { source: "leapfrog", importance: "you" });
  }
  return s;
}
