// FLT-93: the anchor ids, as a skin marks them. `{...anchor("hire:sre")}` on the Hire button; `{...door("hire:*")}` on
// what opens the panel it sits in. [Show me] and the coach find their way by these alone (src/ui/hud/showMe.ts), so a
// skin can lay its menus out however it likes. The ids are listed in src/content/anchors.ts.
import { useSkin } from "../context";

export const anchor = (id: string): { "data-anchor": string } => ({ "data-anchor": id });

/** A control that reveals these anchors when clicked (`build:*`, `hire:*`, an exact id). */
export const door = (...opens: string[]): { "data-anchor-opens": string } => ({ "data-anchor-opens": opens.join(" ") });

/** A control that is also the way to these anchors, standing in for them (the tray's rank chip opens the leaderboard, as `app:arena` does). */
export const standsFor = (...ids: string[]): { "data-anchor-also": string } => ({ "data-anchor-also": ids.join(" ") });

/**
 * Where an anchor lives, in the skin's words: `where.<id>` ("where.hire:sre"), then `where.<kind>` ("where.hire"), from
 * the skin's strings. Null: the skin has nothing to say, and [Show me] does the talking.
 */
export function whereOf(strings: Readonly<Record<string, string>>, id: string): string | null {
  return strings[`where.${id}`] ?? strings[`where.${id.split(":")[0]}`] ?? null;
}

export function useWhere(): (id: string) => string | null {
  const { strings } = useSkin();
  return (id) => whereOf(strings, id);
}
