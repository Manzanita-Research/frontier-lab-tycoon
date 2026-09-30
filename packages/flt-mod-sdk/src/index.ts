import { Schema } from "effect";
import { ModManifest } from "../../../src/mods/schema";
export { ModManifest, decodeManifest } from "../../../src/mods/schema";
export type {
  ArcData, BuildingData, EventData, HeadlineData, NamedCallData, RivalData, ThoughtData,
} from "../../../src/mods/schema";
export type { RivalId } from "../../../src/content/rivals";
export type { BuildingKind as BuildingId } from "../../../src/content/buildings";
export type { ThoughtCondition } from "../../../src/content/thoughts";
export type { NewsTrigger as HeadlineTrigger } from "../../../src/content/headlines";

/** The wire format is derived directly from the game's Effect Schema. No second schema. */
export type Mod = typeof ModManifest.Type;
export type ContentPatch = NonNullable<Mod["content"]>;
/** The Vocabulary a mod arc may call (the game's src/sim/verbs.ts; a test keeps these lists equal). */
export const GUARD_NAMES = ["after", "every", "progress.gte", "stat.gte", "stat.lte", "chance", "choice", "day.after", "flag.is", "not", "any"] as const;
export const ACTION_NAMES = [
  "investigate.start", "staff.divert", "staff.release", "compute.drain", "cost.spike", "revenue.mult", "auditor.odds", "effects.end",
  "building.fire", "building.offline", "building.wear", "building.ensure", "hype.delta", "trust.delta", "heat.delta", "discourse.delta",
  "cash.delta", "rival.leap", "camera.focus", "shake", "sound.cue", "news", "toast", "card", "flag.set", "flag.clear",
] as const;
export type GuardName = (typeof GUARD_NAMES)[number];
export type ActionName = (typeof ACTION_NAMES)[number];

/** Trusted authoring, followed by the same strict schema validation used for shared JSON. */
export function defineMod(mod: Mod): Mod {
  Schema.decodeUnknownSync(ModManifest, { onExcessProperty: "error" })(mod);
  return mod;
}
