import { Context } from "effect";
import type { Schema } from "effect";
import type { ArcData, BuildingData, Ending, EntityKind, EventData, Goal, HeadlineData, NamePool, RivalData, ThoughtData, Tip } from "../schema";
import type { baseTables } from "../tables";

export interface ContentApi {
  readonly buildings: Readonly<Record<string, BuildingData>>;
  readonly rivals: ReadonlyArray<RivalData>;
  readonly headlines: ReadonlyArray<HeadlineData>;
  readonly thoughts: ReadonlyArray<ThoughtData>;
  readonly events: ReadonlyArray<EventData>;
  readonly arcs: ReadonlyArray<ArcData>;
  /** Presentation is independent of mechanics. Agents need not walk. */
  readonly walkerKinds: ReadonlyArray<Schema.Schema.Type<typeof EntityKind>>;
  readonly endings: ReadonlyArray<Schema.Schema.Type<typeof Ending>>;
  readonly tips: ReadonlyArray<Schema.Schema.Type<typeof Tip>>;
  readonly names: ReadonlyArray<Schema.Schema.Type<typeof NamePool>>;
  readonly goals: ReadonlyArray<Schema.Schema.Type<typeof Goal>>;
  readonly tables: typeof baseTables;
}
export class Content extends Context.Service<Content, ContentApi>()("@flt/Content") {}
