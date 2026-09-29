// Is the Arena panel open? UI-only state, kept as an Effect atom like the rest of what React reads.
import { Atom } from "effect/unstable/reactivity";

/** Open on a desktop-sized screen, folded on a phone or a short window (the TopBar chip toggles it either way). */
export const arenaOpenAtom = Atom.make(typeof window === "undefined" ? true : window.innerWidth > 640 && window.innerHeight >= 800);
