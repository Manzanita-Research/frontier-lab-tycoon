// The one account file that reaches into the game (FLT-67): the cloud's GamePort on FLT-65's saves. Like everything
// in src/account it is compiled in only with VITE_FLT_AUTH=on (src/account/boundary.test.ts holds the line). It adds
// no app events: uploads hear about saves the app machine's `save` action has already written (inside `survive()`),
// and a cloud lab loads through the Save window's own import, so it lands with LOAD_LAB like a dropped file.
import { Effect } from "effect";
import { registry, saveDesk, savesReady } from "../app/game";
import { welcomesYou } from "../app/saves";
import { parseSave, SAVE_MIME, serialize, SLOTS, type SlotId } from "../save";
import { formatDate } from "../sim/format";
import { guard } from "../ui/hud/guard";
import { savesActions, savesAtom } from "../ui/hud/saves";
import { agoText, sizeText } from "../ui/hud/saves.vm";
import type { GamePort } from "./cloud/controller";
import type { Slot } from "./contract";

const isCloudSlot = (slot: SlotId): slot is Slot => (SLOTS as readonly string[]).includes(slot);

export const gamePort: GamePort = {
  ready: savesReady,
  onSaved: (f) =>
    saveDesk.subscribe((r) => {
      // The desk calls this from inside the save; the upload starts after it, and a slip here is reported, never thrown.
      if (r.meta && isCloudSlot(r.slot)) {
        const { slot, why } = r;
        queueMicrotask(() => guard("cloud upload", () => f(slot, why), undefined));
      }
    }),
  read: (slot) => Effect.runPromise(saveDesk.store.read(slot).pipe(Effect.map(serialize), Effect.orElseSucceed(() => null))),
  local: () =>
    saveDesk.store
      .list()
      .flatMap((l) => (l.meta ? [{ slot: l.slot, savedAt: l.meta.savedAt, seed: l.meta.seed, lab: l.meta.lab, day: l.meta.day }] : [])),
  shelf: () => {
    const ui = registry.get(savesAtom);
    // The shelf's first read fills the listing (four rows, empty or not); until then it is [].
    return { booted: ui.listing.length > 0, welcome: ui.welcome !== null };
  },
  onShelf: (f) => registry.subscribe(savesAtom, () => guard("cloud shelf", f, undefined)),
  hold: (on) => void (saveDesk.held = on),
  load: (text) =>
    Effect.runPromise(
      parseSave(text).pipe(
        Effect.map(() =>
          guard(
            "cloud load",
            () => {
              savesActions.importSave(new File([text], "cloud.fltsave", { type: SAVE_MIME }));
              // importSave opens the Save window to report on a file; this one came from a button, and a problem
              // comes back here. (A save made with other mods still asks: that question shows without the window.)
              registry.set(savesAtom, { ...registry.get(savesAtom), open: false });
              return null;
            },
            "Something went wrong loading that lab.",
          ),
        ),
        Effect.catch((e) => Effect.succeed(e.message)),
      ),
    ),
  greets: () => welcomesYou(location.search),
  now: () => Date.now(),
  date: formatDate,
  ago: agoText,
  size: sizeText,
};
