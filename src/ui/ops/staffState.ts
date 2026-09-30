import { Atom } from "effect/unstable/reactivity";

/** Is the Staff panel open? An Effect atom like the rest of what React reads (not part of the game's own state). */
export const staffOpenAtom = Atom.make(false);
