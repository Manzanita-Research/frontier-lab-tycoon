// News ticker: event-driven headlines plus timed filler and rival releases.
import { HEADLINES, type NewsTrigger } from "../content/headlines";
import { RIVALS } from "../content/names";
import type { Rng } from "./rng";
import { fillTemplate, formatMoney } from "./format";
import type { GameState, Tone } from "./types";

export interface NewsVars {
  model?: string;
  rival?: string;
}

export function addNews(state: GameState, text: string, tone: Tone) {
  state.news.push({ id: state.nextId++, day: state.day, text, tone });
  if (state.news.length > 50) state.news.splice(0, state.news.length - 50);
}

export function addToast(state: GameState, text: string, tone: Tone = "neutral") {
  state.toasts.push({ id: state.nextId++, text, tone });
}

export function templateVars(state: GameState, vars: NewsVars, rng: Rng): Record<string, string> {
  return {
    lab: state.labName,
    model: vars.model ?? state.models[state.models.length - 1] ?? state.training.name,
    rival: vars.rival ?? rng.pick(RIVALS),
    cash: formatMoney(state.cash),
  };
}

/** Picks a headline for the trigger, avoiding ones the ticker already showed. */
export function pushNews(state: GameState, rng: Rng, trigger: NewsTrigger, vars: NewsVars = {}) {
  const pool = HEADLINES.filter((h) => h.trigger === trigger);
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
    pushNews(state, rng, "rival");
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
