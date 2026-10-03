import { Schema } from "effect";
import { ModManifest } from "../../../src/mods/schema";
export { ModManifest, decodeManifest } from "../../../src/mods/schema";
export type {
  ArcData, BuildingData, EventData, HeadlineData, NamedCallData, RivalData, ThoughtData,
  LookData, LookPartData, SkinData,
} from "../../../src/mods/schema";
export type { FactionDef as FactionData, Signal as FactionSignal } from "../../../src/content/factions";
export type { RivalId } from "../../../src/content/rivals";
export type { BuildingKind as BuildingId } from "../../../src/content/buildings";
export type { ThoughtCondition } from "../../../src/content/thoughts";
export type { NewsTrigger as HeadlineTrigger } from "../../../src/content/headlines";

/** The wire format is derived directly from the game's Effect Schema. No second schema. */
export type Mod = typeof ModManifest.Type;
export type ContentPatch = NonNullable<Mod["content"]>;
/** Presentation (FLT-55): how walkers look, the mod's sound cues. None of it reaches the sim. */
export type Looks = NonNullable<Mod["looks"]>;
export type AudioData = NonNullable<Mod["audio"]>;
/** The Vocabulary a mod arc may call (the game's src/sim/verbs.ts; a test keeps these lists equal). */
export const GUARD_NAMES = ["after", "every", "progress.gte", "stat.gte", "stat.lte", "chance", "choice", "day.after", "flag.is", "faction.gte", "faction.lte", "relation.gte", "relation.lte", "answered", "not", "any", "all"] as const;
export const ACTION_NAMES = [
  "investigate.start", "staff.divert", "staff.release", "compute.drain", "cost.spike", "revenue.mult", "auditor.odds", "auditor.note", "effects.end",
  "building.fire", "building.offline", "building.wear", "building.ensure", "hype.delta", "trust.delta", "voice.push", "heat.delta", "capture.delta", "discourse.delta",
  "cash.delta", "rival.leap", "rival.growth", "rival.pace", "rival.closed", "camera.focus", "camera.beat", "shake", "sound.cue", "news", "toast", "card", "faction.delta", "relation.delta",
  "faction.signal", "faction.rally", "faction.disperse", "flag.set", "flag.clear",
  "people.meet", "people.quit", "people.pay", "people.cheer", "people.spell", "birdapp.post", "birdapp.rival",
  "trip.start", "trip.end", "capability.boost",
  "visitors.arrive", "visitors.leave", "walkers.disguise", "walkers.reveal", "spawn.escape",
] as const;
export type GuardName = (typeof GUARD_NAMES)[number];
export type ActionName = (typeof ACTION_NAMES)[number];

/** Trusted authoring, followed by the same strict schema validation used for shared JSON. */
export function defineMod(mod: Mod): Mod {
  Schema.decodeUnknownSync(ModManifest, { onExcessProperty: "error" })(mod);
  return mod;
}
