# FLT-65: Local autosave + save-file export/import (foundation for cloud saves)

_Copied from the task description (label: explore). The implementation notes are in `docs/SAVES.md`._

**Local autosave plus save-file export/import** (the foundation for cloud saves; Jem allowed this now).

- **Autosave to localStorage** every game month, on tab hide and on ending. The start screen offers **Continue "{lab}", Y2 · Mar 5** plus **New lab**. Keep 3 manual slots plus the autosave.
- **Save format:** versioned JSON.
  - Contents: `{ v, savedAt, seed, lab, day, mods: [{id, version, hash}], skin, state }`. `state` is the plain sim snapshot, compressed (CompressionStream), with no functions.
  - A **migrations table** keyed by `v`, so old saves keep loading, with a test on a frozen v1 save.
  - Loading restores the exact state: a determinism test saves at tick N, loads it, runs M ticks, and compares with the uninterrupted run.
- **Export/import:** download a `.fltsave` file; import by file picker or drag-and-drop. Validate with Effect Schema and show friendly errors.
- **Mods:** a save remembers its mods. On load, offer to fetch the missing ones via their `?mod=` URL, or warn if they're missing. The skin is restored.
- **Privacy:** nothing leaves the browser. Size-cap saves and handle a full localStorage quota gracefully.
- **Guests keep working exactly as today.** Loading is opt-in.
- **Evidence:**
  - tests (round-trip, migration, determinism across save/load);
  - before/after screenshots of the start screen with Continue and the Save/Load window in Frontier 95;
  - the save size for a mid-game state.


