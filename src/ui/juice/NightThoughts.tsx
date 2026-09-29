import { useEffect, useState } from "react";
import { sim } from "../../app/game";
import { FIRST_NIGHT_LINE, NIGHT_THOUGHTS } from "../../content/night";
import { HALF } from "../../render/coords";
import { Anchored } from "../../render/overlay";
import { fx } from "../../render/fx/state";
import type { WalkerKind } from "../../sim/types";

const NIGHT_MIN = 0.7;
const SHOW_MS = 5200;
const GAP_MS = 4500;

interface Bubble {
  id: number;
  walkerId: number;
  kind: WalkerKind;
  text: string;
}

/**
 * While the campus is lit up, someone is always still at it: every few seconds a walker gets a night-only thought
 * bubble ("It's 2am. Still shipping."). Cosmetic and client-side, so it never touches the sim's own thoughts.
 */
export function NightThoughts() {
  const [bubble, setBubble] = useState<Bubble | null>(null);

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
      const b = { id: ++seq, walkerId: walker.id, kind: walker.kind, text: line.text };
      setBubble(b);
      busyUntil = now + SHOW_MS + GAP_MS;
      timers.push(window.setTimeout(() => setBubble((cur) => (cur?.id === b.id ? null : cur)), SHOW_MS));
    }, 700);
    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!bubble) return null;
  return (
    <div className="world">
      <Anchored
        key={bubble.id}
        className={`bubble bubble-${bubble.kind} bubble-night`}
        pos={(out) => {
          const w = sim.world.walkers.find((o) => o.id === bubble.walkerId);
          if (!w || w.machine.value === "inside") return false;
          const a = sim.alpha;
          out.set(w.px + (w.x - w.px) * a - HALF, w.kind === "agent" ? 0.95 : 1.1, w.pz + (w.z - w.pz) * a - HALF);
          return true;
        }}
      >
        {bubble.text}
      </Anchored>
    </div>
  );
}
