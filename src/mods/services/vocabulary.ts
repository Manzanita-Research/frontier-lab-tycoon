import { Context } from "effect";

export interface VocabularyApi {
  readonly guards: readonly string[];
  readonly effects: readonly string[];
}
export class Vocabulary extends Context.Service<Vocabulary, VocabularyApi>()("@flt/Vocabulary") {}
