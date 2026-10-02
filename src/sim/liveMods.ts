// Mods added to a running lab (FLT-78): Today's Drama's "Add to my lab", and the Mod Manager's Remove. Only data-only
// mods come here (headlines, thoughts, plain event cards, a rival's tagline), so nothing in the World has to be rebuilt:
// the app swaps the lab's definition on the command's tick, and this records it, says so, and looks after the cards.
import { addNews, addToast } from "./news";
import type { GameState, RunMods, Tone } from "./types";

/** Game days after a mod arrives before its card may open (the pacer still decides the day it actually does). */
export const ARRIVE_DAYS = 2;

export interface LiveMod {
  id: string;
  name: string;
  version: string;
  hash: string;
  url: string;
  cards: string[];
}

/** What the lab says when a mod arrives: a toast, a line on the ticker, and the pack's own first headline. */
export interface LiveModNews {
  toast: string;
  flash: string;
  headline?: { text: string; tone: Tone };
}

export function addLiveMod(state: GameState, mod: LiveMod, run: RunMods, news: LiveModNews) {
  if (state.modsAdded?.some((m) => m.id === mod.id)) return;
  (state.modsAdded ??= []).push({ id: mod.id, version: mod.version, hash: mod.hash, url: mod.url, tick: state.tick, day: state.day, cards: [...mod.cards] });
  state.mods = run;
  addToast(state, news.toast, "good", { source: "mods", importance: "you" });
  addNews(state, news.flash, "good");
  if (news.headline) addNews(state, news.headline.text, news.headline.tone);
}

/** Its cards go (an open one closes, unanswered); what it already put on the ticker stays, as history does. */
export function removeLiveMod(state: GameState, id: string, cards: readonly string[], run: RunMods | null) {
  for (const card of cards) delete state.arcs[card];
  const left = state.modsAdded?.filter((m) => m.id !== id);
  if (left?.length) state.modsAdded = left;
  else delete state.modsAdded;
  if (run) state.mods = run;
  else delete state.mods;
  state.version++;
}

/**
 * A card a mod brought mid-game, not yet seen: it turns up `ARRIVE_DAYS` after the mod did, whatever its own `when`
 * says and whatever the level (it was asked for). Once it has opened it is an ordinary card. Undefined for other cards.
 */
export function arrivingCard(state: GameState, id: string): boolean | undefined {
  const added = state.modsAdded;
  if (!added) return undefined;
  for (const m of added) {
    if (!m.cards.includes(id)) continue;
    if (state.arcs[id]?.context.openedDay != null) return undefined;
    return state.day >= m.day + ARRIVE_DAYS;
  }
  return undefined;
}
