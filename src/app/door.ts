// FLT-95: the way out of the game and back to the software shelf (Help ▸ "Take the box off the shelf again"). A service,
// so the app machine's `toBox` action can be tested without a page to leave.
import { Context, Layer } from "effect";

export interface Exit {
  /** Leave for the box. The game is gone after this. */
  readonly toBox: () => void;
}

export class Door extends Context.Service<Door, Exit>()("@flt/Door") {}

export const doorBrowser = Layer.succeed(Door, { toBox: () => window.location.assign("/box") });
