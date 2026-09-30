# Saves (FLT-65)

A lab is saved as one versioned JSON envelope. The same text sits in localStorage, in a downloaded `.fltsave` file and (FLT-67) in the cloud. Nothing leaves the browser unless the player exports a file.

```
src/save/        the format: envelope, codec, migrations, slots, files (pure but for file.ts; no React)
src/app/saves.ts the SaveDesk: autosaves and manual saves, written from the app machine's `save` action
src/ui/hud/saves.ts, saves.vm.ts   the Save/Load window, "Welcome back", the mods prompt, export/import, drag-and-drop
```

## The envelope

```jsonc
{
  "kind": "fltsave",              // what it is: a random JSON file gets "that isn't a lab save"
  "v": 1,                         // SAVE_VERSION; see Migrations
  "savedAt": "2026-09-30T12:00:00.000Z",
  "seed": 20240601,
  "lab": "Gradient Descent Labs", // for the menu
  "day": 425, "tick": 8500,       // "Y2 · Mar 5" is formatDate(day)
  "mods": [{ "id": "flt.base-pack", "version": "1.0.0", "hash": "…", "source": "https://…/mod.json" }],
  "skin": "frontier-95",          // restored on load, or null
  "enc": "gzip64",                // gzip then base64 (CompressionStream); "json" where the browser has none
  "state": "H4sIAAAA…"            // the World: JSON.stringify(GameState), packed per enc
}
```

Everything a menu needs is outside `state`, so listing saves never inflates one. `source` is the mod's `?mod=` value, which lets a load fetch the mod again. A mid-game campus (`createMidgameScenario`) is **about 45K** (44.7K measured); `MAX_SAVE_CHARS` refuses anything over 1.5M before it touches storage.

The World is checked, not decoded: `loadWorld` makes sure the fields the sim can't run without are there (seed, rngState, tick, day, cash, grid, buildings, walkers, flags) and hands back the rest untouched. Whatever the sim already fills in for an older World (a missing optional field) needs no migration.

## The API (what FLT-67 builds on)

All from `src/save` (`index.ts` is the whole surface). Errors are one `SaveError { reason, detail }`, where `detail` (also `message`) is a sentence a player can read. Reasons: `notASave`, `tooNew`, `corrupt`, `tooBig`, `quota`, `storage`, `empty`.

| | |
|---|---|
| `encodeSave(world, { mods?, skin?, savedAt? })` | World → `SaveFile` (Effect; compresses) |
| `serialize(save)` | `SaveFile` → the text to store or upload |
| `parseSave(textOrJson)` | text → current-version `SaveFile`: checks `kind`, refuses newer versions, runs migrations, validates with Effect Schema |
| `loadWorld(save)` | `SaveFile` → `GameState` (inflates and checks) |
| `decodeSave(text)` | both at once: `{ save, world }` |
| `metaOf(save)` | `SaveMeta`: the envelope minus `state`, plus `size` in characters |
| `makeSaveStore(storage)` | `{ available, peek(slot), list(), read(slot), write(slot, save), remove(slot) }` over any `SaveStorage` (`getItem`/`setItem`/`removeItem`) |
| `browserStorage()` / `memoryStorage(budget?)` | localStorage (null when blocked, e.g. private mode) / an in-memory one for tests and demos |
| `readSaveFile(file)` / `downloadSave(save)` / `saveFileName(save)` | `.fltsave` files: `gradient-descent-labs-y2-mar-5.fltsave` |

A cloud slot (FLT-67) is `serialize(save)` uploaded and `parseSave(text)` downloaded; `metaOf` gives the listing. It can reuse `makeSaveStore` with a `SaveStorage` backed by anything synchronous, or skip it.

To put a World in play, send the app machine `{ type: "LOAD_LAB", world }`; it swaps the World in, marks the calendar so the load itself isn't taken for a new month, and resumes. `{ type: "SAVE", slot, why }` saves the current World through the `Saves` service (`SaveDesk`); the result arrives on `saveDesk.subscribe`.

## Slots

localStorage keys are `flt.save.<slot>`: `auto`, `1`, `2`, `3`, and `pending` (a save waiting out a reload; never listed). A write that fails (too big, quota full, blocked) leaves the old save where it was and says so.

## Autosave

The app machine writes the `auto` slot:

- **every game month** (30 days), when `floor(day / 30)` goes up by exactly one (a load or a new lab jumping the calendar doesn't count);
- **on the ending**, when the outcome leaves `playing`;
- **on tab hide** (`visibilitychange`).

It never autosaves on a staged link (`?moment=`, `?scenario=`, `?shot`, …; `isStagedLink`), on the `?saves=` demo shelves, or while "Welcome back" is up (so a shared `?seed=` link doesn't overwrite the lab you came back for). Guests who never open the menu play exactly as before; the only new thing they see is "Welcome back" once they have an autosave.

## Loading

- **Start screen:** with an autosave, the game opens on "Welcome back" (Continue "{lab}", Y2 · Mar 5 / New lab), paused. New lab dismisses it; the autosave is overwritten after the new lab's first month.
- **Save/Load window:** Ctrl+S / ⌘S in every skin, plus a button where the skin has one (Frontier 95: Start ▸ Save / Load…). Save to a slot, open, export, delete, import.
- **Import:** a file picker, or drop a `.fltsave` anywhere on the page. Errors are friendly ("That isn't a lab save. It isn't even JSON.").
- **Mods:** a save made with other mods (compared by `id@hash`) asks first. If every missing mod has a `source`, **Reload with its mods** writes the save to `pending` and reloads with those `?mod=` values plus `?load=pending`; boot loads it and removes the slot. Otherwise **Load anyway** (with a warning) or Cancel.
- **Skin:** the save's skin comes back (and is remembered) if this build has it.

`?load=<slot>` loads a slot on boot and strips itself from the URL.

## Migrations

`MIGRATIONS[n]` upgrades a v`n` envelope to v`n+1` (and the World inside, if it has to: unpack, fix, repack). `migrate` runs every step up to `SAVE_VERSION`, and `parseSave` calls it before validation.

Adding a version: bump `SAVE_VERSION` in `format.ts`, add `MIGRATIONS[old]`, freeze a save of the old version in `src/save/fixtures/` and extend `migrations.test.ts`. The frozen v1 save is `fixtures/v1-garage-day45.fltsave` (a day-45 garage); its test must keep passing forever.

When a content id is renamed (the rival `vssi` becoming `supersuper` in the FLT-62 wave, say), old saves still carry the old id inside the World: that is a migration, v1 → v2, which renames it wherever the World keeps rival ids.

## Demo shelves

`?saves=demo` opens on "Welcome back" and `?saves=window` on the Save/Load window, both over a pretend shelf in memory (the autosave is the mid-game campus saved three hours ago; slot 1 is the frozen v1 garage from two days ago). The player's real saves are never read or written. The screenshot scenes `saves-welcome`, `saves-window` and `saves-phone` use them.

## Tests

- `src/save/save.test.ts`: round trips, the gzip and json encodings, friendly errors, size cap, quota, blocked storage, and **determinism**: save at tick N, load, run M ticks, and the World matches an uninterrupted run.
- `src/save/migrations.test.ts`: the frozen v1 save loads and plays on; the table has no gaps.
- `src/app/saves.test.ts`: month autosave, manual save, LOAD_LAB, staged links and the held Welcome.
- `src/ui/hud/vm.test.ts` ("saves"), `src/skins/skins.test.tsx`: the view-model and every skin's Welcome and SaveLoad slots.
