// `?saves=demo` and `?saves=window`: a pretend save shelf for screenshots and the curious. It lives in memory, so the
// player's real saves are never read or touched: the autosave is the mid-game campus, slot 1 the frozen v1 garage.
import { Effect } from "effect";
import { encodeSave, makeSaveStore, memoryStorage, parseSave, serialize, slotKey, type SaveStore } from "../save";
import { withDefs } from "../sim/defs";
import { createMidgameScenario } from "../sim/scenarios/midgame";
import type { GameDefinition } from "../mods/game-definition";

const HOUR = 3_600_000;

/** A store holding the demo saves. `ready` settles once they are written (encoding is async). */
export function demoSaveStore(def: GameDefinition | null): { store: SaveStore; ready: Promise<void> } {
  const storage = memoryStorage();
  const store = makeSaveStore(storage);
  const now = Date.now();
  const ready = (async () => {
    const campus = withDefs(def, createMidgameScenario);
    const auto = await Effect.runPromise(encodeSave(campus, { skin: null, savedAt: new Date(now - 3 * HOUR) }));
    storage.setItem(slotKey("auto"), serialize(auto));
    const { default: garage } = await import("../save/fixtures/v1-garage-day45.fltsave?raw");
    const old = await Effect.runPromise(parseSave(garage));
    storage.setItem(slotKey("1"), serialize({ ...old, savedAt: new Date(now - 50 * HOUR).toISOString() }));
  })().catch((e) => console.warn("[saves] demo shelf", e));
  return { store, ready };
}
