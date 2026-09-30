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
export type GuardName = "stat.gte" | "flag.is" | "day.after" | "chance";
export type ActionName = "effect.cash" | "effect.hype" | "effect.discourse" | "news" | "card" | "spawn.protesters" | "flag.set";

/** Trusted authoring, followed by the same strict schema validation used for shared JSON. */
export function defineMod(mod: Mod): Mod {
  Schema.decodeUnknownSync(ModManifest, { onExcessProperty: "error" })(mod);
  return mod;
}
