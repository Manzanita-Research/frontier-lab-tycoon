// How slots reach their skin: the strings, and the other slots (a Layout or a modal composes its neighbours).
import { createContext, useContext, type ReactNode } from "react";
import { fillString } from "./schema";
import type { LoadedSkin } from "./types";

const SkinContext = createContext<LoadedSkin | null>(null);

export function SkinProvider({ skin, children }: { skin: LoadedSkin; children: ReactNode }) {
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}

export function useSkin(): LoadedSkin {
  const skin = useContext(SkinContext);
  if (!skin) throw new Error("useSkin: no SkinProvider above this component");
  return skin;
}

/** What the tutorial is pointing at ("build:path", "staff:hire", "training", ...), or null. Set by the host from the view-model. */
const HighlightContext = createContext<string | null>(null);
export const HighlightProvider = HighlightContext.Provider;

/**
 * `const hl = useHighlight(); ... className={hl("build:hall") ? "flt-hl" : ""}`: is the tutorial pointing at this? Give the
 * thing the `flt-hl` class and the pulsing ring (skinnable: `color.highlight`, `motion.pulse`) comes with it.
 */
export function useHighlight(): (target: string) => boolean {
  const target = useContext(HighlightContext);
  return (t) => target === t;
}

/** The other slots of the active skin, for slots that compose them. */
export const useSlots = () => useSkin().slots;

/** `t("speed.pause")`, `t("inspector.title", { name })`: the skin's copy, with `{name}` placeholders filled in. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { strings } = useSkin();
  return (key, vars) => fillString(strings[key] ?? key, vars);
}
