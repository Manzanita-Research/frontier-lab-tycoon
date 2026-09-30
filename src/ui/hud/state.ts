// UI-only state the HUD host owns, kept as Effect atoms like the rest of what React reads. None of it is game state.
import { Atom } from "effect/unstable/reactivity";
import { debugParams } from "../../app/game";
import type { LoadedSkin } from "../../skins/types";
import { baseSlots } from "../../skins/base/slots";
import { BASE_STRINGS } from "../../skins/schema";
import type { NewsPanel } from "../../sim/types";
import type { Budget } from "./windows";
import type { SkinOfferVM } from "./types";

/** Open on a desktop-sized screen, folded on a phone or a short window (the Arena chip toggles it either way). */
export const arenaOpenAtom = Atom.make(typeof window === "undefined" ? true : window.innerWidth > 640 && window.innerHeight >= 800);
/** The player opened the Arena themselves (FLT-54): it takes its full width. Open on its own (at the start, or a rank drop called it), it keeps to the edge. */
export const arenaChosenAtom = Atom.make(false);

/** How many messages of the open group chat have arrived. */
export const chatCountAtom = Atom.make(0);

/** The photo bar's time-of-day pick ("" when a link pinned the hour). */
export const photoTimeAtom = Atom.make<string>(debugParams.hour !== null ? "" : "live");
/** Bumped every time the shutter fires, for the flash. */
export const photoFlashAtom = Atom.make(0);

export interface SkinUi {
  /** The skin showing right now. */
  active: string;
  picker: { open: boolean; original: string | null };
  /** Skins that were refused at load time (a bad slots.tsx, a missing font), with why. */
  refused: { id: string; errors: string[] }[];
  reducedMotion: boolean;
  /** FLT-55: a mod's skin waiting for the player's yes or no. */
  offer: SkinOfferVM | null;
}

// keepAlive: the boot sequence sets these before React has mounted anything, and an atom nobody subscribes to would
// forget its value.
export const skinUiAtom = Atom.keepAlive(Atom.make<SkinUi>({ active: "base", picker: { open: false, original: null }, refused: [], reducedMotion: false, offer: null }));

/** The skin's components and copy: what the host renders. Starts as the base until the first skin has loaded. */
export const loadedSkinAtom = Atom.keepAlive(Atom.make<LoadedSkin>({ id: "base", name: "Base", slots: baseSlots, strings: { ...BASE_STRINGS } }));

/** Is Start ▸ Settings ▸ Mods… open? UI-only state. */
export const modsOpenAtom = Atom.make(false);

/** Is Help ▸ How to play open? UI-only state. */
export const helpOpenAtom = Atom.make(false);

/** Is the Disasters menu open (FLT-32)? UI-only state. */
export const disastersOpenAtom = Atom.make(false);

/** FLT-33: is the Factions panel open? Folded to one line until you ask (a `?moment=factions` link opens it). */
export const factionsOpenAtom = Atom.make(debugParams.moment === "factions" || debugParams.moment === "counterprotest");

/** Is the Staff panel open? UI-only state, kept as an Effect atom like the rest of what React reads. */
export const staffOpenAtom = Atom.make(false);

/** Is the Papers window open? Folded to a chip until the player opens it. */
export const papersOpenAtom = Atom.make(false);

/** Paper moments and CrumbWiki reveals the player has closed this visit (their keys). */
export const dismissedAtom = Atom.make<readonly string[]>([]);

/** Is the Senate window (the Promise Tracker and the bill, FLT-22/23) open? UI-only state. */
export const senateOpenAtom = Atom.make(false);

/** FLT-54: the windows the game opened by itself and where each one stands (`windows.ts`). */
export const windowBudgetAtom = Atom.keepAlive(Atom.make<Budget>([]));
/** FLT-54: the newest headline about each panel the player has had open, for the unread badges. */
export const seenNewsAtom = Atom.keepAlive(Atom.make<Partial<Record<NewsPanel, number>>>({}));
/** FLT-54: the rank drop that last called the Arena up (a key), or null. The budget decides whether it opens. */
export const arenaCallAtom = Atom.make<string | null>(null);
