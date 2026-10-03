// FLT-56's camera beats: what the letterbox says. FxDirector writes it when a beat starts and clears it when the beat
// is over (or skipped); the HUD reads it through the view-model. Kept apart from FxDirector, like photoState.ts, so
// the UI can import it without three.
import { Atom } from "effect/unstable/reactivity";

export interface BeatShown {
  id: number;
  /** `exit` (a defection's conga line), `huddle` (the auditors confer), `viral` (the hearing clip). */
  kind: string;
  caption: string;
  sub: string;
  /** The top bar's words, when the beat brings its own (a mod's `camera.beat`); otherwise the HUD's for its kind. */
  kicker?: string;
}

/** The beat on screen, or null. keepAlive: FxDirector sets it whether or not the HUD is subscribed yet. */
export const beatAtom = Atom.keepAlive(Atom.make<BeatShown | null>(null));

/** Render-side bookkeeping for the beat in progress: who the camera follows, and when (fx.time) it is over. */
export const beatRun = { id: 0, kind: "", x: 0, z: 0, follow: [] as number[], zoom: 1, until: 0, camera: false, acc: 0 };
