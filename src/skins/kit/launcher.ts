// FLT-63: the Start menu's two halves, shared by every skin. `facilityGroups` sorts the build items into the
// "Facilities ▸" submenu; `useWidget` lets a slot that keeps its own open state (a folded window, a tab) hear that
// Run… asked for it; `runFile` reads what a player typed into a Run box.
import { useEffect, useRef, useState } from "react";
import { useCoach } from "../context";
import type { BuildItemVM, FacilityGroupVM, WidgetVM } from "../../ui/hud/types";

// ---- Facilities ▸ ------------------------------------------------------------------------------------------------

export interface FacilityGroup {
  id: Exclude<FacilityGroupVM, "tools">;
  items: BuildItemVM[];
}

const ORDER: readonly FacilityGroup["id"][] = ["compute", "research", "amenities", "offices"];

/** The top-level tools (Path, Bulldoze) and the buildings, grouped in submenu order. Empty groups are left out. */
export function facilityGroups(items: readonly BuildItemVM[]): { tools: BuildItemVM[]; groups: FacilityGroup[] } {
  const tools = items.filter((it) => it.group === "tools" || it.isPath || it.isBulldoze);
  const rest = items.filter((it) => !tools.includes(it));
  const groups = ORDER.map((id) => ({ id, items: rest.filter((it) => (it.group ?? "amenities") === id) })).filter((g) => g.items.length > 0);
  return { tools, groups };
}

/** The coach points at a building inside the submenu: the submenu's own entry stands in for it while it is shut. */
export const coachInFacilities = (target: string | null, items: readonly BuildItemVM[]): boolean =>
  !!target?.startsWith("build:") && items.some((it) => `build:${it.kind}` === target && !it.isPath && !it.isBulldoze && it.group !== "tools");

/** Where an open build panel is: the top level (tools, Facilities, Run…), inside Facilities, or in the Run box. */
export type StartView = "top" | "facilities" | "run";

/**
 * A build panel that drills in (the skins without a flyout): the view, the grouped items, and the Facilities entry's
 * coach hook (it stands in for a building the coach points at until you go in). Mount it inside the open panel, so
 * shutting the panel resets it to the top.
 */
export function useStartMenu(items: readonly BuildItemVM[], initial: StartView = "top") {
  const coach = useCoach();
  const [view, setView] = useState<StartView>(initial);
  const { tools, groups } = facilityGroups(items);
  const facilities = coach.attrs("start:facilities", view === "top" && coach.intoPanel(items) && coachInFacilities(coach.target, items));
  return { view, setView, tools, groups, facilities, count: groups.reduce((n, g) => n + g.items.length, 0) };
}

// ---- Run… --------------------------------------------------------------------------------------------------------

type Listener = (id: string) => void;
const listeners = new Set<Listener>();

/** The host calls this on every `actions.openWidget(id)`. Skins do not need to. */
export function announceWidget(id: string): void {
  for (const l of [...listeners]) l(id);
}

/**
 * Hear Run… opening one of `ids`: unfold your window, switch to your tab. Only fires for launches, never on mount.
 * `onOpen` may change between renders; the latest one is called.
 */
export function useWidget(ids: string | readonly string[], onOpen: (id: string) => void): void {
  const latest = useRef(onOpen);
  latest.current = onOpen;
  const key = typeof ids === "string" ? ids : ids.join(",");
  useEffect(() => {
    const wanted = new Set(key.split(","));
    const l: Listener = (id) => {
      if (wanted.has(id)) latest.current(id);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, [key]);
}

export type RunResult = { ok: true; widget: WidgetVM } | { ok: false; title: string; text: string };

/** A few things people will type, and what the lab says back. Everything else gets the classic "Cannot find". */
const REPLIES: readonly [RegExp, string, string][] = [
  [/^agi(\.exe)?$/, "agi.exe", "AGI is not installed. It is 18 months away, as it has been for some time."],
  [/^(asi|superintelligence)(\.exe)?$/, "asi.exe", "This program requires AGI.exe. See above."],
  [/^format\b/, "Format", "Nice try. The lab's weights are backed up on a USB stick in someone's hoodie."],
  [/^(del|rm|deltree)\b/, "Delete", "Deleting things is Legal's job. They have been notified."],
  [/^(safety|alignment)(\.exe)?$/, "safety.exe", "safety.exe is still loading (37%). Estimated time remaining: after the launch."],
  [/^(cmd|command|dos|terminal|bash|sh)(\.exe|\.com)?$/, "Command Prompt", "An agent is already using the command prompt. It says it's fine."],
  [/^(solitaire|sol|minesweeper|winmine)(\.exe)?$/, "Games", "Games were removed to make room for another Compute Cluster."],
  [/^(clippy|paperclip|assistant)(\.exe)?$/, "Assistant", "It looks like you're trying to run the assistant. The assistant is already running you."],
  [/^(weights|model|frontier)(\.\w+)?$/, "Access denied", "The weights are not a widget. Please stop asking; the auditors can see this box."],
  [/^(hello|hi|help me)$/, "Run", "Hello. This is a Run box, not a chat window. That's next quarter."],
];

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, "")
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/+$/, "")
    .replace(/^[a-z]:[\\/]+(windows[\\/]+)?/, "");

/** What a Run box does with `typed`: open a widget (by file, name, id or alias) or say why not. */
export function runFile(typed: string, widgets: readonly WidgetVM[]): RunResult {
  const q = norm(typed);
  if (!q) return { ok: false, title: "Run", text: "Type the name of a program, folder or widget, and the lab will open it for you." };
  const bare = q.replace(/\.(exe|com|txt|doc|xls|cpl|hlp|bat|lnk|html?)$/, "");
  const hit =
    widgets.find((w) => w.file === q) ??
    widgets.find((w) => w.id === bare || w.file.replace(/\.\w+$/, "") === bare || w.name.toLowerCase() === bare || w.aliases.includes(bare)) ??
    (bare.length >= 3 ? widgets.find((w) => w.name.toLowerCase().startsWith(bare) || w.file.startsWith(bare)) : undefined);
  if (hit) return { ok: true, widget: hit };
  for (const [re, title, text] of REPLIES) if (re.test(q)) return { ok: false, title, text };
  return { ok: false, title: typed.trim(), text: `Cannot find '${typed.trim()}'. Make sure you typed the name correctly, or that you've earned it: new widgets unlock as the lab grows.` };
}
