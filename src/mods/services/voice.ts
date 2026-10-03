import { Context } from "effect";
import type { VoiceData } from "../schema";

/** A voice as the HUD gets it (FLT-102): the manifest's rules and the mod they came from. Presentation only. */
export interface ResolvedVoice extends VoiceData {
  readonly mod: string;
}

export interface VoiceApi {
  /** The last loaded mod's voice wins (one voice at a time); the base game has none. */
  readonly voice: ResolvedVoice | null;
}
export class Voice extends Context.Service<Voice, VoiceApi>()("@flt/Voice") {}
