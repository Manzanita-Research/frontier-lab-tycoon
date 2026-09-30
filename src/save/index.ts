// The save format and where saves live (FLT-65). The whole API; see docs/SAVES.md.
export { SAVE_VERSION, SAVE_KIND, SAVE_EXT, SAVE_MIME, SaveFile, SaveMod, SaveError, saveError, type SaveMeta, type SaveErrorReason, type SaveEncoding } from "./format";
export { encodeSave, serialize, parseSave, loadWorld, decodeSave, metaOf, pack, unpack, type SaveInfo } from "./codec";
export { MIGRATIONS, migrate, type Migration } from "./migrations";
export { makeSaveStore, browserStorage, memoryStorage, SLOTS, isSlot, slotKey, MAX_SAVE_CHARS, type SaveStore, type SaveStorage, type SlotId, type SlotListing } from "./store";
export { downloadSave, readSaveFile, saveFileName, MAX_FILE_BYTES } from "./file";
