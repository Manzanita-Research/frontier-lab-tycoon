// FLT-63: the Start menu's "Run…" list (what it can open, in order) and the tool in hand as a mode. Pure: the view-model
// calls these, and the tests read them.
import type { BuildItemVM, FacilityGroupVM, PlaceModeVM, VisibleVM, WidgetVM } from "./types";

/** Where each building sits in the Facilities ▸ submenu. A kind nobody listed (a mod's) is an amenity. */
const GROUPS: Record<string, FacilityGroupVM> = {
  path: "tools", bulldoze: "tools",
  cluster: "compute", datacenter: "compute", gas: "compute", solar: "compute",
  hall: "research", gateway: "research", demo: "research",
  kombucha: "amenities", nap: "amenities", snack: "amenities",
  security: "offices", staff: "offices", senate: "offices",
};

export const groupOf = (kind: string): FacilityGroupVM => GROUPS[kind] ?? "amenities";

type Row = Omit<WidgetVM, "aliases"> & { aliases?: string[] };

/** Every widget, in list order. `when` says whether the lab has earned it. */
const WIDGETS: readonly (Row & { when: (w: WidgetGate) => boolean })[] = [
  { id: "properties", name: "Lab Properties", file: "labprops.cpl", blurb: "Cash, runway and the date. The basics.", icon: "properties", aliases: ["stats", "lab", "properties"], when: () => true },
  { id: "finance", name: "Finance", file: "finance.xls", blurb: "Where the money comes from, and where it goes (mostly GPUs).", icon: "finance", aliases: ["money", "cash", "burn"], when: (w) => w.visible.revenue },
  { id: "arena", name: "Frontier Arena", file: "arena.exe", blurb: "The leaderboard. Everyone says they ignore it.", icon: "arena", aliases: ["leaderboard", "rank", "rd"], when: (w) => w.visible.arena || w.visible.rnd },
  { id: "benchmarks", name: "Benchmarks", file: "bench.exe", blurb: "Records, footnotes, and footnotes to the footnotes.", icon: "benchmarks", aliases: ["benchmark", "leapfrog"], when: (w) => w.leapfrog },
  { id: "thoughts", name: "Thoughts", file: "thoughts.txt", blurb: "What everyone on campus is thinking. Unfiltered.", icon: "thoughts", aliases: ["thought", "minds"], when: (w) => w.visible.thoughts },
  { id: "traffic", name: "Network Traffic", file: "netstat.exe", blurb: "Share of the news cycle, as a graph that goes up.", icon: "traffic", aliases: ["voice", "netstat", "network"], when: (w) => w.leapfrog },
  { id: "discourse", name: "Discourse Monitor", file: "discourse.exe", blurb: "The factions, the marches and the group chats.", icon: "discourse", aliases: ["factions", "safety"], when: (w) => w.factions },
  { id: "papers", name: "Papers", file: "papers.doc", blurb: "Drafts, preprints and one very long appendix.", icon: "papers", aliases: ["paper", "arxive", "arxiv"], when: (w) => w.papers },
  { id: "news", name: "News Room", file: "news.exe", blurb: "Every edition the ticker has printed about you.", icon: "news", aliases: ["ticker", "newsroom", "paper"], when: (w) => w.visible.news },
  { id: "staff", name: "Staff Manager", file: "staff.exe", blurb: "Hire, fire, and paint patrol zones.", icon: "staff", aliases: ["hire", "payroll"], when: (w) => w.visible.staff },
  { id: "senate", name: "Senate", file: "senate.exe", blurb: "The Promise Tracker and the bill on the docket.", icon: "senate", aliases: ["tracker", "promises", "bill"], when: (w) => w.senate },
  { id: "disasters", name: "Disasters", file: "disasters.cpl", blurb: "How often things catch fire. Or start one now.", icon: "disasters", aliases: ["disaster", "chaos"], when: (w) => w.disasters },
  { id: "drama", name: "Today's Drama", file: "drama.exe", blurb: "Today's scandal, as a playable pack.", icon: "drama", aliases: ["daily"], when: () => true },
  { id: "saves", name: "Save / Load", file: "save.exe", blurb: "Save As, Open, and the autosave. On a 3½-inch floppy.", icon: "saves", aliases: ["save", "load", "saves", "floppy"], when: () => true },
  { id: "mods", name: "Mods", file: "mods.cpl", blurb: "What's loaded, and what clashes.", icon: "mods", aliases: ["mod"], when: () => true },
  { id: "display", name: "Display", file: "display.cpl", blurb: "Change the whole look (the skin).", icon: "display", aliases: ["skin", "skins", "theme"], when: () => true },
  { id: "sound", name: "Sound", file: "sound.cpl", blurb: "Volume, music and the mute button.", icon: "sound", aliases: ["audio", "volume", "mixer"], when: () => true },
  { id: "help", name: "How to play", file: "help.hlp", blurb: "The loop in five lines.", icon: "help", aliases: ["?", "howto", "tutorial"], when: () => true },
];

export interface WidgetGate {
  visible: VisibleVM;
  leapfrog: boolean;
  factions: boolean;
  papers: boolean;
  senate: boolean;
  disasters: boolean;
}

export function widgetsOf(gate: WidgetGate): WidgetVM[] {
  return WIDGETS.filter((w) => w.when(gate)).map(({ when: _when, aliases = [], ...w }) => ({ ...w, aliases: [...aliases] }));
}

/** Every widget's name and blurb, earned or not (FLT-93: what [Show me] says about an `app:<id>` anchor). */
export const WIDGET_ROWS: readonly { id: string; name: string; blurb: string }[] = WIDGETS.map(({ id, name, blurb }) => ({ id, name, blurb }));

/** The ids `openWidget` knows, earned or not. */
export const WIDGET_IDS: readonly string[] = WIDGETS.map((w) => w.id);

/** The tool in hand (or the zone being painted) as a mode. */
export function modeOf(items: readonly BuildItemVM[], tool: string | null, zone: { name: string } | null): PlaceModeVM | null {
  if (zone) return { kind: "zone", tool: null, name: `${zone.name}'s patrol`, sticky: true };
  const held = tool ? items.find((it) => it.kind === tool && !it.panel) : undefined;
  if (!held) return null;
  if (held.isPath) return { kind: "path", tool: held.kind, name: held.name, sticky: true };
  if (held.isBulldoze) return { kind: "bulldoze", tool: held.kind, name: held.name, sticky: true };
  return { kind: "building", tool: held.kind, name: held.name, sticky: false };
}
