// Saving and loading as the player sees it (FLT-65): the Save/Load window, "Welcome back", the prompt about mods,
// export and import, and a `.fltsave` dropped anywhere on the page. The format is `src/save/`; the autosaves are the
// app machine's (`src/app/saves.ts`). Everything here is UI state and a few effects; the sim only ever sees LOAD_LAB.
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { registry, saveDesk, savesReady, send, sim } from "../../app/game";
import { modSession, type ModSession } from "../../app/mods";
import { installSession, matchSave } from "../../app/liveMods";
import { welcomesYou, type SaveResult } from "../../app/saves";
import { downloadSave, encodeSave, isSlot, loadWorld, readSaveFile, saveFileName, type SaveError, type SaveFile, type SlotId, type SlotListing } from "../../save";
import { formatDate } from "../../sim/format";
import { restoreSaveSkin } from "./skinControl";
import { skinUiAtom } from "./state";
import type { HudActions, SaveModPromptVM, ToneVM } from "./types";
import { modMismatch, newestSave, type ShelfSave } from "./saves.vm";

export interface SavesUi {
  open: boolean;
  listing: readonly SlotListing[];
  welcome: ShelfSave | null;
  busy: boolean;
  status: { text: string; tone: ToneVM } | null;
  /** A save waiting on the mods question, and what to ask. */
  prompt: { save: SaveFile; vm: SaveModPromptVM } | null;
  dragging: boolean;
  /** When the listing was read (for "3 hours ago"). */
  now: number;
}

// keepAlive: boot sets the Welcome before anything subscribes.
export const savesAtom = Atom.keepAlive(
  Atom.make<SavesUi>({ open: false, listing: [], welcome: null, busy: false, status: null, prompt: null, dragging: false, now: Date.now() }),
);

const ui = () => registry.get(savesAtom);
const set = (patch: Partial<SavesUi>) => registry.set(savesAtom, { ...ui(), ...patch });
const refresh = (patch: Partial<SavesUi> = {}) => set({ listing: saveDesk.store.list(), now: Date.now(), ...patch });
const say = (text: string, tone: ToneVM, patch: Partial<SavesUi> = {}) => refresh({ status: { text, tone }, busy: false, ...patch });
const fail = (e: SaveError) => say(e.message, "bad");
const slotName = (slot: SlotId) => (slot === "auto" ? "the autosave" : `slot ${slot}`);

/**
 * Put the save's World in play: the machine swaps it in, the save's skin comes back, and the window closes. `session`
 * is the mods it plays with when they differ from this tab's (FLT-78: mods it had added mid-game come back).
 */
function finish(save: SaveFile, session?: ModSession) {
  return loadWorld(save).pipe(
    Effect.match({
      onFailure: fail,
      onSuccess: (world) => {
        saveDesk.held = false;
        if (session && session !== modSession()) installSession(session);
        send({ type: "LOAD_LAB", world, def: modSession().def });
        void restoreSaveSkin(save.skin);
        say(`Loaded "${save.lab}", ${formatDate(save.day)}.`, "good", { open: false, welcome: null, prompt: null });
        send({ type: "TOAST", text: `Welcome back to ${save.lab}. It's ${formatDate(save.day)}.`, tone: "good" });
      },
    }),
  );
}

/**
 * Load a save, asking first when it was made with different mods. Mods added mid-game (FLT-78) don't ask: the save's
 * come back and this lab's go, by themselves.
 */
function begin(save: SaveFile) {
  return Effect.promise(() => matchSave(save)).pipe(
    Effect.flatMap((matched) => {
      const session = matched.ok ? matched.session : modSession();
      const vm = modMismatch(save, session.mods);
      if (vm) {
        set({ prompt: { save, vm }, busy: false });
        return Effect.void;
      }
      return finish(save, session);
    }),
  );
}

const run = (effect: Effect.Effect<unknown, SaveError>) => {
  set({ busy: true, status: null });
  void Effect.runPromise(effect.pipe(Effect.catch((e: SaveError) => Effect.sync(() => fail(e)))));
};

const slotOf = (slot: string): SlotId | null => (isSlot(slot) && slot !== "pending" ? slot : null);

export const savesActions: Pick<
  HudActions,
  "openSaves" | "closeSaves" | "saveTo" | "loadFrom" | "deleteSave" | "exportSave" | "importSave" | "continueSave" | "dismissWelcome" | "fetchModsAndLoad" | "loadWithoutMods" | "cancelModPrompt"
> = {
  openSaves: () => refresh({ open: true, status: null }),
  closeSaves: () => set({ open: false, status: null, prompt: null }),
  saveTo: (slot) => {
    const id = slotOf(slot);
    if (!id) return;
    set({ busy: true, status: null });
    // The desk answers through `subscribe` (below): the machine owns the World, so the save goes through it.
    send({ type: "SAVE", slot: id, why: "manual" });
  },
  loadFrom: (slot) => {
    const id = slotOf(slot);
    if (id) run(saveDesk.store.read(id).pipe(Effect.flatMap(begin)));
  },
  deleteSave: (slot) => {
    const id = slotOf(slot);
    if (!id) return;
    saveDesk.store.remove(id);
    say(`Deleted ${slotName(id)}.`, "neutral");
  },
  exportSave: (slot) => {
    const id = slotOf(slot);
    const save = id ? saveDesk.store.read(id) : encodeSave(sim.world, { mods: saveDesk.mods(), skin: saveDesk.skin() });
    run(
      save.pipe(
        Effect.map((s) => {
          downloadSave(s);
          say(`Exported ${saveFileName(s)}. It never left this computer.`, "good");
        }),
      ),
    );
  },
  importSave: (file) => {
    // The window opens, so a file that isn't a save has somewhere to say so.
    refresh({ open: true });
    run(readSaveFile(file).pipe(Effect.flatMap(({ save }) => begin(save))));
  },
  continueSave: () => run(saveDesk.store.read(ui().welcome?.slot ?? "auto").pipe(Effect.flatMap(begin))),
  dismissWelcome: () => {
    saveDesk.held = false;
    set({ welcome: null });
  },
  fetchModsAndLoad: () => {
    const p = ui().prompt;
    if (!p?.vm.canFetch) return;
    // Across the reload in the `pending` slot; `?load=pending` picks it up once the mods have loaded.
    run(
      saveDesk.store.write("pending", p.save).pipe(
        Effect.map(() => {
          const url = new URL(location.href);
          url.searchParams.delete("mod");
          url.searchParams.delete("load");
          for (const m of p.save.mods) if (m.source) url.searchParams.append("mod", m.source);
          url.searchParams.set("load", "pending");
          location.assign(url.toString());
        }),
      ),
    );
  },
  loadWithoutMods: () => {
    const p = ui().prompt;
    if (p) run(finish(p.save));
  },
  cancelModPrompt: () => set({ prompt: null, busy: false }),
};

const said = (r: SaveResult): Partial<SavesUi> | null => {
  if (r.why !== "manual") return {};
  if (r.error) return { status: { text: r.error.message, tone: "bad" }, busy: false };
  return { status: { text: `Saved "${r.meta!.lab}" to ${slotName(r.slot)}.`, tone: "good" }, busy: false };
};

let booted = false;

/** Once, after the HUD mounts: read the shelf, greet a returning player, and honour `?load=` and `?saves=window`. */
export async function bootSaves(search = location.search) {
  if (booted) return;
  booted = true;
  await savesReady;
  saveDesk.skin = () => registry.get(skinUiAtom).active;
  saveDesk.subscribe((r) => refresh(said(r) ?? {}));
  refresh();
  const q = new URLSearchParams(search);
  const load = q.get("load");
  if (load !== null) {
    const url = new URL(location.href);
    url.searchParams.delete("load");
    history.replaceState(history.state, "", url.toString());
    if (!isSlot(load)) return;
    const read = saveDesk.store.read(load).pipe(Effect.flatMap(begin));
    run(load === "pending" ? read.pipe(Effect.ensuring(Effect.sync(() => (saveDesk.store.remove("pending"), refresh())))) : read);
    return;
  }
  // The newest save, autosave or slot (FLT-82): a player who saved to a slot after the last autosave continues from the slot.
  const newest = newestSave(saveDesk.store.list());
  if (newest && (welcomesYou(search) || q.get("saves") === "demo")) {
    saveDesk.held = true;
    set({ welcome: newest });
  }
  if (q.get("saves") === "window") refresh({ open: true });
}

const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");

/** Boot the saves, and let a `.fltsave` be dropped anywhere on the page. */
export function useSaves() {
  useEffect(() => {
    void bootSaves();
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      if (!ui().dragging) set({ dragging: true });
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) set({ dragging: false });
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      set({ dragging: false });
      const file = e.dataTransfer?.files[0];
      if (file) savesActions.importSave(file);
    };
    // Ctrl+S / ⌘S: the browser would save the page; the player means the lab.
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!ui().open) savesActions.openSaves();
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);
}
