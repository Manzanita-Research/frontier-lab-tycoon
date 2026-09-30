// The coach mark: everything is dimmed except the one thing to click, and the active skin's `Coach` slot says the line. Skin
// independent on purpose: what to light is found by `[data-coach-active]` (every skin marks its targets with the kit's
// `useCoach`), so a new skin gets the spotlight for free. The dimming never eats a click: the player can always do the thing.
import { useEffect, useRef, useState } from "react";
import { useSkin } from "../../skins/context";
import type { Rect } from "../../skins/kit/place";
import type { HudActions, HudVM } from "./types";

const PAD = 7;

const sameRect = (a: Rect | null, b: Rect | null) => (a === null || b === null ? a === b : Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);

/** The popup (marked `data-coach-panel`) a target sits in, if any: a balloon must keep off all of it, not just off the target. */
function measurePanel(target: string): Rect | null {
  if (typeof document === "undefined" || target === "map:suggest") return null;
  const panel = document.querySelector<HTMLElement>("[data-coach-active]")?.closest<HTMLElement>("[data-coach-panel]");
  if (!panel) return null;
  const b = panel.getBoundingClientRect();
  return b.width > 0 && b.height > 0 ? { x: b.left, y: b.top, w: b.width, h: b.height } : null;
}

/** Where the coach's target is on screen right now: the element marked `data-coach-active`, or the ghost tiles for "map:suggest". */
export function measureTarget(target: string): Rect | null {
  if (typeof document === "undefined") return null;
  const els = target === "map:suggest" ? [...document.querySelectorAll<HTMLElement>("[data-coach-tile]")] : [...document.querySelectorAll<HTMLElement>("[data-coach-active]")].slice(0, 1);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of els) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    x0 = Math.min(x0, b.left);
    y0 = Math.min(y0, b.top);
    x1 = Math.max(x1, b.right);
    y1 = Math.max(y1, b.bottom);
  }
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Follow the target (a menu opening, a window moving) without re-rendering per frame: state changes only when a box moves. */
function useSpotlight(target: string | null): { rect: Rect | null; panel: Rect | null } {
  const [found, setFound] = useState<{ rect: Rect | null; panel: Rect | null }>({ rect: null, panel: null });
  useEffect(() => {
    if (!target) {
      setFound({ rect: null, panel: null });
      return;
    }
    let raf = 0;
    let last: { rect: Rect | null; panel: Rect | null } = { rect: null, panel: null };
    const frame = () => {
      const rect = measureTarget(target);
      const panel = rect ? measurePanel(target) : null;
      if (!sameRect(rect, last.rect) || !sameRect(panel, last.panel)) {
        last = { rect, panel };
        setFound(last);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return found;
}

/** The dimming with a hole in it, and the pulsing ring round the hole. */
function Spotlight({ rect }: { rect: Rect }) {
  const hole = { x: rect.x - PAD, y: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 };
  const id = useRef(`coach-hole-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <svg className="coach-scrim" aria-hidden width="100%" height="100%" data-testid="coach-scrim">
      <defs>
        <mask id={id}>
          <rect width="100%" height="100%" fill="white" />
          <rect {...hole} rx="10" fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" style={{ fill: "var(--flt-color-scrim)" }} mask={`url(#${id})`} />
      <rect className="coach-ring" {...hole} rx="10" fill="none" style={{ stroke: "var(--flt-color-highlight)" }} strokeWidth="3" />
    </svg>
  );
}

export function CoachLayer({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { Coach } = useSkin().slots;
  const coach = vm.coach;
  const { rect, panel } = useSpotlight(coach?.target ?? null);
  if (!coach) return null;
  return (
    <>
      {rect && <Spotlight rect={rect} />}
      <Coach coach={coach} anchor={rect && { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 }} panel={panel} layout={vm.layout} actions={actions} />
    </>
  );
}
