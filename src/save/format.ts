// The save format (FLT-65): one versioned JSON envelope, the same bytes in localStorage, in a `.fltsave` file and (FLT-67)
// in the cloud. The World inside is the plain sim state, gzipped and base64'd; everything a menu needs to list a save
// (lab, date, mods, skin) sits beside it uncompressed, so listing never inflates anything.
import { Schema } from "effect";

/** The envelope's version. Bump it (and add a step to `migrations.ts`) whenever an old save would load wrong. */
export const SAVE_VERSION = 1;
/** Every save says what it is, so a random JSON file gets a friendly "that isn't a lab" instead of a crash. */
export const SAVE_KIND = "fltsave";
/** The file extension and the MIME type a download uses. */
export const SAVE_EXT = ".fltsave";
export const SAVE_MIME = "application/x-fltsave+json";

/** A mod the run was playing with. `source` is its `?mod=` value, so a load can fetch it again. */
export const SaveMod = Schema.Struct({
  id: Schema.String,
  version: Schema.String,
  hash: Schema.String,
  source: Schema.optionalKey(Schema.String),
});
export interface SaveMod extends Schema.Schema.Type<typeof SaveMod> {}

/** How `state` is packed: `gzip64` (gzip, then base64), or `json` where the browser has no CompressionStream. */
export const SaveEncoding = Schema.Literals(["gzip64", "json"]);
export type SaveEncoding = typeof SaveEncoding.Type;

/** The current envelope. Old ones are upgraded by `migrations.ts` before they are checked against this. */
export const SaveFile = Schema.Struct({
  kind: Schema.Literal(SAVE_KIND),
  v: Schema.Literal(SAVE_VERSION),
  /** ISO time the save was written. */
  savedAt: Schema.String,
  seed: Schema.Finite,
  /** The lab's name, for the menu ("Gradient Descent Labs"). */
  lab: Schema.String,
  day: Schema.Finite,
  tick: Schema.Finite,
  mods: Schema.Array(SaveMod),
  /** The skin showing when it was saved (restored on load), or null. */
  skin: Schema.NullOr(Schema.String),
  enc: SaveEncoding,
  /** The World, packed per `enc`. */
  state: Schema.String,
});
export interface SaveFile extends Schema.Schema.Type<typeof SaveFile> {}

/** A save as a menu lists it: everything but the packed World. */
export type SaveMeta = Omit<SaveFile, "state"> & { /** Characters the save takes up (localStorage counts UTF-16 units). */ size: number };

/** What went wrong. `reason` is for code; `detail` (also the `message`) is a sentence a player can read. */
export type SaveErrorReason = "notASave" | "tooNew" | "corrupt" | "tooBig" | "quota" | "storage" | "empty";
export class SaveError extends Schema.TaggedError<SaveError>()("SaveError", {
  reason: Schema.Literals(["notASave", "tooNew", "corrupt", "tooBig", "quota", "storage", "empty"]),
  detail: Schema.String,
}) {
  override get message() { return this.detail; }
}

export const saveError = (reason: SaveErrorReason, detail: string) => new SaveError({ reason, detail });
