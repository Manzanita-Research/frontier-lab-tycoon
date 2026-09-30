// The app shell's mods (FLT-37): read `?mod=` once at start, fetch each manifest in order, compose and resolve them
// into one GameDefinition, and keep what went wrong for the Mod Manager. A mod that fails to load is skipped (the
// rest still load); if the set fails to compose, the game starts unmodded and says why. Never throws.
import { Effect, Exit, Scope } from "effect";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { contentHash } from "../mods/hash";
import { fetchMod, parseModLinks } from "../mods/links";
import { composeMods, type Conflict } from "../mods/loader";
import { ModError, type ModManifest } from "../mods/schema";
import { browserObjectUrls, materialise, resolvePresentation, type ObjectUrls, type Presentation } from "../mods/presentation";
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
  /** FLT-55: the id of the skin it brings, if any. */
  skin?: string;
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
  /** FLT-55: the mods' skins, assets (as `blob:` URLs), sound cues and walker looks. Null for the base game. Never in the World. */
  presentation: Presentation | null;
}

export const NO_MODS: ModSession = { def: null, mods: [], conflicts: [], errors: [], run: null, presentation: null };

/** Owns the session's `blob:` URLs: they are revoked when the page goes away for good (not into the back/forward cache). */
const assetScope = Effect.runSync(Scope.make());
if (typeof window !== "undefined") window.addEventListener("pagehide", (event) => { if (!event.persisted) void Effect.runPromise(Scope.close(assetScope, Exit.void)); });

const describe = (error: unknown): string => (error instanceof ModError ? `${error.path}: ${error.detail}` : String(error));

export async function loadModSession(search: string, options: { baseUrl?: string; fetcher?: typeof fetch; objectUrls?: ObjectUrls; scope?: Scope.Scope } = {}): Promise<ModSession> {
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
    const resolved = await Effect.runPromise(resolvePresentation(layer));
    const { presentation } = await Effect.runPromise(Scope.provide(materialise(resolved, options.objectUrls ?? browserObjectUrls), options.scope ?? assetScope));
    const mods = manifests.map(({ manifest, source }) => ({
      id: manifest.id, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, source, hash: contentHash(manifest),
      ...(manifest.skin ? { skin: manifest.skin.id } : {}),
    }));
    return { def, mods, conflicts, errors, run: { mods: mods.map(({ id, version, hash }) => ({ id, version, hash })), contentHash: contentHash(def.content) }, presentation };
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
