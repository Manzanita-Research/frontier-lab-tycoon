// The coach mark: on a build step everything is dimmed except the one thing to click (on the others only the ring shows), and the
// active skin's `Coach` slot says the line. It steps aside while a card or a dialog is up, and keeps off open windows. Skin
// independent on purpose: what to light is found by `[data-coach-active]` (every skin marks its targets with the kit's
// `useCoach`), so a new skin gets the spotlight for free. The dimming never eats a click: the player can always do the thing.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useSkin } from "../../skins/context";
import type { Rect } from "../../skins/kit/place";
import type { HudActions, HudVM } from "./types";
import { ANCHOR } from "./anchors";
import { guard } from "./guard";
import { arrowPlace, clickedAnchor, domCovers, domPage, newWalk, walkStep, type ArrowPoint } from "./showMe";

const PAD = 7;

const sameRect = (a: Rect | null, b: Rect | null) => (a === null || b === null ? a === b : Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);

/** The popup (marked `data-coach-panel`) a target sits in, if any: a balloon must keep off all of it, not just off the target. */
function measurePanel(target: string, guide = false): Rect | null {
  if (typeof document === "undefined" || target === "map:suggest") return null;
  const marked = guide ? `[${ANCHOR}="${CSS.escape(target)}"]` : "[data-coach-active]";
  const panel = document.querySelector<HTMLElement>(marked)?.closest<HTMLElement>("[data-coach-panel]");
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

const NONE: Found = { rect: null, panel: null, avoid: [] };

/** What a DOM change looks like to the coach (a `MutationRecord`, cut down so it is tested without a DOM). */
export interface WindowChange {
  target: { nodeType: number; matches?(selector: string): boolean };
  addedNodes: ArrayLike<{ nodeType: number; matches?(selector: string): boolean; querySelector?(selector: string): unknown }>;
}

/**
 * A window opened, or one folded or unfolded (its body came or went): the coach must look again before the frame is painted, or
 * its balloon sits on that window until the next look (FLT-77: the Properties window the "read a researcher's mind" step opens).
 * Changes inside a window (a stat ticking, a tab) are left to the ten looks a second.
 */
export function opensWindow(change: WindowChange): boolean {
  const AVOID = "[data-coach-avoid]";
  if (change.target.nodeType === 1 && change.target.matches?.(AVOID)) return true;
  for (let i = 0; i < change.addedNodes.length; i++) {
    const node = change.addedNodes[i]!;
    if (node.nodeType === 1 && (node.matches?.(AVOID) || node.querySelector?.(AVOID))) return true;
  }
  return false;
}

/**
 * Follow the target (a menu opening, a window moving) without re-rendering per frame: state changes only when a box moves. It
 * looks when the target changes and whenever a window opens, before the frame is painted, and ten times a second besides.
 */
function useSpotlight(target: string | null, guide = false): Found {
  const [found, setFound] = useState<Found>(NONE);
  useLayoutEffect(() => {
    if (!target) {
      setFound(NONE);
      return;
    }
    let raf = 0;
    let checked = 0;
    let last: Found = NONE;
    // FLT-93: [Show me] finds its own way to the anchor, clicking the doors on the way (`showMe.ts`). A skin's door that
    // throws ends the walk where it stands, with a snag toast, not the game.
    const walk = newWalk();
    const page = guide ? domPage() : null;
    const measure = (): Rect | null => (page ? guard("showMe.walk", () => walkStep(target, page, walk).lit, null) : measureTarget(target));
    const look = (now: boolean) => {
      const rect = measure();
      const panel = rect ? measurePanel(target, guide) : null;
      const avoid = measureAvoid();
      if (sameRect(rect, last.rect) && sameRect(panel, last.panel) && sameRects(avoid, last.avoid)) return;
      last = { rect, panel, avoid };
      // A window just opened: move the balloon in this frame, not the next one.
      if (now) flushSync(() => setFound(last));
      else setFound(last);
    };
    // Ten looks a second are plenty to follow a menu or a window; asking the layout every frame costs the map frames on a slow machine.
    const frame = (t: number) => {
      if (t - checked >= 90) {
        checked = t;
        look(false);
      }
      raf = requestAnimationFrame(frame);
    };
    // A new step knows where the windows are in its first frame (in a layout effect, a state change lands before the paint).
    look(false);
    raf = requestAnimationFrame(frame);
    const opened = typeof MutationObserver === "undefined" ? null : new MutationObserver((changes) => {
      if (changes.some(opensWindow)) look(true);
    });
    opened?.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      opened?.disconnect();
    };
  }, [target, guide]);
  return found;
}

/**
 * The dimming with a hole in it, and the pulsing ring round the hole. The dimming is drawn once (it repaints only when the box
 * moves) and the ring is its own small layer that pulses by transform and opacity, so nothing repaints per frame over the map.
 */
/** FLT-93: [Show me]'s arrow: above the target, or wherever round it is on screen and off the other controls. */
const ARROW = 34;
type Arrow = { point: ArrowPoint; at: Rect };

function arrowFor(rect: Rect): Arrow {
  const hole = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
  const view = typeof window === "undefined" ? { w: 1440, h: 900 } : { w: window.innerWidth, h: window.innerHeight };
  return guard("showMe.arrow", () => arrowPlace(hole, ARROW, view, domCovers(hole)), arrowPlace(hole, ARROW, view, () => false));
}

/** The box the balloon must keep off: the lit hole, and the arrow when there is one. */
function keepOff(rect: Rect, arrow: Arrow | null): Rect {
  const box = { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
  if (!arrow) return box;
  const x = Math.min(box.x, arrow.at.x);
  const y = Math.min(box.y, arrow.at.y);
  return { x, y, w: Math.max(box.x + box.w, arrow.at.x + arrow.at.w) - x, h: Math.max(box.y + box.h, arrow.at.y + arrow.at.h) - y };
}

function Spotlight({ rect, dim, arrow = null }: { rect: Rect; dim: boolean; arrow?: Arrow | null }) {
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
      {arrow && (
        <div
          className={`coach-arrow ${arrow.point}`}
          aria-hidden
          data-testid="coach-arrow"
          style={{ left: arrow.at.x, top: arrow.at.y, width: arrow.at.w, height: arrow.at.h }}
        />
      )}
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

/**
 * FLT-93: [Show me] is over when the player clicks the thing it points at (the click goes through: they meant it), or
 * presses Escape. The skin's "Got it" ends it too. A click the walk made itself is not the player's.
 */
function useGuideEnds(target: string | null, end: () => void) {
  useEffect(() => {
    if (!target || typeof document === "undefined") return;
    const onClick = (e: MouseEvent) => {
      if (e.isTrusted && clickedAnchor(e.target, target)) setTimeout(end, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [target, end]);
}

export function CoachLayer({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const { Coach } = useSkin().slots;
  const coach = coachWaits(vm) ? null : vm.coach;
  const guide = coach?.guide === true;
  const { rect, panel, avoid } = useSpotlight(coach ? (guide ? coach.target : spotlightTarget(vm)) : null, guide);
  useGuideEnds(guide ? coach!.target : null, actions.endShowMe);
  if (!coach) return null;
  const arrow = guide && rect ? arrowFor(rect) : null;
  return (
    <>
      {rect && <Spotlight rect={rect} dim={coach.dim === true} arrow={arrow} />}
      <Coach coach={coach} anchor={rect && keepOff(rect, arrow)} panel={panel} avoid={avoid} layout={vm.layout} actions={actions} />
    </>
  );
}
