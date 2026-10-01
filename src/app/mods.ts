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
import type { Note } from "../audio/score";

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
  /** FLT-78: why it can't come or go mid-game (it needs a fresh start). Absent for a data-only mod. */
  needsRestart?: string;
}

/** A fetched manifest and its `?mod=` value. */
export interface SessionManifest {
  manifest: ModManifest;
  source: string;
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
  /** The mods' own sound cues (added, or replacing the base's), later mods winning. The base game's are in `src/audio/score.ts`. */
  cues: Readonly<Record<string, readonly Note[]>>;
  /** FLT-78: the manifests behind `def`, in order, so a mod can be added or removed mid-game and the set recomposed. */
  manifests: readonly SessionManifest[];
}

export const NO_MODS: ModSession = { def: null, mods: [], conflicts: [], errors: [], run: null, presentation: null, cues: {}, manifests: [] };

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
    const { layer } = composeMods(manifests.map((m) => m.manifest));
    const resolved = await Effect.runPromise(resolvePresentation(layer));
    const { presentation } = await Effect.runPromise(Scope.provide(materialise(resolved, options.objectUrls ?? browserObjectUrls), options.scope ?? assetScope));
    return { ...(await compose(manifests)), errors, presentation, cues: Object.assign({}, ...manifests.map((m) => m.manifest.audio?.cues ?? {})) };
  } catch (error) {
    return { ...NO_MODS, errors: [...errors, `${manifests.map((m) => m.manifest.id).join(" + ")}: ${describe(error)}`] };
  }
}

/** The definition, mod list and RunMods for a set of manifests. Throws when they don't compose. */
async function compose(manifests: readonly SessionManifest[]): Promise<Pick<ModSession, "def" | "mods" | "conflicts" | "run" | "manifests">> {
  if (manifests.length === 0) return { def: null, mods: [], conflicts: [], run: null, manifests: [] };
  const { layer, conflicts } = composeMods(manifests.map((m) => m.manifest));
  const def = await Effect.runPromise(resolveGameDefinition(layer));
  const mods = manifests.map(({ manifest, source }) => {
    const restart = needsRestart(manifest);
    return {
      id: manifest.id, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, source, hash: contentHash(manifest),
      ...(manifest.skin ? { skin: manifest.skin.id } : {}),
      ...(restart ? { needsRestart: restart } : {}),
    };
  });
  return { def, mods, conflicts, run: { mods: mods.map(({ id, version, hash }) => ({ id, version, hash })), contentHash: contentHash(def.content) }, manifests };
}

/** What a mod may touch and still join (or leave) a running lab: words and cards, nothing the World is built from. */
const LIVE_SECTIONS = new Set(["headlines", "thoughts", "events", "rivals", "tips"]);
/** A rival's fields a mod may change mid-game: what it says about itself. */
const LIVE_RIVAL_FIELDS = new Set(["id", "tagline"]);

/**
 * FLT-78: null when the mod is data-only (it can be added to a running lab, and removed from one); otherwise why it
 * needs a fresh start, in the Mod Manager's words.
 */
export function needsRestart(manifest: ModManifest): string | null {
  if (manifest.skin || manifest.assets || manifest.audio || manifest.looks) return "Brings a look or sounds: needs a fresh start.";
  const content = manifest.content ?? {};
  for (const [section, patch] of Object.entries(content)) {
    if (patch === undefined) continue;
    if (!LIVE_SECTIONS.has(section)) return `Changes ${section}: needs a fresh start.`;
  }
  const events = content.events;
  if (events?.override?.length || events?.remove?.length || events?.add?.some((e) => !("choices" in e))) return "Changes how events work: needs a fresh start.";
  const rivals = content.rivals;
  if (rivals?.add?.length || rivals?.remove?.length || rivals?.override?.some((r) => Object.keys(r).some((k) => !LIVE_RIVAL_FIELDS.has(k)))) return "Changes the rival labs: needs a fresh start.";
  return null;
}

/** The event cards a mod adds (what a mid-game add schedules, and a remove cancels). */
export const cardsOf = (manifest: ModManifest): string[] => (manifest.content?.events?.add ?? []).flatMap((e) => ("choices" in e ? [e.id] : []));

/** The session with one more mod (last, so it wins its conflicts). Throws when it doesn't compose. */
export async function withMod(session: ModSession, added: SessionManifest): Promise<ModSession> {
  const manifests = [...session.manifests.filter((m) => m.manifest.id !== added.manifest.id), added];
  return { ...session, ...(await compose(manifests)) };
}

/** The session without a mod. */
export async function withoutModId(session: ModSession, id: string): Promise<ModSession> {
  return { ...session, ...(await compose(session.manifests.filter((m) => m.manifest.id !== id))) };
}

/** One `?mod=` value, fetched and checked. */
export async function fetchOne(source: string, options: { baseUrl?: string; fetcher?: typeof fetch } = {}): Promise<SessionManifest> {
  const [link] = parseModLinks(`?${new URLSearchParams({ mod: source })}`, options.baseUrl);
  if (!link) throw new Error(`${source}: not a mod link`);
  try {
    return { manifest: await Effect.runPromise(fetchMod(link, options.fetcher ?? fetch)), source };
  } catch (error) {
    throw new Error(`${source}: ${describe(error)}`);
  }
}

let current: ModSession = NO_MODS;
/** The session's mods, as loaded before the game was created. */
export const modSession = (): ModSession => current;
export function setModSession(session: ModSession) {
  current = session;
}
