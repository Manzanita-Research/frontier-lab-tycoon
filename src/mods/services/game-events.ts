import { Context, type Stream } from "effect";

export type GameEvent =
  | { readonly type: "release"; readonly day: number; readonly model: string }
  | { readonly type: "era"; readonly day: number; readonly era: number }
  | { readonly type: "card"; readonly day: number; readonly id: string };
/** Subscribers can observe, never publish or mutate the World. M1b supplies the live stream. */
export interface GameEventsApi { readonly stream: Stream.Stream<GameEvent> }
export class GameEvents extends Context.Service<GameEvents, GameEventsApi>()("@flt/GameEvents") {}
