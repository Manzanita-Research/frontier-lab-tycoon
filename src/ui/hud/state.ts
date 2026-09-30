// UI-only state the HUD host owns, kept as Effect atoms like the rest of what React reads. None of it is game state.
import { Atom } from "effect/unstable/reactivity";
import { debugParams } from "../../app/game";
import type { LoadedSkin } from "../../skins/types";
import { baseSlots } from "../../skins/base/slots";
import { BASE_STRINGS } from "../../skins/schema";

/** Open on a desktop-sized screen, folded on a phone or a short window (the Arena chip toggles it either way). */
export const arenaOpenAtom = Atom.make(typeof window === "undefined" ? true : window.innerWidth > 640 && window.innerHeight >= 800);

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
}

// keepAlive: the boot sequence sets these before React has mounted anything, and an atom nobody subscribes to would
// forget its value.
export const skinUiAtom = Atom.keepAlive(Atom.make<SkinUi>({ active: "base", picker: { open: false, original: null }, refused: [], reducedMotion: false }));

/** The skin's components and copy: what the host renders. Starts as the base until the first skin has loaded. */
export const loadedSkinAtom = Atom.keepAlive(Atom.make<LoadedSkin>({ id: "base", name: "Base", slots: baseSlots, strings: { ...BASE_STRINGS } }));

/** Is Help ▸ How to play open? UI-only state. */
export const helpOpenAtom = Atom.make(false);

/** Is the Staff panel open? UI-only state, kept as an Effect atom like the rest of what React reads. */
export const staffOpenAtom = Atom.make(false);

/** Is the Senate window (the Promise Tracker and the bill, FLT-22/23) open? UI-only state. */
export const senateOpenAtom = Atom.make(false);
