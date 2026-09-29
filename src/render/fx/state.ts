// Render-side juice state: plain mutable fields that useFrame callbacks read and the FxDirector writes.
// It is not React state on purpose (nothing re-renders at 60 Hz) and it never feeds back into the sim.
import { readDebugParams } from "../../debug";
import { Cinema } from "./cinema";
import { START_HOUR } from "./clock";

export const fx = {
  /** R3F clock seconds, refreshed by the FxDirector every frame. */
  time: 0,
  /** The hour the scene is lit for: the sim's hour, low-passed. */
  hour: START_HOUR,
  /** Photo mode and `?hour=` pin the hour; null follows the sim. */
  hourOverride: readDebugParams().hour as number | null,
  night: 0,
  /** A model shipped: the crowd hops in a ripple out from here, starting at `cheerAt`. */
  cheerAt: -1e9,
  cheerX: 0,
  cheerZ: 0,
  /** Gateways got paid: their signs flicker. */
  earnAt: -1e9,
  /** Photo mode: no cinematics, no shake, no HUD. */
  photo: false,
};

export const CHEER_SECONDS = 2.6;

/** The camera director. FxDirector points it at the action; CameraRig moves the camera; anything can `shake` it. */
export const cinema = new Cinema();

/** Screen shake: small for placing, big for incidents. */
export const shake = (strength: number) => cinema.shake(strength);
