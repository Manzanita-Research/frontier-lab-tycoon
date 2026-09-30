import { useEffect, useRef } from "react";
import { reducedMotion } from "./motion";

const ROLL_MS = 700;
const easeOut = (u: number) => 1 - (1 - u) ** 3;

/**
 * A number that rolls to its new value like an odometer and flashes green when it goes up, red when it goes down.
 * The text is written straight to the DOM on each animation frame, so a big cash swing doesn't re-render React.
 * The flash is the `odo-up` / `odo-down` class: style them in your skin.css (the base does).
 */
export function Odometer({ value, format = (n) => String(Math.round(n)), className = "", flash = true }: { value: number; format?: (n: number) => string; className?: string; flash?: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const from = shown.current;
    const to = value;
    // Nothing to roll or flash when the numbers differ but the text wouldn't (a day's pennies on $4.35M).
    if (from === to || fmt.current(from) === fmt.current(to)) {
      shown.current = to;
      node.textContent = fmt.current(to);
      return;
    }
    if (flash) {
      node.classList.remove("odo-up", "odo-down");
      void node.offsetWidth; // restart the animation
      node.classList.add(to > from ? "odo-up" : "odo-down");
    }
    if (reducedMotion()) {
      shown.current = to;
      node.textContent = fmt.current(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const u = Math.min(1, (now - t0) / ROLL_MS);
      shown.current = from + (to - from) * easeOut(u);
      node.textContent = fmt.current(u >= 1 ? to : shown.current);
      if (u < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value, flash]);

  return (
    <span ref={el} className={`odo ${className}`}>
      {format(value)}
    </span>
  );
}
