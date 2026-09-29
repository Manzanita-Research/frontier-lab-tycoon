// Is the Arena panel open? UI-only state, kept as an Effect atom like the rest of what React reads.
import { Atom } from "effect/unstable/reactivity";

/** Open on desktop, folded on a phone (the TopBar chip toggles it either way). */
export const arenaOpenAtom = Atom.make(typeof window === "undefined" ? true : window.innerWidth > 640);
