import * as Schema from "effect/Schema";

/**
 * The cloud-save wire contract (FLT-67), shared by the client and the Worker (`worker/saves.ts`).
 *
 * The server never reads a save's `state`: it stores the `.fltsave` bytes (FLT-65's format, already compressed) in R2
 * as they are, and keeps this small summary beside them in D1 so "My labs" can list saves without opening any.
 */

/** The autosave plus three manual slots. */
export const SLOTS = ["auto", "1", "2", "3"] as const;
export const Slot = Schema.Literals(SLOTS);
export type Slot = typeof Slot.Type;

/** A slot's blob may be at most this big (the `.fltsave` bytes as uploaded). */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;

/** A mod as a save remembers it: the same identity a `?mod=` link carries. */
export const SaveMod = Schema.Struct({
  id: Schema.String.check(Schema.isMaxLength(120)),
  version: Schema.String.check(Schema.isMaxLength(40)),
  hash: Schema.String.check(Schema.isMaxLength(128)),
  url: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(2048))),
});

/**
 * What the client says about the save it uploads, sent as JSON in the `Flt-Save-Meta` header. These are the header
 * fields of FLT-65's save (`{ v, savedAt, seed, lab, day, mods, skin }`) plus the device that wrote it, which is how
 * "Continue from your laptop or this phone?" tells two copies apart.
 */
export const SaveMeta = Schema.Struct({
  v: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000 })),
  savedAt: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  seed: Schema.Int,
  lab: Schema.String.check(Schema.isMaxLength(80)),
  day: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  mods: Schema.Array(SaveMod).check(Schema.isMaxLength(64)),
  skin: Schema.String.check(Schema.isMaxLength(64)),
  device: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
});
export type SaveMeta = typeof SaveMeta.Type;

/** One row of `GET /api/saves`. */
export const SaveSummary = Schema.Struct({
  slot: Slot,
  size: Schema.Int,
  updatedAt: Schema.Int,
  meta: SaveMeta,
});
export type SaveSummary = typeof SaveSummary.Type;

export const SaveList = Schema.Struct({ saves: Schema.Array(SaveSummary) });
export type SaveList = typeof SaveList.Type;

/** The header that carries a save's `SaveMeta` on upload and download. */
export const META_HEADER = "flt-save-meta";

/** Hugging Face accounts get a placeholder address: we never ask for email, and Better Auth wants the field filled. */
export const placeholderEmail = (provider: string, id: string) => `${provider}-${id}@users.invalid`;
