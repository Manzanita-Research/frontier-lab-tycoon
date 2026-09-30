// The resolved game definition the sim reads its content from (FLT-37, the FLT-15 M1b integration).
// With no mods this is the base content itself (the very same arrays), so an unmodded run is byte-identical.
// A mod's GameDefinition (src/mods) is plain JSON; `resolveDefs` turns it into lookups once and memoises them.
// Entry points (createInitialState, tick, applyNow) take an optional `def` and install it for the length of the
// synchronous call; everything else reads `defs()`. The app shell also sets a session default so the renderer and
// the HUD, which read content outside a tick, see the same modded buildings, rivals and events.
import type { GameDefinition } from "../mods/game-definition";
import { BUILDINGS, type BuildingDef, type BuildingKind, type PlaceableKind } from "../content/buildings";
import { COACH, type CoachLine } from "../content/coach";
import { EVENTS, type EventDef } from "../content/events";
import { GOALS, type GoalDef } from "../content/goals";
import { HEADLINES, type Headline } from "../content/headlines";
import * as Names from "../content/names";
import { PROGRESSION, type ProgressionLevel } from "../content/progression";
import { RIVAL_DEFS, type RivalDef, type RivalId } from "../content/rivals";
import { THOUGHTS, type ThoughtLine } from "../content/thoughts";
import type { ArcData, HeadlineData } from "../mods/schema";

/** The pools behind the procedural names. The algorithms stay in content/names.ts; mods swap the words. */
export interface NamePools {
  LAB_NAMES: readonly string[];
  RIVALS: readonly string[];
  RIVAL_SHORT: readonly string[];
  FIRST_NAMES: readonly string[];
  LAST_NAMES: readonly string[];
  RESEARCHER_ROLES: readonly string[];
  AGENT_NICKNAMES: readonly string[];
  THEIR: readonly string[];
}

/** A mod headline may carry a `when` guard (stat.gte, flag.is, day.after, chance). Base lines never do. */
export type HeadlineLine = Headline & { when?: HeadlineData["when"] };

export interface Defs {
  /** The definition these lookups came from; null for the built-in base. */
  readonly source: GameDefinition | null;
  /** Mod-added kinds are strings outside the BuildingKind union at runtime; the renderer has a fallback for them. */
  readonly buildings: Readonly<Record<BuildingKind, BuildingDef>>;
  readonly buildingKinds: readonly BuildingKind[];
  readonly placeableKinds: readonly PlaceableKind[];
  readonly raceKinds: readonly PlaceableKind[];
  readonly rivals: readonly RivalDef[];
  readonly rivalById: Readonly<Record<RivalId, RivalDef>>;
  /** Rivals plus you. */
  readonly arenaSize: number;
  readonly headlines: readonly HeadlineLine[];
  /** Headlines by trigger, in content order (so `rng.pick` draws the same line as a filter would). */
  readonly headlinesFor: (trigger: string) => readonly HeadlineLine[];
  readonly thoughts: readonly ThoughtLine[];
  /** Choice cards only; data-only statecharts are in `arcs`. */
  readonly events: readonly EventDef[];
  readonly eventById: (id: string) => EventDef | undefined;
  /** Mod statecharts: `content.arcs` plus arc-shaped `content.events` entries (sim/modArcs.ts runs them). */
  readonly arcs: readonly ArcData[];
  readonly goals: readonly GoalDef[];
  readonly names: NamePools;
  readonly progression: readonly ProgressionLevel[];
  readonly coach: readonly CoachLine[];
}

const BASE_ARENA_SIZE = RIVAL_DEFS.length + 1;

function build(source: GameDefinition | null, parts: Omit<Defs, "source" | "buildingKinds" | "placeableKinds" | "raceKinds" | "rivalById" | "arenaSize" | "headlinesFor" | "eventById">): Defs {
  const buildingKinds = Object.keys(parts.buildings) as BuildingKind[];
  const byTrigger = new Map<string, HeadlineLine[]>();
  for (const h of parts.headlines) {
    const pool = byTrigger.get(h.trigger);
    if (pool) pool.push(h);
    else byTrigger.set(h.trigger, [h]);
  }
  const events = new Map(parts.events.map((e) => [e.id, e]));
  return {
    ...parts,
    source,
    buildingKinds,
    placeableKinds: buildingKinds.filter((k): k is PlaceableKind => !parts.buildings[k].scenery && !parts.buildings[k].office),
    raceKinds: buildingKinds.filter((k): k is PlaceableKind => !!parts.buildings[k].locked),
    rivalById: Object.fromEntries(parts.rivals.map((r) => [r.id, r])) as Record<RivalId, RivalDef>,
    arenaSize: parts.rivals.length + 1,
    headlinesFor: (trigger) => byTrigger.get(trigger) ?? [],
    eventById: (id) => events.get(id),
  };
}

/** The built-in game: the content modules themselves, untouched. */
export const BASE_DEFS: Defs = build(null, {
  buildings: BUILDINGS,
  rivals: RIVAL_DEFS,
  headlines: HEADLINES,
  thoughts: THOUGHTS,
  events: EVENTS,
  arcs: [],
  goals: GOALS,
  names: {
    LAB_NAMES: Names.LAB_NAMES, RIVALS: Names.RIVALS, RIVAL_SHORT: Names.RIVAL_SHORT, FIRST_NAMES: Names.FIRST_NAMES, LAST_NAMES: Names.LAST_NAMES,
    RESEARCHER_ROLES: Names.RESEARCHER_ROLES, AGENT_NICKNAMES: Names.AGENT_NICKNAMES, THEIR: Names.THEIR,
  },
  progression: PROGRESSION,
  coach: COACH,
});

const isArc = (entry: object): entry is ArcData => "states" in entry;

function fromDefinition(def: GameDefinition): Defs {
  const c = def.content;
  const pool = (id: keyof NamePools): readonly string[] => {
    const values = c.names.find((p) => p.id === id)?.values;
    return values && values.length > 0 ? values : BASE_DEFS.names[id];
  };
  // "Top 3 on the Arena" is stored counted from the bottom (#3 of 7 is 5); keep it "top 3" when mods add or remove rivals.
  const shift = c.rivals.length + 1 - BASE_ARENA_SIZE;
  const goals = (c.goals as readonly GoalDef[]).map((g) => (g.metric === "arena" && shift !== 0 ? { ...g, target: Math.max(1, g.target + shift) } : g));
  return build(def, {
    buildings: c.buildings as Record<BuildingKind, BuildingDef>,
    rivals: c.rivals as readonly RivalDef[],
    headlines: c.headlines as readonly HeadlineLine[],
    thoughts: c.thoughts as readonly ThoughtLine[],
    events: c.events.filter((e) => !isArc(e)) as unknown as readonly EventDef[],
    arcs: [...c.arcs, ...c.events.filter(isArc)],
    goals,
    names: {
      LAB_NAMES: pool("LAB_NAMES"), RIVALS: pool("RIVALS"), RIVAL_SHORT: pool("RIVAL_SHORT"), FIRST_NAMES: pool("FIRST_NAMES"), LAST_NAMES: pool("LAST_NAMES"),
      RESEARCHER_ROLES: pool("RESEARCHER_ROLES"), AGENT_NICKNAMES: pool("AGENT_NICKNAMES"), THEIR: pool("THEIR"),
    },
    progression: c.progression,
    coach: (c.coach ?? COACH) as readonly CoachLine[],
  });
}

const memo = new WeakMap<GameDefinition, Defs>();

/** Lookups for a definition, built once per definition object. No definition means the base game. */
export function resolveDefs(def?: GameDefinition | null): Defs {
  if (!def) return session;
  let hit = memo.get(def);
  if (!hit) memo.set(def, (hit = fromDefinition(def)));
  return hit;
}

let session: Defs = BASE_DEFS;
let active: Defs | null = null;

/** What the sim is running with right now: the call's definition inside an entry point, else the session's. */
export const defs = (): Defs => active ?? session;

/** Run `body` with `def` installed. Nested calls restore the outer definition. Synchronous only. */
export function withDefs<T>(def: GameDefinition | null | undefined, body: () => T): T {
  if (!def) return body();
  const prev = active;
  active = resolveDefs(def);
  try {
    return body();
  } finally {
    active = prev;
  }
}

/** The app shell's definition for this page: what the renderer and HUD read between ticks. Null restores the base. */
export function setSessionDefinition(def: GameDefinition | null) {
  session = def ? resolveDefs(def) : BASE_DEFS;
}
