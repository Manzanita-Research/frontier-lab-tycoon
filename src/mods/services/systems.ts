import { Context } from "effect";
import type { EcsSystem } from "../../sim/ecs/systems";

/**
 * FLT-75 (experiment): code a mod runs inside the fixed-step tick, over the Koota entities (today: the protesters).
 * A JSON mod cannot fill this; it is for bundled code mods (a TypeScript Layer). The base game has none.
 */
export interface SystemsApi {
  readonly systems: readonly EcsSystem[];
}
export class Systems extends Context.Service<Systems, SystemsApi>()("@flt/Systems") {}
