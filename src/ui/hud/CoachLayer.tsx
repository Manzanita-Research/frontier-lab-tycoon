// The coach mark: on a build step everything is dimmed except the one thing to click (on the others only the ring shows), and the
// active skin's `Coach` slot says the line. It steps aside while a card or a dialog is up, and keeps off open windows. Skin
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

/**
 * The open windows (marked `data-coach-avoid`) the balloon must not cover, less the one the target is in: it is pointing at that.
 */
export function measureAvoid(): Rect[] {
  if (typeof document === "undefined") return [];
  const out: Rect[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("[data-coach-avoid]")) {
    if (el.matches("[data-coach-active]") || el.querySelector("[data-coach-active]")) continue;
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.height > 0) out.push({ x: b.left, y: b.top, w: b.width, h: b.height });
  }
  return out;
}

const sameRects = (a: Rect[], b: Rect[]) => a.length === b.length && a.every((r, i) => sameRect(r, b[i]!));

interface Found {
  rect: Rect | null;
  panel: Rect | null;
  avoid: Rect[];
}

/** Follow the target (a menu opening, a window moving) without re-rendering per frame: state changes only when a box moves. */
function useSpotlight(target: string | null): Found {
  const [found, setFound] = useState<Found>({ rect: null, panel: null, avoid: [] });
  useEffect(() => {
    if (!target) {
      setFound({ rect: null, panel: null, avoid: [] });
      return;
    }
    let raf = 0;
    let checked = 0;
    let last: Found = { rect: null, panel: null, avoid: [] };
    // Ten looks a second are plenty to follow a menu or a window; asking the layout every frame costs the map frames on a slow machine.
    const frame = (now: number) => {
      if (now - checked >= 90) {
        checked = now;
        const rect = measureTarget(target);
        const panel = rect ? measurePanel(target) : null;
        const avoid = measureAvoid();
        if (!sameRect(rect, last.rect) || !sameRect(panel, last.panel) || !sameRects(avoid, last.avoid)) {
          last = { rect, panel, avoid };
          setFound(last);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return found;
}

/**
 * The dimming with a hole in it, and the pulsing ring round the hole. The dimming is drawn once (it repaints only when the box
 * moves) and the ring is its own small layer that pulses by transform and opacity, so nothing repaints per frame over the map.
 */
function Spotlight({ rect, dim }: { rect: Rect; dim: boolean }) {
  const hole = { x: rect.x - PAD, y: rect.y - PAD, width: rect.w + PAD * 2, height: rect.h + PAD * 2 };
  const id = useRef(`coach-hole-${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <>
      {dim && <svg className="coach-scrim" aria-hidden width="100%" height="100%" data-testid="coach-scrim">
        <defs>
          <mask id={id}>
            <rect width="100%" height="100%" fill="white" />
            <rect {...hole} rx="10" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" style={{ fill: "var(--flt-color-scrim)" }} mask={`url(#${id})`} />
      </svg>}
      <div className="coach-ring" aria-hidden style={{ left: hole.x, top: hole.y, width: hole.width, height: hole.height }} />
    </>
  );
}

/**
 * What to light. A tool in the build panel is lit until it is in hand; then the next thing to do is on the map, so the ghost tiles are
 * (and if the game shows none, nothing is: the map is not dimmed while somebody is drawing on it).
 */
function spotlightTarget(vm: HudVM): string | null {
  const target = vm.coach?.target ?? null;
  if (target?.startsWith("build:") && vm.buildItems.some((it) => it.selected && `build:${it.kind}` === target)) return "map:suggest";
  return target;
}

/** A card or a dialog has the floor: the coach waits until it is closed rather than talk over it (FLT-58). */
export const coachWaits = (vm: HudVM): boolean => !!(vm.unlock || vm.event || vm.confirm || vm.eraCard || vm.outcome);

export function CoachLayer({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { Coach } = useSkin().slots;
  const coach = coachWaits(vm) ? null : vm.coach;
  const { rect, panel, avoid } = useSpotlight(coach ? spotlightTarget(vm) : null);
  if (!coach) return null;
  return (
    <>
      {rect && <Spotlight rect={rect} dim={coach.dim === true} />}
      <Coach coach={coach} anchor={rect && { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 }} panel={panel} avoid={avoid} layout={vm.layout} actions={actions} />
    </>
  );
}
