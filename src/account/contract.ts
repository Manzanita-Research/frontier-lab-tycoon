import * as Schema from "effect/Schema";

/**
 * The cloud-save wire contract (FLT-67), shared by the client and the Worker (`worker/saves.ts`).
 *
 * A cloud save is FLT-65's `.fltsave` text exactly as `serialize(save)` writes it to localStorage or a file: the same
 * bytes go up, sit in R2, and come back down. The server reads the envelope's head (lab, day, mods, skin) to list it and
 * never opens `state`, the packed World.
 */

/** The autosave plus three manual slots: FLT-65's `SLOTS`. */
export const SLOTS = ["auto", "1", "2", "3"] as const;
export const Slot = Schema.Literals(SLOTS);
export type Slot = typeof Slot.Type;

/** A slot's save may be at most this many bytes (FLT-65 keeps one under 1.5M characters; a mid-game lab is ~45K). */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;

/** FLT-65's `SAVE_KIND` and `SAVE_MIME`. */
export const SAVE_KIND = "fltsave";
export const SAVE_MIME = "application/x-fltsave+json";

/** A mod as a save remembers it; `source` is its `?mod=` value. */
export const SaveMod = Schema.Struct({
  id: Schema.String.check(Schema.isMaxLength(120)),
  version: Schema.String.check(Schema.isMaxLength(40)),
  hash: Schema.String.check(Schema.isMaxLength(128)),
  source: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(2048))),
});

/**
 * The head of FLT-65's envelope: every field but `state`. It is checked loosely on purpose (any version, any `enc`), so
 * a newer save format still uploads without a Worker deploy; reading one is the client's job (`parseSave`).
 */
export const SaveHead = Schema.Struct({
  kind: Schema.Literal(SAVE_KIND),
  v: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1_000 })),
  savedAt: Schema.String.check(Schema.isMaxLength(40)),
  seed: Schema.Finite,
  lab: Schema.String.check(Schema.isMaxLength(80)),
  day: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  tick: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  mods: Schema.Array(SaveMod).check(Schema.isMaxLength(64)),
  skin: Schema.NullOr(Schema.String.check(Schema.isMaxLength(64))),
  enc: Schema.String.check(Schema.isMaxLength(16)),
});
export type SaveHead = typeof SaveHead.Type;

/** An upload: the head plus a `state` the server stores without opening. */
export const SaveUpload = Schema.Struct({ ...SaveHead.fields, state: Schema.String });

/** One row of `GET /api/saves`. */
export const SaveSummary = Schema.Struct({
  slot: Slot,
  size: Schema.Int,
  updatedAt: Schema.Int,
  head: SaveHead,
});
export type SaveSummary = typeof SaveSummary.Type;

export const SaveList = Schema.Struct({ saves: Schema.Array(SaveSummary) });
export type SaveList = typeof SaveList.Type;

/** Hugging Face accounts get a placeholder address: we never ask for email, and Better Auth wants the field filled. */
export const placeholderEmail = (provider: string, id: string) => `${provider}-${id}@users.invalid`;
