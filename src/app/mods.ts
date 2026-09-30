// The app shell's mods (FLT-37): read `?mod=` once at start, fetch each manifest in order, compose and resolve them
// into one GameDefinition, and keep what went wrong for the Mod Manager. A mod that fails to load is skipped (the
// rest still load); if the set fails to compose, the game starts unmodded and says why. Never throws.
import { Effect } from "effect";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { contentHash } from "../mods/hash";
import { fetchMod, parseModLinks } from "../mods/links";
import { composeMods, type Conflict } from "../mods/loader";
import { ModError, type ModManifest } from "../mods/schema";
import type { RunMods } from "../sim/types";

export interface LoadedMod {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** Where it came from: the `?mod=` value. */
  source: string;
  hash: string;
}

export interface ModSession {
  /** Null when nothing loaded: the base game. */
  def: GameDefinition | null;
  mods: LoadedMod[];
  conflicts: readonly Conflict[];
  /** One line per problem: "<source>: <path>: <detail>". */
  errors: string[];
  /** What goes in the World (`GameState.mods`). */
  run: RunMods | null;
}

export const NO_MODS: ModSession = { def: null, mods: [], conflicts: [], errors: [], run: null };

const describe = (error: unknown): string => (error instanceof ModError ? `${error.path}: ${error.detail}` : String(error));

export async function loadModSession(search: string, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): Promise<ModSession> {
  if (!new URLSearchParams(search).has("mod")) return NO_MODS;
  const errors: string[] = [];
  let links: ReturnType<typeof parseModLinks> = [];
  try {
    links = parseModLinks(search, options.baseUrl);
  } catch (error) {
    return { ...NO_MODS, errors: [describe(error)] };
  }
  const manifests: { manifest: ModManifest; source: string }[] = [];
  for (const link of links) {
    try {
      manifests.push({ manifest: await Effect.runPromise(fetchMod(link, options.fetcher ?? fetch)), source: link.source });
    } catch (error) {
      errors.push(`${link.source}: ${describe(error)}`);
    }
  }
  if (manifests.length === 0) return { ...NO_MODS, errors };
  try {
    const { layer, conflicts } = composeMods(manifests.map((m) => m.manifest));
    const def = await Effect.runPromise(resolveGameDefinition(layer));
    const mods = manifests.map(({ manifest, source }) => ({
      id: manifest.id, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, source, hash: contentHash(manifest),
    }));
    return { def, mods, conflicts, errors, run: { mods: mods.map(({ id, version, hash }) => ({ id, version, hash })), contentHash: contentHash(def.content) } };
  } catch (error) {
    return { ...NO_MODS, errors: [...errors, `${manifests.map((m) => m.manifest.id).join(" + ")}: ${describe(error)}`] };
  }
}

let current: ModSession = NO_MODS;
/** The session's mods, as loaded before the game was created. */
export const modSession = (): ModSession => current;
export function setModSession(session: ModSession) {
  current = session;
}
