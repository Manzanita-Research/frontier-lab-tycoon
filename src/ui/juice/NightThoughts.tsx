import { useEffect } from "react";
import { registry, sim } from "../../app/game";
import { FIRST_NIGHT_LINE, NIGHT_THOUGHTS } from "../../content/night";
import { fx } from "../../render/fx/state";
import { nightBubbleAtom } from "../hud/state";

const NIGHT_MIN = 0.7;
const SHOW_MS = 5200;
const GAP_MS = 4500;

/**
 * While the campus is lit up, someone is always still at it: every few seconds a walker gets a night-only thought
 * bubble ("It's 2am. Still shipping."). Cosmetic and client-side, so it never touches the sim's own thoughts. It only
 * decides *when* and *who*: the bubble goes into the view-model and the active skin's Bubble slot draws it.
 */
export function NightThoughts() {
  const setBubble = (next: ((cur: import("../hud/types").BubbleVM | null) => import("../hud/types").BubbleVM | null) | import("../hud/types").BubbleVM | null) =>
    registry.set(nightBubbleAtom, typeof next === "function" ? next(registry.get(nightBubbleAtom)) : next);

  useEffect(() => {
    let seq = 0;
    let first = true;
    let busyUntil = 0;
    const timers: number[] = [];
    const tick = window.setInterval(() => {
      const now = performance.now();
      if (fx.night < NIGHT_MIN || now < busyUntil) return;
      const candidates = sim.world.walkers.filter((w) => w.machine.value !== "inside" && w.kind !== "protester");
      if (candidates.length === 0) return;
      const pool = NIGHT_THOUGHTS;
      const line = first ? FIRST_NIGHT_LINE : pool[Math.floor(Math.random() * pool.length)]!;
      const fits = candidates.filter((w) => w.kind === line.kind);
      const walker = (fits.length > 0 ? fits : candidates)[Math.floor(Math.random() * (fits.length > 0 ? fits.length : candidates.length))]!;
      first = false;
      const b = { id: ++seq, walkerId: walker.id, kind: walker.kind, speaker: walker.name, text: line.text, night: true };
      setBubble(b);
      busyUntil = now + SHOW_MS + GAP_MS;
      timers.push(window.setTimeout(() => setBubble((cur) => (cur?.id === b.id ? null : cur)), SHOW_MS));
    }, 700);
    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
