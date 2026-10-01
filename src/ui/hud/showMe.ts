// FLT-93: [Show me]'s walk. The anchor is on the page: light it. It isn't (it is in a shut menu, a folded window, a tab
// behind another): click the door that opens it, look again next time, and light the door meanwhile so the player sees
// where the pointer is going. Nothing left to click (the player shut the menu again): light the way in and wait. The
// page is an interface so the walk is tested without a DOM; `domPage()` is the real one.
import { ANCHOR, DOOR, nextDoor, standInDoor, type DoorSeen } from "./anchors";
import type { Rect } from "../../skins/kit/place";

/** A control on the page, as the walk sees it. `key` is its identity across looks (the element). */
export interface PageEl {
  key: unknown;
  rect: Rect;
  /** Its `data-anchor-opens` patterns, if it is a door. */
  opens: string | null;
  /** Its panel is showing (`aria-expanded` / `aria-selected` / `aria-pressed`): clicking would shut it. */
  open: boolean;
  depth: number;
  click(): void;
}

export interface Page {
  /** The visible controls marked `data-anchor="<id>"`, in page order. */
  anchors(id: string): PageEl[];
  /** The visible doors. */
  doors(): PageEl[];
}

/** One walk's memory: the doors it has clicked. A door is clicked once; a walk clicks at most `MAX_CLICKS`. */
export interface Walk {
  tried: Set<unknown>;
  clicks: number;
}
export const MAX_CLICKS = 6;
export const newWalk = (): Walk => ({ tried: new Set(), clicks: 0 });

export interface WalkStep {
  /** What to light: the anchor, or the door on the way to it. */
  lit: Rect | null;
  /** The anchor itself is lit (the walk has arrived). */
  arrived: boolean;
}

/** Look once: light the anchor if it is there, else click the next door (at most once per look). */
export function walkStep(id: string, page: Page, walk: Walk): WalkStep {
  const here = page.anchors(id)[0];
  if (here) return { lit: here.rect, arrived: true };
  const doors = page.doors();
  const seen: DoorSeen[] = doors.map((d) => ({ opens: d.opens ?? "", depth: d.depth, open: d.open, tried: walk.tried.has(d.key) }));
  const next = walk.clicks < MAX_CLICKS ? nextDoor(id, seen) : -1;
  if (next >= 0) {
    const door = doors[next]!;
    walk.tried.add(door.key);
    walk.clicks++;
    door.click();
    return { lit: door.rect, arrived: false };
  }
  const stand = standInDoor(id, seen);
  return { lit: stand >= 0 ? doors[stand]!.rect : null, arrived: false };
}

// ---- The real page --------------------------------------------------------------------------------------------

const rectOf = (el: HTMLElement): Rect | null => {
  const b = el.getBoundingClientRect();
  if (b.width <= 0 || b.height <= 0) return null;
  if (typeof el.checkVisibility === "function" && !el.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)) return null;
  return { x: b.left, y: b.top, w: b.width, h: b.height };
};

const depthOf = (el: Element): number => {
  let n = 0;
  for (let p = el.parentElement; p; p = p.parentElement) n++;
  return n;
};

const isOpen = (el: Element): boolean => ["aria-expanded", "aria-selected", "aria-pressed"].some((a) => el.getAttribute(a) === "true");

function pageEl(el: HTMLElement): PageEl | null {
  const rect = rectOf(el);
  return rect && { key: el, rect, opens: el.getAttribute(DOOR), open: isOpen(el), depth: depthOf(el), click: () => el.click() };
}

const visible = (els: Iterable<HTMLElement>): PageEl[] => [...els].flatMap((el) => pageEl(el) ?? []);

export function domPage(root: ParentNode = document): Page {
  return {
    anchors: (id) => visible(root.querySelectorAll<HTMLElement>(`[${ANCHOR}="${CSS.escape(id)}"]`)),
    doors: () => visible(root.querySelectorAll<HTMLElement>(`[${DOOR}]`)),
  };
}

/** The anchor (or something inside it) was the thing the player clicked: the walk is over. */
export const clickedAnchor = (target: EventTarget | null, id: string): boolean =>
  typeof Element !== "undefined" && target instanceof Element && target.closest(`[${ANCHOR}="${CSS.escape(id)}"]`) !== null;

// ---- The arrow --------------------------------------------------------------------------------------------------

/** Which way the arrow points: `down` sits above the lit thing, `up` below it, `right` to its left, `left` to its right. */
export type ArrowPoint = "down" | "up" | "right" | "left";
const ARROW_ORDER: readonly ArrowPoint[] = ["down", "up", "right", "left"];

/**
 * Where [Show me]'s arrow goes round the lit box: above it first, then below, left and right, the first that is on screen
 * and does not sit on another control (`covers` asks the page; an arrow over the next row's Hire button points at the wrong
 * one). None clear: the first on screen.
 */
export function arrowPlace(hole: Rect, size: number, view: { w: number; h: number }, covers: (at: Rect) => boolean): { point: ArrowPoint; at: Rect } {
  const cx = hole.x + hole.w / 2 - size / 2;
  const cy = hole.y + hole.h / 2 - size / 2;
  const at: Record<ArrowPoint, Rect> = {
    down: { x: cx, y: hole.y - size - 2, w: size, h: size },
    up: { x: cx, y: hole.y + hole.h + 2, w: size, h: size },
    right: { x: hole.x - size - 2, y: cy, w: size, h: size },
    left: { x: hole.x + hole.w + 2, y: cy, w: size, h: size },
  };
  const onScreen = (r: Rect) => r.x >= 4 && r.y >= 4 && r.x + r.w <= view.w - 4 && r.y + r.h <= view.h - 4;
  const fits = ARROW_ORDER.filter((p) => onScreen(at[p]));
  const point = fits.find((p) => !covers(at[p])) ?? fits[0] ?? "down";
  return { point, at: at[point] };
}

/** The page's answer for `covers`: a button, link or anchor under the arrow that is not the lit thing itself. */
export function domCovers(hole: Rect): (at: Rect) => boolean {
  return (at) => {
    if (typeof document === "undefined") return false;
    const probes = [
      [at.x + at.w / 2, at.y + at.h / 2],
      [at.x + 4, at.y + 4],
      [at.x + at.w - 4, at.y + at.h - 4],
    ] as const;
    return probes.some(([x, y]) => {
      const hit = document.elementFromPoint(x, y)?.closest("button, a, input, select, [data-anchor]");
      if (!hit) return false;
      const b = hit.getBoundingClientRect();
      const mx = b.left + b.width / 2;
      const my = b.top + b.height / 2;
      return !(mx >= hole.x && mx <= hole.x + hole.w && my >= hole.y && my <= hole.y + hole.h);
    });
  };
}
