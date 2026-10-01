// FLT-70 put the big box at `/box` (and `?intro=1`). FLT-95 makes it the front door: a first visit to the bare root
// opens on the shelf, and a returning player (a save in any slot, or the box already seen) opens on the game, where
// "Welcome back" puts their lab one click away. Any other link (a staged `?moment=`, a `?mod=`, a friend's `?seed=`)
// goes straight into the game. This file is all the intro costs the game's entry chunk.

/** The save slots' keys (`slotKey` in src/save/store.ts; importing that would pull Effect into the entry chunk). */
export const SAVE_KEYS = ["flt.save.auto", "flt.save.1", "flt.save.2", "flt.save.3"] as const;
/** Set when the intro hands over to the game (Insert and play, or Skip): from then on the root opens on the game. */
export const BOX_SEEN_KEY = "flt.boxSeen";

type Loc = { pathname: string; search: string };

/** True when this URL asks for the software-shelf intro, whatever is saved. */
export const isIntroRoute = (loc: Loc) => loc.pathname.replace(/\/+$/, "") === "/box" || new URLSearchParams(loc.search).get("intro") === "1";

/** Params a shared link picks up on the way (social sites, newsletters) that say nothing about the game. */
const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|msclkid|igshid|mc_cid|mc_eid|ref)$/i;

/** The root with nothing in the query that the game reads: what a stranger types or clicks. */
export const isBareRoot = (loc: Loc) => loc.pathname.replace(/\/+$/, "") === "" && [...new URLSearchParams(loc.search).keys()].every((k) => TRACKING.test(k));

/** Someone who has been here before: a save in any slot, or the box already taken off the shelf. */
function isReturning(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return !!storage && (SAVE_KEYS.some((k) => storage.getItem(k) !== null) || storage.getItem(BOX_SEEN_KEY) !== null);
  } catch {
    return false;
  }
}

/** Which door this visit comes in by. */
export const door = (loc: Loc, storage: Pick<Storage, "getItem"> | null): "box" | "game" =>
  isIntroRoute(loc) || (isBareRoot(loc) && !isReturning(storage)) ? "box" : "game";
