// FLT-105: the trip's look on the page. One loop a frame: the strength slews toward what the sim says (or toward
// nothing, fast, after "I've had enough"), and every effect is `tripFrame` of it, the same numbers the
// photosensitivity test samples. The colour is a slowly turning rainbow wash blended with `mix-blend-mode: color`,
// so it changes hues and never brightness; the rest is CSS (windows that melt, text that wobbles, walls that
// breathe), driven by a few variables on <html>, and the canvas pass and the trails, which read `tripNow`.
//
// The calm version (reduced motion) stands still: the wash doesn't turn, and a still mandala (`.trip-art`) sits on the
// map, under the HUD, blended by colour like the wash. Both fade in and out with the strength; nothing else changes.
//
// `html[data-trip]`: "on" (everything), "calm" (reduced motion: still colour and art), "lite" (a phone that can't keep
// up: no canvas pass, no trails, no wobbling text). Absent when there is no trip on screen.
//
// Debug knobs, comma-separated: `?trip=calm` and `?trip=lite` force those; `?trip=full` (screenshots and the video,
// on a software renderer at a few frames a second) skips the come-up and the governor. The warning still asks first.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { reducedMotion } from "../../skins/kit/motion";
import type { TripVM } from "../hud/types";
import { slew, TRIP_CALM, TRIP_LOOK, tripFrame } from "./trip";
import { tripNow } from "./tripState";

/** A phone that averages slower than this (seconds a frame) for `GOVERNOR_HOLD` seconds goes lite, for the rest of the session. */
const GOVERNOR_DT = 0.028;
const GOVERNOR_HOLD = 1.5;
/** How often the CSS variables move (they change slowly; every frame would restyle the whole page for nothing). */
const VARS_EVERY = 0.1;

/** `?trip=` knobs, comma-separated (`?trip=full,calm`). */
const forced = () => new Set(typeof location === "undefined" ? [] : (new URLSearchParams(location.search).get("trip") ?? "").split(","));

export function TripScreen({ trip }: { trip: TripVM | null }) {
  const wash = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const want = useRef({ on: false, target: 0, enough: false, calm: false });
  const on = trip?.consent === "on";
  want.current = { on, target: on ? trip.strength : 0, enough: trip?.consent === "off", calm: !!trip?.calm };
  // On from Continue until the look has slewed back to nothing: a trip that ends (or "I've had enough") fades, never snaps.
  const [live, setLive] = useState(false);
  if (on && !live) setLive(true);

  useEffect(() => {
    if (!live) return;
    const root = document.documentElement;
    const force = forced();
    if (force.has("lite")) tripNow.lite = true;
    let raf = 0;
    let last = performance.now();
    let since = VARS_EVERY;
    let slow = 0;
    let avg = 1 / 60;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const calm = want.current.calm || force.has("calm") || reducedMotion();
      const look = calm ? TRIP_CALM : TRIP_LOOK;
      tripNow.level = force.has("full") && !want.current.enough ? want.current.target : slew(tripNow.level, want.current.target, dt, look, want.current.enough);
      tripNow.t += dt;
      tripNow.calm = calm;
      const f = tripFrame(tripNow.t, tripNow.level, look);
      Object.assign(tripNow, { kaleido: f.kaleido, spin: f.spin, swirl: f.swirl, breathe: f.breathe, trails: f.trails });
      // The governor: only while the trip is on screen, so a slow phone is judged by the trip's frames.
      if (tripNow.level > 0.05 && !tripNow.lite && !force.has("full")) {
        avg += (dt - avg) * 0.1;
        slow = avg > GOVERNOR_DT ? slow + dt : 0;
        if (slow > GOVERNOR_HOLD) tripNow.lite = true;
      }
      const el = wash.current;
      if (el) {
        el.style.opacity = f.wash.toFixed(3);
        el.style.transform = `translate(-50%, -50%) rotate(${f.turn.toFixed(2)}deg)`;
      }
      if (art.current) art.current.style.opacity = f.art.toFixed(3);
      since += dt;
      if (since >= VARS_EVERY) {
        since = 0;
        const on = tripNow.level > 0.002;
        const mode = !on ? null : calm ? "calm" : tripNow.lite ? "lite" : "on";
        if (mode) root.dataset.trip = mode;
        else delete root.dataset.trip;
        root.style.setProperty("--trip-k", tripNow.level.toFixed(3));
        root.style.setProperty("--trip-wobble", `${f.wobble.toFixed(2)}deg`);
        root.style.setProperty("--trip-melt", f.melt.toFixed(3));
        root.style.setProperty("--trip-breathe", (f.breathe - 1).toFixed(4));
      }
      if (!want.current.on && tripNow.level === 0 && since === 0) return setLive(false);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      tripNow.level = 0;
      tripNow.kaleido = 0;
      tripNow.swirl = 0;
      tripNow.trails = 0;
      tripNow.breathe = 1;
      delete root.dataset.trip;
      for (const v of ["--trip-k", "--trip-wobble", "--trip-melt", "--trip-breathe"]) root.style.removeProperty(v);
    };
  }, [live]);

  if (!live || typeof document === "undefined") return null;
  return createPortal(
    <>
      <div ref={art} className="trip-art" aria-hidden="true" style={{ opacity: 0 }} />
      <div ref={wash} className="trip-wash" aria-hidden="true" style={{ opacity: 0 }} />
    </>,
    document.body,
  );
}
