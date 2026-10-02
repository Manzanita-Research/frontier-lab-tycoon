import { useEffect, useRef, useState } from "react";

/** Where a host element goes: inside `parent`, before `before` (null: at the end). */
export type Spot = { parent: Element; before: Node | null } | null;

/**
 * An element of our own inside the skin's UI, kept in its spot as the skin re-renders, for a portal to fill. The skin
 * owns that UI; this only adds to it, so builds without accounts are untouched (when accounts are on for good, what
 * goes in here moves into the skin's own slots). Null while the spot isn't on screen.
 */
export function useHost(find: () => Spot, className: string, tag: "div" | "li" = "div", enabled = true): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const finder = useRef(find);
  finder.current = find;
  useEffect(() => {
    if (!enabled) return;
    const el = document.createElement(tag);
    el.className = className;
    const place = () => {
      const spot = finder.current();
      if (!spot) {
        el.remove();
        setHost(null);
        return;
      }
      const before = spot.before === el ? el.nextSibling : spot.before;
      if (el.parentElement !== spot.parent || el.nextSibling !== before) spot.parent.insertBefore(el, before);
      setHost(el);
    };
    const watch = new MutationObserver(place);
    watch.observe(document.body, { childList: true, subtree: true });
    place();
    return () => {
      watch.disconnect();
      el.remove();
      setHost(null);
    };
  }, [className, tag, enabled]);
  return host;
}
