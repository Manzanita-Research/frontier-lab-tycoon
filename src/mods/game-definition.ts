import { Effect, type Layer } from "effect";
import { Content, type ContentApi } from "./services/content";
import { Rules, type RulesApi } from "./services/rules";
import { Vocabulary, type VocabularyApi } from "./services/vocabulary";

/** Plain data only. It is resolved once, outside the pure simulation tick. */
export interface GameDefinition {
  readonly content: ContentApi;
  readonly rules: RulesApi;
  readonly vocabulary: VocabularyApi;
}
export function resolveGameDefinition<E, R>(layer: Layer.Layer<Content | Rules | Vocabulary, E, R>) {
  return Effect.gen(function* () {
    const content = yield* Content;
    const rules = yield* Rules;
    const vocabulary = yield* Vocabulary;
    return structuredClone({ content, rules, vocabulary }) satisfies GameDefinition;
  }).pipe(Effect.provide(layer));
}
