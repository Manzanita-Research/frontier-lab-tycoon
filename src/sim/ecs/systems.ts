// FLT-75: mod systems in the tick. A mod's Layer adds `EcsSystem`s to the `Systems` service; the app installs the
// resolved list once per game (like `setSessionDefinition`), and `tick` runs them in their slot, in list order.
// They get the Koota world and the lab's crowd, never an Rng: a mod system that needs chance is a mod we don't take yet.
import type { World } from "koota";
import type { GameState } from "../types";
import { ecs, ground, registerModTrait, type Ground, type ModTrait } from "./protesters";

export interface EcsSystem {
  /** "wag-near-kombucha". Unique across mods. */
  readonly id: string;
  /** Where in the tick it runs. Only "protesters" (straight after the march and picket systems) exists today. */
  readonly after: "protesters";
  /** Traits it adds to entities and wants saved with them. */
  readonly traits?: readonly ModTrait[];
  run(world: World, crowd: Ground, state: GameState): void;
}

let session: readonly EcsSystem[] = [];

export function installSystems(systems: readonly EcsSystem[]) {
  for (const s of systems) for (const t of s.traits ?? []) registerModTrait(t);
  session = systems;
}

export function runSystems(state: GameState, slot: EcsSystem["after"]) {
  for (const s of session) if (s.after === slot) s.run(ecs, ground(state), state);
}
