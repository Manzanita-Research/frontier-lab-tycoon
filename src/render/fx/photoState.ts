// Photo mode's shared handles, kept apart from PhotoFX.tsx so the UI and the scene can import them without pulling
// @react-three/postprocessing into the main bundle (PhotoFX is lazy-loaded and only mounted while photo mode is on).
import { Atom } from "effect/unstable/reactivity";

/** Is photo mode on? An Effect atom, like the rest of what React reads. `setPhoto` in ui/juice/photo.ts writes it. */
export const photoAtom = Atom.make(false);

/** PhotoFX fills `render` while it is mounted: it draws one frame through the pipeline and returns the canvas. */
export const photoBridge: { render: (() => HTMLCanvasElement | null) | null } = { render: null };
