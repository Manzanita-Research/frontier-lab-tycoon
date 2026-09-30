import { useLayoutEffect, useRef } from "react";
import type { TickerItemVM } from "../../ui/hud/types";

/**
 * An endless news tape, driven by hand so new headlines join the tail without restarting it. Put it inside a box with
 * `overflow: hidden` (the "view"); the track it draws is `position: relative; display: flex` and moves with a
 * transform, one `<span class="tick {tone}">` per headline. Style `.tick` in your skin.css.
 */
export function Marquee({ items, pxPerSecond = 70, className = "marquee-track" }: { items: readonly TickerItemVM[]; pxPerSecond?: number; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const latest = useRef(items);
  latest.current = items;
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const history: TickerItemVM[] = [];
    let seenId = 0;
    let cycle = 0;
    let offset = 0;
    let last = performance.now();
    let raf = 0;
    const add = (n: TickerItemVM) => {
      const span = document.createElement("span");
      span.className = `tick ${n.tone}`;
      span.textContent = n.text;
      el.appendChild(span);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const n of latest.current) {
        if (n.id > seenId) {
          seenId = n.id;
          history.push(n);
          add(n);
        }
      }
      const viewport = el.parentElement!.clientWidth;
      // Never let the tape run dry: replay old headlines behind the new ones.
      let guard = 0;
      while (el.scrollWidth - offset < viewport * 1.5 && history.length > 0 && guard++ < 8) add(history[cycle++ % history.length]!);
      offset += dt * pxPerSecond;
      let first = el.firstElementChild as HTMLElement | null;
      while (first && offset > first.offsetWidth) {
        offset -= first.offsetWidth;
        first.remove();
        first = el.firstElementChild as HTMLElement | null;
      }
      el.style.transform = `translateX(${-offset}px)`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pxPerSecond]);
  return <div className={className} ref={track} />;
}
