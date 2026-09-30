// The save slots in localStorage: the autosave, three manual slots, and `pending` (a save waiting for a reload that
// fetches its mods). Nothing here leaves the browser. A full disk or blocked storage is a SaveError, never a throw,
// and a write that fails leaves the slot's previous save exactly as it was.
import { Effect } from "effect";
import { parseSave, serialize, metaOf } from "./codec";
import { SAVE_KIND, saveError, type SaveError, type SaveFile, type SaveMeta } from "./format";

export type SlotId = "auto" | "1" | "2" | "3" | "pending";
/** What the Save/Load window lists, in order. */
export const SLOTS = ["auto", "1", "2", "3"] as const satisfies readonly SlotId[];
export const isSlot = (s: unknown): s is SlotId => s === "pending" || (SLOTS as readonly unknown[]).includes(s);

export const slotKey = (slot: SlotId) => `flt.save.${slot}`;
/** One save may take this many characters. A mid-game lab is about 45K; this is room for a very busy one. */
export const MAX_SAVE_CHARS = 1_500_000;

/** The part of `Storage` a store needs (tests pass a Map-backed one; a quota can be simulated). */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SlotListing {
  slot: SlotId;
  /** Null for an empty slot. */
  meta: SaveMeta | null;
  /** Something is there, but it isn't a save we can read. */
  broken?: string;
}

const isQuota = (e: unknown) =>
  e instanceof Error && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || (e as { code?: number }).code === 22 || (e as { code?: number }).code === 1014);

const NO_STORAGE = "This browser won't let the game keep anything (private browsing?). Use Export to take the lab with you as a file.";

/** The browser's localStorage, or null when it is blocked. */
export function browserStorage(): SaveStorage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function makeSaveStore(storage: SaveStorage | null) {
  const raw = (slot: SlotId): string | null => {
    try {
      return storage?.getItem(slotKey(slot)) ?? null;
    } catch {
      return null;
    }
  };

  /** Just the envelope (no inflating): enough for the menu. */
  function peek(slot: SlotId): SlotListing {
    const text = raw(slot);
    if (text === null) return { slot, meta: null };
    try {
      const save = JSON.parse(text) as SaveFile;
      if (save?.kind !== SAVE_KIND || typeof save.lab !== "string" || typeof save.day !== "number") return { slot, meta: null, broken: "Not a lab save" };
      return { slot, meta: metaOf(save, text.length) };
    } catch {
      return { slot, meta: null, broken: "Scrambled" };
    }
  }

  return {
    available: storage !== null,
    peek,
    list: (): SlotListing[] => SLOTS.map(peek),
    /** The save in a slot, upgraded and checked. */
    read: (slot: SlotId): Effect.Effect<SaveFile, SaveError> =>
      Effect.suspend(() => {
        if (!storage) return Effect.fail(saveError("storage", NO_STORAGE));
        const text = raw(slot);
        return text === null ? Effect.fail(saveError("empty", slot === "auto" ? "There is no autosave yet." : `Slot ${slot} is empty.`)) : parseSave(text);
      }),
    /** Write a save to a slot. Too big, a full disk and blocked storage are errors; the old save survives all three. */
    write: (slot: SlotId, save: SaveFile): Effect.Effect<SaveMeta, SaveError> =>
      Effect.suspend(() => {
        if (!storage) return Effect.fail(saveError("storage", NO_STORAGE));
        const text = serialize(save);
        if (text.length > MAX_SAVE_CHARS) return Effect.fail(saveError("tooBig", `This lab is too big to keep here (${Math.round(text.length / 1000)}K; the limit is ${MAX_SAVE_CHARS / 1000}K). Export it as a file instead.`));
        try {
          storage.setItem(slotKey(slot), text);
        } catch (e) {
          return Effect.fail(
            isQuota(e)
              ? saveError("quota", "The browser's storage is full, so this save didn't fit. Delete a slot, or export the lab as a file.")
              : saveError("storage", NO_STORAGE),
          );
        }
        return Effect.succeed(metaOf(save, text.length));
      }),
    remove: (slot: SlotId) => {
      try {
        storage?.removeItem(slotKey(slot));
      } catch {
        /* blocked storage: nothing was there to remove */
      }
    },
  };
}

export type SaveStore = ReturnType<typeof makeSaveStore>;

/** A Map-backed SaveStorage for tests, with an optional character budget to simulate a full disk. */
export function memoryStorage(budget = Infinity): SaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  const used = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      const next = used() - (map.get(k)?.length ?? 0) + v.length + (map.has(k) ? 0 : k.length);
      if (next > budget) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
      map.set(k, v);
    },
    removeItem: (k) => void map.delete(k),
  };
}
