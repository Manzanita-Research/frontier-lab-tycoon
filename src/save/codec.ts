// Packing a World into a save and back. `state` is gzip + base64 (CompressionStream, so no dependency); a browser
// without it writes plain JSON, which still loads everywhere. Decoding is the only door in: JSON, then migrations,
// then the Effect Schema, then the World's own shape, so every failure is a SaveError with a sentence in it.
import { Effect, Schema } from "effect";
import type { GameState } from "../sim/types";
import { WORLD_MIGRATIONS, hasWorldSteps, migrate, migrateWorld, type WorldMigration } from "./migrations";
import { SAVE_KIND, SAVE_VERSION, SaveFile, saveError, type SaveEncoding, type SaveError, type SaveMeta, type SaveMod } from "./format";

const canGzip = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Pack JSON for `state`. */
export const pack = (json: string): Effect.Effect<{ enc: SaveEncoding; state: string }> =>
  canGzip()
    ? Effect.promise(async () => ({ enc: "gzip64" as const, state: toBase64(await pipeThrough(new TextEncoder().encode(json), new CompressionStream("gzip"))) }))
    : Effect.succeed({ enc: "json" as const, state: json });

/** Unpack `state` back to JSON. */
export const unpack = (enc: SaveEncoding, state: string): Effect.Effect<string, SaveError> =>
  enc === "json"
    ? Effect.succeed(state)
    : Effect.tryPromise({
        try: async () => {
          if (!canGzip()) throw new Error("no DecompressionStream");
          return new TextDecoder().decode(await pipeThrough(fromBase64(state), new DecompressionStream("gzip")));
        },
        catch: () => saveError("corrupt", "The lab inside this save is scrambled. Part of the file is missing or was edited."),
      });

export interface SaveInfo {
  /** The run's mods (`GameState.mods` with each one's `?mod=` source), or none. */
  mods?: readonly SaveMod[];
  skin?: string | null;
  /** Defaults to now. */
  savedAt?: Date;
}

/** A World as a save. The World is copied as it stands (JSON), so the game can keep ticking while it compresses. */
export const encodeSave = (world: GameState, info: SaveInfo = {}): Effect.Effect<SaveFile> =>
  Effect.suspend(() => {
    const json = JSON.stringify(world);
    const head = {
      kind: SAVE_KIND, v: SAVE_VERSION, savedAt: (info.savedAt ?? new Date()).toISOString(), seed: world.seed, lab: world.labName,
      day: world.day, tick: world.tick, mods: [...(info.mods ?? world.mods?.mods ?? [])], skin: info.skin ?? null,
    } as const;
    return pack(json).pipe(Effect.map((packed): SaveFile => ({ ...head, ...packed })));
  });

/** The text written to localStorage and to a `.fltsave` file. */
export const serialize = (save: SaveFile): string => JSON.stringify(save);

const decodeEnvelope = Schema.decodeUnknownEffect(SaveFile);

/** Anything (a string from storage or a file, or parsed JSON) to a current-version save, or a friendly error. */
export const parseSave = (input: unknown): Effect.Effect<SaveFile, SaveError> =>
  Effect.gen(function* () {
    let data = input;
    if (typeof input === "string") {
      if (input.trim() === "") return yield* saveError("empty", "That file is empty. Not even a garage.");
      try {
        data = JSON.parse(input);
      } catch {
        return yield* saveError("notASave", "That isn't a lab save. It isn't even JSON.");
      }
    }
    const obj = data as { kind?: unknown; v?: unknown } | null;
    if (typeof obj !== "object" || obj === null || obj.kind !== SAVE_KIND) return yield* saveError("notASave", `That isn't a lab save. Frontier Lab Tycoon saves end in .fltsave.`);
    if (typeof obj.v !== "number" || !Number.isInteger(obj.v) || obj.v < 1) return yield* saveError("corrupt", "This save has no version number, so there is no telling what is in it.");
    if (obj.v > SAVE_VERSION) return yield* saveError("tooNew", `This lab was saved by a newer version of the game (save format v${obj.v}; this one reads up to v${SAVE_VERSION}). Reload the page to update.`);
    const upgraded = yield* Effect.try({ try: () => migrate(obj as { v: number }), catch: (e) => saveError("corrupt", `This save couldn't be upgraded: ${e instanceof Error ? e.message : String(e)}`) });
    const save = yield* decodeEnvelope(upgraded).pipe(
      Effect.mapError((e) => saveError("corrupt", `This save is damaged: ${String(e.message).split("\n")[0]}`)),
    );
    return yield* upgradeWorld(save, obj.v);
  });

/** Run the World steps (`WORLD_MIGRATIONS`) on a save first written as v`from`: unpack, fix the JSON, pack again. */
export const upgradeWorld = (save: SaveFile, from: number, target = SAVE_VERSION, table: Readonly<Record<number, WorldMigration>> = WORLD_MIGRATIONS): Effect.Effect<SaveFile, SaveError> =>
  !hasWorldSteps(from, target, table)
    ? Effect.succeed(save)
    : Effect.gen(function* () {
        const json = yield* unpack(save.enc, save.state);
        const world = yield* Effect.try({
          try: () => JSON.stringify(migrateWorld(JSON.parse(json), from, target, table)),
          catch: (e) => saveError("corrupt", `This save couldn't be upgraded: ${e instanceof Error ? e.message : String(e)}`),
        });
        return { ...save, ...(yield* pack(world)) };
      });

/** The least a World must have for the sim to run on it. The rest is optional in the sim itself (older Worlds load). */
const WorldShape = Schema.Struct({
  seed: Schema.Finite, rngState: Schema.Finite, tick: Schema.Finite, day: Schema.Finite, cash: Schema.Finite, labName: Schema.String,
  grid: Schema.Struct({ w: Schema.Finite, h: Schema.Finite, paths: Schema.Array(Schema.Boolean) }),
  buildings: Schema.Array(Schema.Unknown), walkers: Schema.Array(Schema.Unknown), flags: Schema.Record(Schema.String, Schema.Unknown),
});
const checkWorld = Schema.decodeUnknownEffect(WorldShape);

/** The World inside a save, ready to hand to the sim. */
export const loadWorld = (save: SaveFile): Effect.Effect<GameState, SaveError> =>
  Effect.gen(function* () {
    const json = yield* unpack(save.enc, save.state);
    let world: unknown;
    try {
      world = JSON.parse(json);
    } catch {
      return yield* saveError("corrupt", "The lab inside this save is scrambled. Part of the file is missing or was edited.");
    }
    // Checked, not decoded: decoding would strip every field the shape doesn't name.
    yield* checkWorld(world).pipe(Effect.mapError((e) => saveError("corrupt", `The lab inside this save is incomplete: ${String(e.message).split("\n")[0]}`)));
    return world as GameState;
  });

/** Text to World in one go: `parseSave` then `loadWorld`. */
export const decodeSave = (input: unknown): Effect.Effect<{ save: SaveFile; world: GameState }, SaveError> =>
  Effect.flatMap(parseSave(input), (save) => Effect.map(loadWorld(save), (world) => ({ save, world })));

/** A save as a menu lists it. `size` is the serialized length. */
export const metaOf = (save: SaveFile, size = serialize(save).length): SaveMeta => {
  const { state: _state, ...meta } = save;
  return { ...meta, size };
};
