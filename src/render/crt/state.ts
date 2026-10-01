// The CRT's shared handles (FLT-73), apart from the shader so the UI and the scene can import them without pulling
// postprocessing into the main bundle (CrtFX is lazy-loaded, like PhotoFX).
import { Atom } from "effect/unstable/reactivity";
import type { CrtGovernor } from "./governor";
import { unwarp, type CrtMode, type CrtTier } from "./looks";

export interface CrtState {
  /** The look on screen right now: the player's pick, else the skin's default; off while photo mode is up. */
  mode: CrtMode;
  /** The player's own pick (Display Properties), or null while the skin's default applies. */
  choice: CrtMode | null;
  /** What the canvas is running (the governor steps it down on a slow machine; a phone starts at lite). */
  tier: CrtTier;
  /** `?crt=` pinned the look and the tier for this visit (screenshots): no governor. */
  pinned: boolean;
  /** The governor stepped the canvas down from the tier it started at. */
  reduced: boolean;
}

// keepAlive: set at boot, before React mounts anything.
export const crtAtom = Atom.keepAlive(Atom.make<CrtState>({ mode: "off", choice: null, tier: "multi", pinned: false, reduced: false }));

/**
 * The bow of the glass the canvas is shown through right now (0 when the canvas is flat), for the code that turns a
 * pointer into a scene position or a scene position into a label's place. CrtFX writes it; see `warp` in looks.ts.
 * `glass` (FLT-88): the tube is HTML-in-canvas, which bends the labels along with the world, so they stay flat.
 */
export const crtView = { curve: 0, glass: false };

/** A projected point (normalised device coordinates, as `Vector3.project` leaves it) moved to where the bowed glass shows it. */
export function onGlass<V extends { x: number; y: number }>(v: V): V {
  if (crtView.curve !== 0) [v.x, v.y] = unwarp(crtView.curve, v.x, v.y);
  return v;
}

/** The frame-time governor while one is watching (none with `?crt=` pinned, or before the tube was first on). The UI starts it; the canvas feeds it. */
export const crtGovernor: { current: CrtGovernor | null } = { current: null };
