// FLT-105: what the player said about each trip (Continue, Skip, "I've had enough"), and how strong it is on screen
// this frame. The answer is UI state, never the sim's: skipping the look keeps the story. Kept apart from TripLayer so
// the HUD's view-model can read it without the canvas.
import { Atom } from "effect/unstable/reactivity";

export type TripChoice = "on" | "off";

/** By trip id. keepAlive: a staged moment can answer before the HUD subscribes. */
export const tripChoiceAtom = Atom.keepAlive(Atom.make<Readonly<Record<string, TripChoice>>>({}));

/**
 * This frame's trip, written by TripScreen: its strength after the slew (0 to 1), the clock its waves run on, whether it
 * is the calm one, and whether the phone governor has asked for the lite version (no canvas pass, no trails). The canvas
 * pass, the trails and the music's tape wow read it.
 */
export const tripNow = { level: 0, t: 0, calm: false, lite: false, kaleido: 0, spin: 0, swirl: 0, breathe: 1, trails: 0 };
