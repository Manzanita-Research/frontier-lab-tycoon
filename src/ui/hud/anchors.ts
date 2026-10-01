// FLT-93: the anchor registry's logic. Pure: no atoms, no DOM. The coach layer feeds it what it found on the page
// (doors, as plain records) and does what it says; the view-model asks it what a New! card's lines and a goal's next
// step are. `content/anchors.ts` is the data.
import { GOAL_STEPS, SYSTEM_GUIDES, UNLOCK_GROUPS, type GoalStep, type UnlockGroupId } from "../../content/anchors";
import type { ProgressionLevel, SystemId } from "../../content/progression";
import { STAFF } from "../../content/staff";
import type { StaffJob } from "../../sim/types";
import { defs } from "../../sim/defs";
import type { UnlockCardVM, UnlockEntryVM, UnlockGroupVM } from "./types";
import { WIDGET_ROWS } from "./widgets";

/** The attribute every anchor carries, and the one a door carries (its space-separated patterns). */
export const ANCHOR = "data-anchor";
export const DOOR = "data-anchor-opens";

/** `hire:*` opens `hire:sre`; `*` opens anything; anything else is exact. */
export function doorMatches(pattern: string, id: string): boolean {
  if (pattern === "*") return true;
  return pattern.endsWith("*") ? id.startsWith(pattern.slice(0, -1)) : pattern === id;
}

/** How specifically a door opens `id`: the longest of its patterns that matches (an exact one beats any wildcard), or -1. */
export function doorScore(opens: string, id: string): number {
  let best = -1;
  for (const p of opens.split(/\s+/)) {
    if (!p || !doorMatches(p, id)) continue;
    best = Math.max(best, p.endsWith("*") ? p.length - 1 : 1000 + p.length);
  }
  return best;
}

/** A door as the coach layer saw it: what it opens, how deep it sits in the page, and whether it is already open or already tried. */
export interface DoorSeen {
  opens: string;
  depth: number;
  /** `aria-expanded="true"` or `aria-selected="true"`: its panel is already showing; clicking it again would shut it. */
  open: boolean;
  /** [Show me] already clicked it once on this walk. */
  tried: boolean;
}

/**
 * The door to click next on the way to `id`: the most specific, then the deepest (a submenu inside the menu beats the
 * menu's own button), never one that is already open or already tried. -1: there is none left to click.
 */
export function nextDoor(id: string, doors: readonly DoorSeen[]): number {
  return bestDoor(id, doors, (d) => !d.open && !d.tried);
}

/**
 * The door to light when nothing can be clicked: the same order, any door at all. A walk that ran out (the player shut the
 * menu) still shows where to start, the way a shut Start menu stands in for the tool inside it.
 */
export function standInDoor(id: string, doors: readonly DoorSeen[]): number {
  const closed = bestDoor(id, doors, (d) => !d.open);
  return closed >= 0 ? closed : bestDoor(id, doors, () => true);
}

function bestDoor(id: string, doors: readonly DoorSeen[], ok: (d: DoorSeen) => boolean): number {
  let best = -1;
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i]!;
    const score = doorScore(d.opens, id);
    if (score < 0 || !ok(d)) continue;
    const b = best >= 0 ? doors[best]! : null;
    const bs = b ? doorScore(b.opens, id) : -1;
    if (!b || score > bs || (score === bs && d.depth > b.depth)) best = i;
  }
  return best;
}

// ---- What a New! card brings, by kind --------------------------------------------------------------------------

const article = (word: string) => (/^[aeiou]|^SRE/i.test(word) ? "an" : "a");

/** The coach balloon's line for [Show me]: what it is, and that this is where. */
export function guideText(id: string): string {
  const [kind, key = ""] = id.split(":");
  if (kind === "build") {
    if (key === "path") return "Paths are here. Draw them from the gate: everyone walks on paths.";
    if (key === "bulldoze") return "The bulldozer is here. You get half the money back, and none of the dignity.";
    const b = defs().buildings[key as keyof ReturnType<typeof defs>["buildings"]];
    return b ? `${b.name} is here. ${b.blurb} Put it next to a path.` : "It's in here.";
  }
  if (kind === "hire") {
    const s = STAFF[key as StaffJob];
    return s ? `Hire ${article(s.title)} ${s.title} here. ${s.blurb}` : "Hire them here.";
  }
  if (kind === "app") {
    if (key === "bird") return "This is the Bird App. Your researchers are posting. Click the bird before Legal does.";
    const w = WIDGET_ROWS.find((r) => r.id === key);
    return w ? `${w.name}: ${w.blurb}` : "It's in here.";
  }
  if (id === "training") return "This is the training bar. When it fills up, you ship a model.";
  if (id === "speed") return "Speed up here. ▶▶▶ is fastest. The board loves ▶▶▶.";
  return "It's here.";
}

/** What the player is after, as a verb phrase ("hire an SRE", "build a Training Hall"): a skin's voice can say it its own way. */
export function guideAsk(id: string): string {
  const [kind, key = ""] = id.split(":");
  if (kind === "build") {
    if (key === "path") return "draw a path";
    if (key === "bulldoze") return "knock something down";
    const b = defs().buildings[key as keyof ReturnType<typeof defs>["buildings"]];
    return b ? `build ${article(b.name)} ${b.name}` : "build something";
  }
  if (kind === "hire") {
    const s = STAFF[key as StaffJob];
    return s ? `hire ${article(s.title)} ${s.title}` : "hire someone";
  }
  if (kind === "app") {
    if (key === "bird") return "read the Bird App";
    const w = WIDGET_ROWS.find((r) => r.id === key);
    return w ? `open ${w.name}` : "open something";
  }
  if (id === "training") return "ship a model";
  if (id === "speed") return "make time go faster";
  return "find something";
}

const systemEntry = (id: string): UnlockEntryVM | null => {
  const g = SYSTEM_GUIDES[id as SystemId];
  return g ? { name: g.name, line: g.line, ...(g.anchor ? { anchor: g.anchor } : {}) } : null;
};

/**
 * The card's lines grouped Build / Hire / New systems / New apps, each with one line on what it is for and where
 * [Show me] goes. The rung's own row says which is which; a card the ladder does not know (a mod's rung, an older save)
 * is sorted by name. `items` stays as it was for a skin that draws a flat list.
 */
export function unlockGroupsOf(card: { id: string; items: readonly string[] }, ladder: readonly ProgressionLevel[]): UnlockGroupVM[] {
  const by: Record<UnlockGroupId, UnlockEntryVM[]> = { build: [], hire: [], systems: [], apps: [] };
  const buildings = defs().buildings as Record<string, { name: string; blurb: string } | undefined>;
  const staffByTitle = new Map(Object.values(STAFF).map((s) => [s.title, s]));
  const kindByName = new Map(Object.entries(buildings).map(([k, b]) => [b?.name, k]));
  const wake = card.id.startsWith("wake:") ? card.id.slice(5) : null;
  const row = ladder.find((r) => r.id === card.id);
  const items = wake ? [wake] : card.items;
  for (const item of items) {
    const kind = row?.buildings.find((k) => buildings[k]?.name === item) ?? kindByName.get(item);
    if (kind && buildings[kind]) {
      by.build.push({ name: buildings[kind]!.name, line: buildings[kind]!.blurb, anchor: `build:${kind}` });
      continue;
    }
    const staff = staffByTitle.get(item);
    if (staff) {
      by.hire.push({ name: staff.title, line: `${staff.duty}. ${staff.blurb}`, anchor: `hire:${staff.job}` });
      continue;
    }
    if (item in SYSTEM_GUIDES) {
      const e = systemEntry(item);
      if (e) by[SYSTEM_GUIDES[item as SystemId]!.group].push(e);
      continue;
    }
    // A line the ladder added that is none of these (the "fresh headache" teaser, a mod's own): a system with no link.
    by.systems.push({ name: item, line: "" });
  }
  return UNLOCK_GROUPS.filter((g) => by[g.id].length > 0).map((g) => ({ id: g.id, title: g.title, entries: by[g.id] }));
}

/** The card with its groups (FLT-93). */
export const groupedCard = (card: UnlockCardVM, ladder: readonly ProgressionLevel[]): UnlockCardVM => ({ ...card, groups: unlockGroupsOf(card, ladder) });

// ---- A goal's next step ----------------------------------------------------------------------------------------

/** What the view-model knows about the lab, for `until`. */
export interface Facts {
  built: ReadonlySet<string>;
  staff: ReadonlySet<string>;
}

/** The step of a goal to do now: the first whose `until` is not true yet. Null: the goal has no steps (a mod's). */
export function goalStep(goalId: string | undefined, facts: Facts): GoalStep | null {
  const steps = goalId ? GOAL_STEPS[goalId] : undefined;
  if (!steps?.length) return null;
  const done = (s: GoalStep) => {
    if (!s.until) return false;
    const [what, key] = s.until.split(":") as [string, string];
    return what === "built" ? facts.built.has(key) : facts.staff.has(key);
  };
  return steps.find((s) => !done(s)) ?? steps.at(-1)!;
}
