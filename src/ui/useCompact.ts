import { useSyncExternalStore } from "react";

/** The phone layout kicks in at this width (px): the CSS media queries use the same number. */
export const COMPACT_MAX = 640;
const query = () => window.matchMedia(`(max-width: ${COMPACT_MAX}px)`);

function subscribe(onChange: () => void) {
  const mq = query();
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Is the screen phone-narrow? The HUD folds itself up (one-row top bar, icon buttons, a bottom-sheet inspector) when it is. */
export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, () => query().matches, () => false);
}
