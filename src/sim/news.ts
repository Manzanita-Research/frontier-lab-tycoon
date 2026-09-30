// News ticker: event-driven headlines plus timed filler and rival releases.
import type { NewsTrigger } from "../content/headlines";
import type { Rng } from "./rng";
import { fillTemplate, formatMoney } from "./format";
import type { GameState, Importance, NoticeSource, Tone } from "./types";
import { defs, type HeadlineLine } from "./defs";
import { STATS } from "./verbs";

export interface NewsVars {
  model?: string;
  rival?: string;
  /** A person in the story, and how the headline refers to them: "her", "his" or "their". */
  name?: string;
  their?: string;
  amount?: string;
  /** Slop, as a whole percent (FLT-10). */
  pct?: string;
}

export function addNews(state: GameState, text: string, tone: Tone) {
  state.news.push({ id: state.nextId++, day: state.day, text, tone });
  if (state.news.length > 50) state.news.splice(0, state.news.length - 50);
}

export interface ToastTag {
  source: NoticeSource;
  /** Defaults to `world`: only what is about you, or needs you, is a toast (FLT-51; the policy is `src/app/notices.ts`). */
  importance?: Importance;
}

export function addToast(state: GameState, text: string, tone: Tone, tag: ToastTag) {
  state.toasts.push({ id: state.nextId++, text, tone, source: tag.source, importance: tag.importance ?? "world" });
}

/** Run `f` (applying player commands) and mark every toast it sends as a reply: the app never holds those back. */
export function replying(state: GameState, f: () => void) {
  const from = state.toasts.length;
  f();
  for (let i = from; i < state.toasts.length; i++) state.toasts[i]!.reply = true;
}

export function templateVars(state: GameState, vars: NewsVars, rng: Rng): Record<string, string> {
  return {
    lab: state.labName,
    model: vars.model ?? state.models[state.models.length - 1] ?? state.training.context.name,
    rival: vars.rival ?? rng.pick(defs().names.RIVALS),
    cash: formatMoney(state.cash),
    name: vars.name ?? "Someone",
    their: vars.their ?? "their",
    amount: vars.amount ?? "$0",
    pct: vars.pct ?? "0",
  };
}

/** A mod headline's `when` (FLT-37). Base lines have none, so the base game never rolls a die here. */
function holds(state: GameState, when: NonNullable<HeadlineLine["when"]>, rng: Rng): boolean {
  if ("stat.gte" in when) {
    const [stat, value] = when["stat.gte"];
    const read = STATS[stat === "waterDiscourse" ? "discourse" : stat];
    return read !== undefined && read(state, null) >= value;
  }
  if ("flag.is" in when) return (state.flags[when["flag.is"][0]] !== undefined) === when["flag.is"][1];
  if ("day.after" in when) return state.day > when["day.after"];
  return rng.chance(when.chance);
}

/** The headlines for a trigger whose conditions hold today, in content order. */
export function headlinePool(state: GameState, rng: Rng, trigger: string): readonly HeadlineLine[] {
  const all = defs().headlinesFor(trigger);
  return all.some((h) => h.when) ? all.filter((h) => !h.when || holds(state, h.when, rng)) : all;
}

/** Picks a headline for the trigger, avoiding ones the ticker already showed. */
export function pushNews(state: GameState, rng: Rng, trigger: NewsTrigger, vars: NewsVars = {}) {
  const pool = headlinePool(state, rng, trigger);
  if (pool.length === 0) return;
  const shown = new Set(state.news.map((n) => n.text));
  for (let attempt = 0; attempt < 5; attempt++) {
    const h = rng.pick(pool);
    const text = fillTemplate(h.text, templateVars(state, vars, rng));
    if (attempt < 4 && shown.has(text)) continue;
    addNews(state, text, h.tone);
    return;
  }
}

/** Timed headlines: rival releases every ~12-20 days, filler every ~6, trouble and triumph on thresholds. */
export function dailyNews(state: GameState, rng: Rng) {
  const f = state.flags;
  if (state.day >= (f.nextFiller ?? 0)) {
    pushNews(state, rng, "filler");
    f.nextFiller = state.day + rng.int(5, 8);
  }
  if (state.day >= (f.nextRival ?? 0)) {
    // Remembered for the crowd: researchers get a bout of fomo, and some turn down a call from this lab.
    const rival = rng.pick(defs().names.RIVALS);
    f.rivalIndex = defs().names.RIVALS.indexOf(rival);
    f.rivalShippedDay = state.day;
    pushNews(state, rng, "rival", { rival });
    f.nextRival = state.day + rng.int(12, 20);
  }
  if (state.cash < 1_000_000 && state.day >= (f.nextLowCash ?? 0)) {
    pushNews(state, rng, "lowCash");
    f.nextLowCash = state.day + 15;
  }
  if (state.waterDiscourse >= 12 && state.day >= (f.nextProtest ?? 0)) {
    pushNews(state, rng, "protest");
    f.nextProtest = state.day + rng.int(6, 9);
  }
  if (state.hype > 70 && state.day >= (f.nextHighHype ?? 0)) {
    pushNews(state, rng, "highHype");
    f.nextHighHype = state.day + 20;
  }
}
