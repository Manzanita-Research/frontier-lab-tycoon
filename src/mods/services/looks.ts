import { Context } from "effect";
import type { LookData } from "../schema";

/**
 * A look as the renderer gets it (FLT-55): the manifest's look, checked, with its `sprite` or `glb` resolved to the
 * owning mod's bundled asset (a data URL until the browser adapter swaps it for a `blob:` URL). Presentation only:
 * nothing in the sim or the GameDefinition reads it.
 */
export interface ResolvedLook extends LookData {
  /** The mod it came from. */
  readonly mod: string;
  /** The image or model a `sprite` or `glb` look draws. */
  readonly src?: string;
}

export interface LooksApi {
  /** By target: a walker kind ("protester") or a kind and a role ("visitor:Journalist"). The base game has none. */
  readonly looks: Readonly<Record<string, ResolvedLook>>;
}
export class Looks extends Context.Service<Looks, LooksApi>()("@flt/Looks") {}
