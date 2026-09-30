import { Context } from "effect";
import type { Schema } from "effect";
import type { ArcData, BuildingData, DisasterData, Ending, EntityKind, EventData, Goal, HeadlineData, NamePool, RivalData, ThoughtData, Tip } from "../schema";
import type { baseTables } from "../tables";

export interface ContentApi {
  readonly progression: readonly import("../../content/progression").ProgressionLevel[];
  /** The first-run coach marks, in order (content/coach.ts). */
  readonly coach: readonly import("../../content/coach").CoachLine[];
  readonly buildings: Readonly<Record<string, BuildingData>>;
  readonly rivals: ReadonlyArray<RivalData>;
  readonly headlines: ReadonlyArray<HeadlineData>;
  readonly thoughts: ReadonlyArray<ThoughtData>;
  readonly events: ReadonlyArray<EventData | ArcData>;
  readonly arcs: ReadonlyArray<ArcData>;
  /** Presentation is independent of mechanics. Agents need not walk. */
  readonly walkerKinds: ReadonlyArray<Schema.Schema.Type<typeof EntityKind>>;
  readonly endings: ReadonlyArray<Schema.Schema.Type<typeof Ending>>;
  readonly tips: ReadonlyArray<Schema.Schema.Type<typeof Tip>>;
  readonly names: ReadonlyArray<Schema.Schema.Type<typeof NamePool>>;
  readonly goals: ReadonlyArray<Schema.Schema.Type<typeof Goal>>;
  /** FLT-17's disasters (mods/base-disasters is the base game's pack). Their cards join the events. */
  readonly disasters: ReadonlyArray<DisasterData>;
  /** Release Leapfrog's benchmarks and livestream mishaps (mods/base-leapfrog). */
  readonly benchmarks: ReadonlyArray<import("../../content/leapfrog").BenchmarkDef>;
  readonly mishaps: ReadonlyArray<import("../../content/leapfrog").MishapDef>;
  /** FLT-33's factions (mods/base-factions, plus mods/base-water's counter-protesters). */
  readonly factions: ReadonlyArray<import("../../content/factions").FactionDef>;
  readonly tables: typeof baseTables;
}
export class Content extends Context.Service<Content, ContentApi>()("@flt/Content") {}
