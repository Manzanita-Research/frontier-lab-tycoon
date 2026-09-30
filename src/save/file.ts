// `.fltsave` files: the same text as a slot, downloaded or read back from a picker or a drop. Browser-only.
import { Effect } from "effect";
import { decodeSave, serialize } from "./codec";
import { SAVE_EXT, SAVE_MIME, saveError, type SaveError, type SaveFile } from "./format";
import type { GameState } from "../sim/types";
import { formatDate } from "../sim/format";

/** Files bigger than this are refused before they are read. */
export const MAX_FILE_BYTES = 5_000_000;

/** "gradient-descent-labs-y2-mar-5.fltsave" */
export function saveFileName(save: Pick<SaveFile, "lab" | "day">): string {
  const slug = `${save.lab} ${formatDate(save.day)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "lab"}${SAVE_EXT}`;
}

/** Start a download of the save. */
export function downloadSave(save: SaveFile): void {
  const url = URL.createObjectURL(new Blob([serialize(save)], { type: SAVE_MIME }));
  const a = document.createElement("a");
  a.href = url;
  a.download = saveFileName(save);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A picked or dropped file, read and checked. */
export const readSaveFile = (file: Blob & { name?: string }): Effect.Effect<{ save: SaveFile; world: GameState }, SaveError> =>
  Effect.gen(function* () {
    if (file.size > MAX_FILE_BYTES) return yield* saveError("tooBig", `That file is ${Math.round(file.size / 1e6)} MB. A lab save is well under 1 MB, so this isn't one.`);
    const text = yield* Effect.tryPromise({ try: () => file.text(), catch: () => saveError("corrupt", "The browser couldn't read that file.") });
    return yield* decodeSave(text);
  });
