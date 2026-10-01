// FLT-93: where things live. Every control a goal or a New! card can send you to has a stable anchor id, and every skin
// marks it with `data-anchor="<id>"` (the kit's `anchor()`). A control that reveals anchors when clicked (the Start
// button, a submenu, the Staff entry, a tab) is a door: `data-anchor-opens="build:* hire:*"`. [Show me] and the coach
// find their way by these, never by CSS paths, so a menu can move (FLT-94) and the onboarding still points at it.
//
//   build:<kind>   a build tool (build:path, build:hall, build:bulldoze, ...)
//   hire:<job>     a Hire button (hire:sre, hire:janitor, hire:comms, hire:security)
//   app:<id>       an applet launcher: a widget id from ui/hud/widgets.ts (app:arena, app:staff, ...), or app:bird
//   start, speed, training, goals, stat:runway    the coach's own targets
//
// Data only: the view-model decides which step of a goal is current.
import type { SystemId } from "./progression";

/** What a New! card's line is about, in the order the card shows the groups. */
export type UnlockGroupId = "build" | "hire" | "systems" | "apps";
export const UNLOCK_GROUPS: readonly { id: UnlockGroupId; title: string }[] = [
  { id: "build", title: "Build" },
  { id: "hire", title: "Hire" },
  { id: "systems", title: "New systems" },
  { id: "apps", title: "New apps" },
];

/**
 * Every system a rung can bring, as a New! card says it: its group (an app is a window you open; a system is something
 * that happens to you), one line on what it is for, and where to go about it. `null` is a secret the card must not
 * spoil. Building and staff lines come from their own content (`blurb`, `duty`).
 */
export interface SystemGuide {
  name: string;
  group: "systems" | "apps";
  line: string;
  /** Where [Show me] takes you: the thing you do about it. None: it comes to you. */
  anchor?: string;
}
export const SYSTEM_GUIDES: Readonly<Record<SystemId, SystemGuide | null>> = {
  breakdowns: { name: "Breakdowns", group: "systems", line: "Buildings wear out and catch fire. An SRE runs over and fixes them.", anchor: "hire:sre" },
  slop: { name: "Slop", group: "systems", line: "Drifting agents leave slop on the paths. A Janitor Bot mops it.", anchor: "hire:janitor" },
  birdapp: { name: "The Bird App", group: "apps", line: "Your researchers post. Read it, and rein them in before Legal does.", anchor: "app:bird" },
  leapfrog: { name: "Benchmarks", group: "apps", line: "Every lab claims a record. Yours are in the footnotes.", anchor: "app:benchmarks" },
  arena: { name: "The Arena", group: "apps", line: "The leaderboard. Ship better models to climb it.", anchor: "app:arena" },
  rnd: { name: "R&D multiplier", group: "systems", line: "Agents speed up your training. The number on the Arena window.", anchor: "app:arena" },
  news: { name: "The Frontier Times", group: "apps", line: "Every edition the ticker has printed about you.", anchor: "app:news" },
  factions: { name: "Factions", group: "apps", line: "Who loves you, who doesn't, and who is organising.", anchor: "app:discourse" },
  events: { name: "Event cards", group: "systems", line: "Now and then the world asks you a question. Pick an answer." },
  protests: { name: "Protests", group: "systems", line: "People gather at the gate. A Comms Rep hands out tote bags.", anchor: "hire:comms" },
  disasters: { name: "Disasters", group: "systems", line: "Things go wrong on their own. SREs help.", anchor: "app:disasters" },
  papers: { name: "Papers", group: "apps", line: "Publish your research, or don't. Both count as a strategy.", anchor: "app:papers" },
  collusion: null,
  hearing: { name: "The Hearing", group: "systems", line: "The Senate will call you in. Wear a tie." },
  yacht: { name: "The yacht summit", group: "systems", line: "A safety summit, on a yacht. The invitation arrives as a card." },
  defection: { name: "Defection", group: "systems", line: "Unhappy researchers start their own lab. Keep them happy." },
  poaching: { name: "The Poaching War", group: "systems", line: "Rivals make offers to your people. The offers arrive as cards." },
  auditors: { name: "Evals Without Borders", group: "systems", line: "Auditors tour the campus. Tidy up first." },
  promises: { name: "The Promise Tracker", group: "apps", line: "Everything you ever promised, and how it went.", anchor: "app:senate" },
  capture: { name: "Regulatory Capture", group: "apps", line: "A bill about AI. You may have opinions on its wording.", anchor: "app:senate" },
  escape: { name: "The Sandbox Escape", group: "systems", line: "Agents run for the fence. Tap a runner, or hire Security.", anchor: "hire:security" },
};

/**
 * What to do next for a goal, step by step: the first step whose `until` is not true yet is the one [Show me] points at.
 * `until` is a small fact the view-model checks: `built:<kind>` (one stands), `staff:<job>` (one is on the payroll).
 * A step with no `until` is the last thing to do.
 */
export interface GoalStep {
  anchor: string;
  /** The goal's next action, as the note says it ("Hire an SRE"). */
  label: string;
  until?: `built:${string}` | `staff:${string}`;
}
/** By ladder rung id (content/progression.ts) and by scenario objective id (content/goals.ts). */
export const GOAL_STEPS: Readonly<Record<string, readonly GoalStep[]>> = {
  garage: [
    { anchor: "build:hall", label: "Build a Training Hall", until: "built:hall" },
    { anchor: "training", label: "Watch the training bar" },
  ],
  business: [
    { anchor: "build:gateway", label: "Build an API Gateway", until: "built:gateway" },
    { anchor: "build:kombucha", label: "Build a Kombucha Bar for the visitors", until: "built:kombucha" },
    { anchor: "speed", label: "Speed up while the visitors come" },
  ],
  team: [
    { anchor: "hire:sre", label: "Hire an SRE", until: "staff:sre" },
    { anchor: "hire:janitor", label: "Hire a Janitor Bot", until: "staff:janitor" },
    { anchor: "speed", label: "Speed up: the bots do the mopping" },
  ],
  race: [{ anchor: "app:arena", label: "Open the Arena" }],
  scrutiny: [{ anchor: "training", label: "Keep the training bar moving" }],
  release: [{ anchor: "training", label: "Keep the training bar moving" }],
  era: [{ anchor: "app:arena", label: "Watch the R&D multiplier on the Arena" }],
  arena: [{ anchor: "app:arena", label: "Open the Arena" }],
};

/**
 * Where an anchor lives, said in words, for a skin that has none of its own (`where.<anchor>`, then `where.<kind>` in the
 * skin's strings win). A goal note says it under the goal, so the place is named even before you press [Show me].
 */
export const WHERE: Readonly<Record<string, string>> = {
  build: "the build menu",
  "build:path": "the build menu",
  hire: "the Staff panel",
  app: "the apps menu",
  "app:bird": "the bird in the corner",
  training: "the training bar",
  speed: "the speed buttons",
  start: "the build menu",
};

/** "hire:sre" → "hire". */
export const anchorKind = (id: string): string => id.split(":")[0] ?? id;
