// FLT-94: what Quick Launch holds. Applets only, never a building tool: the Facilities palette (which is an app, the way a
// 1995 Control Panel was), the Staff Manager, the leaderboard, then everything else the lab has earned, in the order a
// player reaches for them. Pure, so the tests can read the list without a DOM.
import type { HudVM, WidgetVM } from "../../ui/hud/types";

export interface QuickApp {
  /** The widget id (`actions.openWidget(id)`), or "facilities" for the palette. */
  id: string;
  /** `data-anchor`: `app:<id>`, stable for the coach (FLT-93). The leaderboard is `app:arena`. */
  anchor: string;
  name: string;
  /** The tooltip: the name, then what it is. */
  tip: string;
  icon: string;
}

/** The order, and the icon and the 1995 name each applet goes by here. Ids missing from `vm.widgets` are not earned yet. */
export const QUICK: readonly { id: string; name: string; icon: string }[] = [
  { id: "facilities", name: "Facilities", icon: "build" },
  { id: "staff", name: "Staff Manager", icon: "staff" },
  { id: "arena", name: "Leaderboard", icon: "trophy" },
  { id: "bird", name: "Bird App", icon: "bird" },
  { id: "finance", name: "Finance", icon: "chart" },
  { id: "thoughts", name: "Thoughts.txt", icon: "chat" },
  { id: "news", name: "The Frontier Times", icon: "news" },
  { id: "drama", name: "Today's Drama", icon: "drama" },
  { id: "papers", name: "Publish or Perish", icon: "doc" },
  { id: "discourse", name: "Discourse Monitor", icon: "megaphone" },
  { id: "traffic", name: "Network Traffic", icon: "net" },
  { id: "senate", name: "Senate", icon: "senate" },
  { id: "disasters", name: "Disasters", icon: "siren" },
];

const PALETTE_TIP = "Every building, what it costs and what it's for. Click one, then the map.";

/** The applets on the Quick Launch bar, in order, earned ones only (the palette always). */
// No badges: the Bird App, the paper and Today's Drama keep their tray icons with their counts, and a folded window its
// taskbar button. Quick Launch was never the place for news in 1995 either.
export function quickLaunch(widgets: readonly WidgetVM[] = []): QuickApp[] {
  const earned = new Map<string, WidgetVM>(widgets.map((w) => [w.id, w]));
  return QUICK.flatMap((q) => {
    const w = earned.get(q.id);
    if (q.id !== "facilities" && !w) return [];
    const what = q.id === "facilities" ? PALETTE_TIP : w!.blurb;
    return [{ id: q.id, anchor: `app:${q.id}`, name: q.name, tip: `${q.name}: ${what}`, icon: q.icon }];
  });
}

/** The applets that also have a tray icon of their own: a phone's tray does not show them twice. */
export const IN_TRAY = new Set(["bird", "news", "drama"]);

/** Quick Launch's icon size: 24 px, the sprite's own grid, so they draw pixel for pixel (Jem's call on #110). */
export const QUICK_ICON = 24;

/** How many sit on a desktop taskbar before the rest go behind its » (Windows did the same when you dragged too many on). */
export const QUICK_SHOWN = 8;

/** The tray's rank, "#3 ▲", and its tooltip. */
export function rankChip(arena: HudVM["stats"]["arena"]): { text: string; arrow: "▲" | "▼" | ""; tip: string } {
  const arrow = arena.rankDelta > 0 ? "▲" : arena.rankDelta < 0 ? "▼" : "";
  const where = arena.top ? "on top. For now." : `#${arena.rank}${arena.rankDelta !== 0 ? ` (${arena.deltaText})` : ""}.`;
  return { text: `#${arena.rank}`, arrow, tip: `Frontier Arena: ${where} Click for the leaderboard.` };
}
