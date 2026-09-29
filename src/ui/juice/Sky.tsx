import { useEffect, useMemo, useRef } from "react";
import { ambience, css } from "../../render/fx/clock";
import { fx } from "../../render/fx/state";
import { createRng } from "../../sim/rng";

const STARS = 80;

/**
 * The sky behind the canvas: a gradient that follows the campus clock, with stars and a moon that fade in at night.
 * At the default zoom the board fills the screen, so this mostly shows when you zoom out or in photo mode; the
 * stars up over the campus itself are particles (see FxDirector).
 */
export function Sky() {
  const root = useRef<HTMLDivElement>(null);
  const stars = useMemo(() => {
    const rng = createRng(77);
    return Array.from({ length: STARS }, () => ({ x: rng.next() * 100, y: rng.next() * 62, s: 1 + Math.floor(rng.next() * 3), d: rng.next() * 4, t: 2 + rng.next() * 3 }));
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    let lastHour = -1;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 90 || Math.abs(fx.hour - lastHour) < 0.01) return;
      last = now;
      lastHour = fx.hour;
      const a = ambience(fx.hour);
      el.style.background = `linear-gradient(${css(a.skyTop)} 0%, ${css(a.skyMid)} 45%, ${css(a.skyBottom)} 100%)`;
      el.style.setProperty("--night", a.night.toFixed(3));
      document.documentElement.style.setProperty("--night", a.night.toFixed(3));
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="sky" ref={root} aria-hidden>
      <div className="stars">
        {stars.map((s, i) => (
          <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s`, animationDuration: `${s.t}s` }} />
        ))}
      </div>
      <div className="moon" />
    </div>
  );
}
