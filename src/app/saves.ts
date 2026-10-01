// The app's side of saving (FLT-65): the Saves service the app machine's `save` action writes through, and the rules
// for when a link may autosave or greet you with "Continue". The format itself is `src/save/`.
import { Context, Effect } from "effect";
import { encodeSave, makeSaveStore, saveError, type SaveError, type SaveMeta, type SaveMod, type SaveStore, type SlotId } from "../save";
import type { GameState, Tone } from "../sim/types";

/** Why a save is being written: the three autosave moments, or the player's own Save. */
export type SaveWhy = "month" | "hide" | "ending" | "manual";

export interface SaveResult {
  slot: SlotId;
  why: SaveWhy;
  meta: SaveMeta | null;
  error: SaveError | null;
}

/** URL knobs that stage a scene. Such a link never autosaves over the player's lab, and never says "Welcome back". */
const STAGING = ["scenario", "moment", "warp", "agents", "discourse", "researchers", "disaster", "debug", "ladder", "hour", "photo", "newsdemo"];

export const isStagedLink = (search: string) => {
  const q = new URLSearchParams(search);
  return STAGING.some((k) => q.has(k)) || q.get("autosave") === "off";
};

/**
 * "Welcome back" greets any link that could autosave: so a friend's `?seed=` link asks before its garage overwrites
 * your lab. Not a staged link, and not `?load=` (that one already knows which save it wants).
 */
export const welcomesYou = (search: string) => {
  const q = new URLSearchParams(search);
  return !isStagedLink(search) && !q.has("load") && !q.has("saves");
};

/**
 * Where saves go and who hears about them. `autosave` is off for staged links; manual saves always work.
 * `skin` and `mods` are asked for at save time (the HUD fills in the skin once it has booted).
 */
export class SaveDesk {
  private listeners = new Set<(r: SaveResult) => void>();
  /** Autosave failures are said once a visit, not once a month. */
  private warned = false;
  skin: () => string | null = () => null;
  /** True while "Welcome back" waits for an answer: the fresh garage behind it must not autosave over your lab. */
  held = false;

  constructor(
    readonly store: SaveStore,
    readonly autosave: boolean,
    readonly mods: () => readonly SaveMod[] = () => [],
  ) {}

  subscribe(listener: (r: SaveResult) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Save `world` now. Never fails: a problem is a SaveResult with an `error`, and a toast for the player. */
  save(world: GameState, slot: SlotId, why: SaveWhy, toast: (text: string, tone: Tone) => void = () => undefined): Effect.Effect<void> {
    if (slot === "auto" && why !== "manual" && (!this.autosave || this.held)) return Effect.void;
    // The World is copied (stringified) before anything yields.
    return encodeSave(world, { mods: this.mods(), skin: this.skin() }).pipe(
      Effect.flatMap((save) => this.store.write(slot, save)),
      // A bug (a World that won't stringify, a store that throws) is answered like any failure: the Save window waits
      // for this result, and without one it said "Reading drive A:…" for ever (FLT-81).
      Effect.catchDefect((defect) => Effect.fail(saveError("storage", `This save couldn't be written: ${defect instanceof Error ? defect.message : String(defect)}`))),
      Effect.match({
        onSuccess: (meta) => {
          if (why === "manual") toast(`Saved "${meta.lab}" to ${slot === "auto" ? "the autosave" : `slot ${slot}`}.`, "good");
          this.emit({ slot, why, meta, error: null });
        },
        onFailure: (error) => {
          if (why === "manual" || !this.warned) toast(why === "manual" ? error.message : `Autosave didn't work: ${error.message}`, "bad");
          if (why !== "manual") this.warned = true;
          this.emit({ slot, why, meta: null, error });
        },
      }),
    );
  }

  private emit(result: SaveResult) {
    for (const l of this.listeners) l(result);
  }
}

export class Saves extends Context.Service<Saves, SaveDesk>()("@flt/Saves") {}

/** A desk on a store, for tests and the headless shell. */
export const makeSaveDesk = (store: SaveStore = makeSaveStore(null), autosave = true, mods?: () => readonly SaveMod[]) => new SaveDesk(store, autosave, mods);
