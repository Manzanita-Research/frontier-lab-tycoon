// The Memo, before and after (FLT-57). Before: a rumour, then a countdown the HUD shows, one line a day, until the
// card lands (the Memo event's `daysAgo`). After: an extra edition, three named staff saying so out loud, and a
// lingering effect for the rest of the game: training runs faster or slower, and the protest grows or goes home.
// No dice anywhere: who reacts is the first walker of each kind, so the goldens and the RNG stream are untouched.
import { THOUGHT_TICKS } from "../constants";
import { fillTemplate } from "../format";
import { addNews } from "../news";
import { clampDiscourse } from "../protest";
import type { GameState, WalkerKind } from "../types";
import { ENDING_RULES, MEMO_OFFER, MEMO_RACE, MEMO_SLOW, type MemoForkDef } from "./pack";
import { people } from "../ecs/protesters";

export type MemoChoice = "race" | "slow";

/** What the World keeps once the Memo is answered. */
export interface MemoState {
  choice: MemoChoice;
  day: number;
  /** Who said what, the moment it landed (quoted in the extra edition). */
  reactions: { name: string; role: string; kind: WalkerKind; text: string }[];
}

const RULES = ENDING_RULES.memo;

export function memoChoice(state: GameState): MemoChoice | null {
  if (state.flags[MEMO_RACE] !== undefined) return "race";
  if (state.flags[MEMO_SLOW] !== undefined) return "slow";
  return null;
}

export const memoFork = (choice: MemoChoice): MemoForkDef => RULES[choice];

/** The day the rumour starts: the Memo is offered, and the countdown begins. */
export function offerMemo(state: GameState) {
  state.flags["memo:offered"] = state.day;
  state.flags[MEMO_OFFER] = state.day;
  addNews(state, fillTemplate(RULES.rumour, { lab: state.labName }), "neutral");
}

/** Days until the card lands, while it's coming (0 on the day it's on the desk), or null. */
export function memoDaysLeft(state: GameState): number | null {
  const offered = state.flags[MEMO_OFFER];
  if (offered === undefined || memoChoice(state) || state.endings?.run) return null;
  return Math.max(0, RULES.countdownDays - (state.day - offered));
}

/** Once a tick, cheap: the moment a box is ticked, the aftermath. */
export function updateMemo(state: GameState) {
  const e = state.endings;
  if (!e || e.memo) return;
  const choice = memoChoice(state);
  if (!choice) return;
  const fork = memoFork(choice);
  const used = new Set<number>();
  const reactions: MemoState["reactions"] = [];
  for (const line of fork.reactions) {
    const who = people(state).find((w) => w.kind === line.kind && !used.has(w.id));
    if (!who) continue;
    used.add(who.id);
    reactions.push({ name: who.name, role: who.role, kind: who.kind, text: line.text });
    // Said out loud: a bubble over their head, on top of whatever they were thinking.
    state.thoughts = state.thoughts.filter((t) => t.walkerId !== who.id);
    state.thoughts.push({ id: state.nextId++, walkerId: who.id, kind: who.kind, text: line.text, expiresTick: state.tick + THOUGHT_TICKS });
  }
  e.memo = { choice, day: state.day, reactions };
  addNews(state, fillTemplate(fork.extra.headline, { lab: state.labName }), choice === "race" ? "bad" : "neutral");
}

/** Once a day, for the rest of the game: the protest grows (Race) or goes home (Slow Down). */
export function dailyMemo(state: GameState) {
  const choice = state.endings?.memo?.choice;
  if (!choice) return;
  state.waterDiscourse = clampDiscourse(state.waterDiscourse * memoFork(choice).discourse);
}

/** The Memo's pull on training: 1 until a box is ticked (and in every game without endings). */
export function memoPace(state: GameState): number {
  const choice = state.endings?.memo?.choice;
  return choice ? memoFork(choice).training : 1;
}

export interface MemoView {
  /** "coming": the countdown; "answered": the extra edition and the chip. */
  phase: "coming" | "answered";
  daysLeft: number;
  /** Today's countdown line ("Page two is the same chart, steeper."). */
  line: string;
  choice: MemoChoice | null;
  /** The day it was answered (the HUD keys "seen" on it). */
  day: number;
  chip: string | null;
  /** The box that was ticked, as printed on the Memo ("Race", "Slow Down"). */
  label: string | null;
  effects: string[];
  extra: { kicker: string; headline: string; deck: string } | null;
  reactions: MemoState["reactions"];
}

export function memoView(state: GameState): MemoView | null {
  const e = state.endings;
  if (!e) return null;
  const left = memoDaysLeft(state);
  if (left !== null) {
    const line = RULES.countdown[Math.min(RULES.countdown.length - 1, left)] ?? "";
    return { phase: "coming", daysLeft: left, line, choice: null, day: state.flags[MEMO_OFFER]!, chip: null, label: null, effects: [], extra: null, reactions: [] };
  }
  if (!e.memo) return null;
  const fork = memoFork(e.memo.choice);
  const fill = (t: string) => fillTemplate(t, { lab: state.labName });
  return {
    phase: "answered",
    daysLeft: 0,
    line: "",
    choice: e.memo.choice,
    day: e.memo.day,
    chip: fork.chip,
    label: fork.label,
    effects: [...fork.effects],
    extra: { kicker: fill(fork.extra.kicker), headline: fill(fork.extra.headline), deck: fill(fork.extra.deck) },
    reactions: e.memo.reactions.map((r) => ({ ...r })),
  };
}
