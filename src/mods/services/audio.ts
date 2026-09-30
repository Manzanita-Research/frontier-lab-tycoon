import { Context } from "effect";
import type { Schema } from "effect";
import type { Note } from "../schema";

export interface AudioApi {
  readonly cues: Readonly<Record<string, ReadonlyArray<Schema.Schema.Type<typeof Note>>>>;
  readonly music: readonly string[];
  readonly chords: ReadonlyArray<readonly number[]>;
}
export class Audio extends Context.Service<Audio, AudioApi>()("@flt/Audio") {}
