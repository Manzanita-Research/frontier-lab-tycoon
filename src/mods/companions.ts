// FLT-75 (experiment): code companions for JSON mods. A mod's manifest is data and never runs code, so a mod that
// wants an ECS system ships it here, bundled with the game and keyed by the mod's id. Loading the mod's JSON switches
// its companion on. A companion wraps `Systems` the way a JSON mod's patches wrap `Content`.
import { Effect, Layer } from "effect";
import { Systems } from "./services/systems";
import { GoldenRetrieverWag } from "./examples/golden-retriever-wag";
import type { EcsSystem } from "../sim/ecs/systems";

export const COMPANIONS: Readonly<Record<string, Layer.Layer<Systems, never, Systems>>> = {
  "golden-retriever-protest": GoldenRetrieverWag,
};

/** The mods' composed Layer with each loaded mod's companion on top, in load order. */
export function withCompanions<A, E>(layer: Layer.Layer<A | Systems, E>, ids: readonly string[]): Layer.Layer<A | Systems, E> {
  let out = layer;
  for (const id of ids) {
    const companion = COMPANIONS[id];
    if (companion) out = companion.pipe(Layer.provideMerge(out));
  }
  return out;
}

export const resolveSystems = <E>(layer: Layer.Layer<Systems, E>): Effect.Effect<readonly EcsSystem[], E> =>
  Effect.gen(function* () { return (yield* Systems).systems; }).pipe(Effect.provide(layer));
