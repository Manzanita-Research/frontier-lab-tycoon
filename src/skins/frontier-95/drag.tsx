// Dragging a window by its title bar (FLT-90), the 1995 way: while the button is down only a dotted outline moves,
// and the window jumps to it when the button comes up (Esc puts it back). That is how the real thing did it before
// "Show window contents while dragging" was an option, and it means nothing reflows while you drag.
//
// A moved window leaves the auto-layout (it is `position: fixed` where it was dropped), so the column closes up behind
// it and the stack never folds it. Windows are remembered per id and per skin (`places.ts`); message boxes are not,
// and open in the middle again next time, as message boxes did. On a phone (FLT-87) nothing drags: the sheets and the
// strip keep their own layout, and positions saved on a desktop wait for a wider screen.
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useSkinId } from "../context";
import { clampPlace, makeOrder, makePlaces, Z_BASE, type Place, type Places, type View } from "./places";

/** `vm.layout.compact`: at this width and under, windows are sheets and do not drag. */
export const COMPACT_MAX = 640;
/** How far the pointer must travel before a press on the title bar becomes a drag (so a click stays a click). */
const SLOP = 4;

const stores = new Map<string, Places>();
export function placesFor(skin: string): Places {
  let places = stores.get(skin);
  if (!places) {
    places = makePlaces(skin, storage());
    stores.set(skin, places);
  }
  return places;
}
function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Front to back, for every window on the page (only the HUD's windows take part). */
export const order = makeOrder();

const never = () => () => {};
const zero = () => 0;
const onResize = (f: () => void) => {
  window.addEventListener("resize", f);
  return () => window.removeEventListener("resize", f);
};
const viewKey = () => `${window.innerWidth}x${window.innerHeight}`;
const viewNow = (): View => ({ width: window.innerWidth, height: window.innerHeight });

/** The screen size, re-read on resize (null on the server, where nothing drags). */
function useView(): View | null {
  const key = useSyncExternalStore(onResize, viewKey, () => "");
  if (!key) return null;
  const [width, height] = key.split("x").map(Number) as [number, number];
  return { width, height };
}

/** The active skin's positions, and whether this screen is wide enough to drag on (re-rendering when either changes). */
function usePlaces(): { places: Places | null; view: View | null; desk: boolean } {
  const skin = useSkinId();
  const view = useView();
  const places = skin ? placesFor(skin) : null;
  useSyncExternalStore(places?.subscribe ?? never, places?.version ?? zero, zero);
  return { places, view, desk: !!view && view.width > COMPACT_MAX };
}

/** Has the player moved this window out of the auto-layout? (The stack leaves a moved window alone.) */
export function useMoved(id: string): boolean {
  const { places, desk } = usePlaces();
  return desk && !!places?.get(id);
}

/** For Start ▸ Settings ▸ Reset window positions. `shown` is false on a phone, where nothing drags. */
export function useResetPlaces(): { shown: boolean; any: boolean; reset: () => void } {
  const { places, desk } = usePlaces();
  return { shown: desk && !!places, any: !!places?.any(), reset: () => places?.reset() };
}

/** A window inside a window (a Properties sheet over a document) moves with its parent, not on its own. */
export const InWin = createContext(false);

interface Drag {
  pointer: number;
  sx: number;
  sy: number;
  box: DOMRect;
  to: Place | null;
  ghost: HTMLDivElement | null;
  esc: (e: KeyboardEvent) => void;
}

/**
 * Everything a window needs to drag: `id` names it (null: it does not drag), `remember` keeps its place across reloads.
 * Returns the props for the window (`win`) and its title bar (`bar`).
 */
export function useWinDrag(id: string | null, remember: boolean) {
  const nested = useContext(InWin);
  const { places, view, desk } = usePlaces();
  useSyncExternalStore(order.subscribe, order.version, zero);
  const [session, setSession] = useState<Place | null>(null);
  const el = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const swallow = useRef(false);
  const on = !!id && !nested && desk;

  const saved = on ? (remember ? places?.get(id) : session) : undefined;
  const place = saved && view ? clampPlace(saved, view) : null;
  const z = on ? order.z(id) : undefined;

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return null;
    d.ghost?.remove();
    window.removeEventListener("keydown", d.esc, true);
    return d;
  };
  // A window that closes mid-drag takes its outline with it.
  useEffect(() => () => void end(), []);

  // A slip here must never cost more than the drag: the outline goes, the window stays where it was, the game goes on.
  const safe =
    <E,>(f: (e: E) => void) =>
    (e: E) => {
      try {
        f(e);
      } catch (err) {
        end();
        console.error("[f95] a window drag failed; the window stays put.", err);
      }
    };

  const style: CSSProperties | undefined = place
    ? { position: "fixed", left: place.x, top: place.y, right: "auto", bottom: "auto", width: place.w, margin: 0, transform: "none", zIndex: z ?? Z_BASE }
    : z !== undefined
      ? { zIndex: z }
      : undefined;

  return {
    on,
    moved: !!place,
    win: {
      ref: el,
      style,
      onPointerDownCapture: safe(() => {
        if (on) order.raise(id);
      }),
    },
    bar: on
      ? {
          onPointerDown: safe((e: ReactPointerEvent<HTMLElement>) => {
            if (e.button !== 0 || !el.current || (e.target as Element).closest("button, a, input, select, textarea")) return;
            end();
            const esc = (k: KeyboardEvent) => {
              if (k.key !== "Escape") return;
              k.stopPropagation();
              end();
            };
            window.addEventListener("keydown", esc, true);
            drag.current = { pointer: e.pointerId, sx: e.clientX, sy: e.clientY, box: el.current.getBoundingClientRect(), to: null, ghost: null, esc };
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }),
          onPointerMove: safe((e: ReactPointerEvent<HTMLElement>) => {
            const d = drag.current;
            if (!d || e.pointerId !== d.pointer) return;
            const dx = e.clientX - d.sx;
            const dy = e.clientY - d.sy;
            if (!d.ghost && Math.hypot(dx, dy) < SLOP) return;
            d.to = clampPlace({ x: d.box.left + dx, y: d.box.top + dy, w: d.box.width }, viewNow());
            if (!d.ghost) {
              d.ghost = document.createElement("div");
              d.ghost.className = "f95-ghost";
              d.ghost.setAttribute("aria-hidden", "true");
              d.ghost.style.width = `${d.box.width}px`;
              d.ghost.style.height = `${d.box.height}px`;
              document.body.appendChild(d.ghost);
            }
            d.ghost.style.transform = `translate(${d.to.x}px, ${d.to.y}px)`;
          }),
          onPointerUp: safe((e: ReactPointerEvent<HTMLElement>) => {
            if (drag.current?.pointer !== e.pointerId) return;
            const d = end();
            if (!d?.ghost || !d.to) return;
            // The press became a drag: the click that follows is not a click on the title bar.
            swallow.current = true;
            setTimeout(() => (swallow.current = false), 0);
            if (remember) places?.set(id!, d.to);
            else setSession(d.to);
            order.raise(id!);
          }),
          onPointerCancel: safe(() => void end()),
          onClickCapture: (e: ReactMouseEvent) => {
            if (!swallow.current) return;
            swallow.current = false;
            e.stopPropagation();
            e.preventDefault();
          },
        }
      : {},
  };
}
