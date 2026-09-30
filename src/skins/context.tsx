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

/** What the coach is pointing at right now ("start", "build:path", ...), or null. Set by the host from the view-model. */
const CoachContext = createContext<string | null>(null);
export const CoachProvider = CoachContext.Provider;

export interface CoachApi {
  /** The current target, or null when nobody is coaching. */
  target: string | null;
  /**
   * The attributes a coach target carries: `data-coach="<id>"` always, and `data-coach-active` while that is what the coach is
   * pointing at. `alsoActive` lets a shut container stand in for what is inside it: a closed Start menu is the active target while
   * the coach points at one of its items, so the spotlight never has nothing to light.
   */
  attrs(id: string, alsoActive?: boolean): { "data-coach": string; "data-coach-active"?: "" };
  /**
   * True while the coach points at a tool in the build panel that is not in hand yet: a shut panel's opener stands in for
   * it (`attrs("start", !open && coach.intoPanel(items))`). Once the tool is picked the next thing to do is on the map, so it stops.
   */
  intoPanel(items: readonly { kind: string; selected: boolean }[]): boolean;
}

/** `<button {...coach.attrs("build:path")}>`: mark a thing the coach may point at (in every skin: the stranger test clicks these). */
export function useCoach(): CoachApi {
  const target = useContext(CoachContext);
  return {
    target,
    attrs: (id, alsoActive = false) => (target === id || alsoActive ? { "data-coach": id, "data-coach-active": "" } : { "data-coach": id }),
    intoPanel: (items) => !!target?.startsWith("build:") && !items.some((it) => it.selected && `build:${it.kind}` === target),
  };
}

/** The other slots of the active skin, for slots that compose them. */
export const useSlots = () => useSkin().slots;

/** `t("speed.pause")`, `t("inspector.title", { name })`: the skin's copy, with `{name}` placeholders filled in. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { strings } = useSkin();
  return (key, vars) => fillString(strings[key] ?? key, vars);
}
