// Today's Drama (FLT-34), the impure half: fetch the published feed from this site, remember what the player has seen,
// and play a pack. Playing means loading it like any mod, through `?mod=`: mods are read once, before the game exists,
// so a pack starts a new lab (there is no save to carry over), and switching it off is the Mod Manager's Remove.
import { Effect, Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { registry } from "../app/game";
import { modSession } from "../app/mods";
import { DRAMA_PLAY_CONFIRM, feedBase, FeedIndex, FeedLatest, loadedDrama, NO_DRAMA_UI, withDrama, withoutAutosave, withoutMod, type DramaUi } from "./feed";

// keepAlive: the boot hook sets it before anything reads it.
export const dramaAtom = Atom.keepAlive(Atom.make<DramaUi>({ ...NO_DRAMA_UI, seen: readSeen() }));

const SEEN_KEY = "flt.drama.seen";
const INTRO_KEY = "flt.drama.intro";
/** How long after the HUD appears before asking the feed what's new: the game's own start goes first. */
const LATEST_DELAY_MS = 1500;

function readSeen(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

const update = (f: (ui: DramaUi) => DramaUi) => registry.set(dramaAtom, f(registry.get(dramaAtom)));

const getJson = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as unknown;
    },
    catch: (error) => new Error(`${url}: ${String(error)}`),
  });

const base = () => feedBase(location.search);
const fetchLatest = getJson(`${base()}/latest.json`).pipe(Effect.flatMap(Schema.decodeUnknownEffect(FeedLatest)));
const fetchIndex = getJson(`${base()}/index.json`).pipe(Effect.flatMap(Schema.decodeUnknownEffect(FeedIndex)));

let latestAsked = false;
function loadLatest() {
  if (latestAsked) return;
  latestAsked = true;
  void Effect.runPromise(Effect.result(fetchLatest)).then((r) => {
    // The index may have landed first (the window opened quickly); it knows at least as much.
    if (r._tag === "Success") update((ui) => (ui.packs ? ui : { ...ui, latest: r.success.pack }));
  });
}

let indexAsked = false;
function loadIndex() {
  if (indexAsked && registry.get(dramaAtom).status !== "error") return;
  indexAsked = true;
  update((ui) => ({ ...ui, status: "loading" }));
  void Effect.runPromise(Effect.result(fetchIndex)).then((r) =>
    update((ui) => (r._tag === "Success" ? { ...ui, status: "ready", packs: r.success.packs, latest: r.success.packs[0] ?? null } : { ...ui, status: "error" })),
  );
}

function markSeen() {
  const latest = registry.get(dramaAtom).latest;
  if (!latest) return;
  try {
    localStorage.setItem(SEEN_KEY, latest.id);
  } catch {
    /* The NEW badge just comes back next visit. */
  }
  update((ui) => ({ ...ui, seen: latest.id }));
}

/** Once, when the HUD first appears: introduce a pack this tab has just loaded, else quietly ask what's new. */
export function startDrama(): () => void {
  const loaded = loadedDrama(modSession().mods, location.href);
  let introduced: string | null = null;
  try {
    introduced = sessionStorage.getItem(INTRO_KEY);
  } catch {
    /* No storage: introduce it every time, which is fine. */
  }
  if (loaded && introduced !== loaded.path) {
    try {
      sessionStorage.setItem(INTRO_KEY, loaded.path);
    } catch {
      /* As above. */
    }
    update((ui) => ({ ...ui, open: true, intro: true }));
    loadIndex();
    return () => undefined;
  }
  const t = window.setTimeout(loadLatest, LATEST_DELAY_MS);
  return () => window.clearTimeout(t);
}

export const dramaActions = {
  openDrama: () => {
    update((ui) => ({ ...ui, open: true, intro: false }));
    loadIndex();
  },
  closeDrama: () => {
    markSeen();
    update((ui) => ({ ...ui, open: false, intro: false }));
  },
  /** A new lab with this pack (and any other mods still on); another Drama pack makes way for it. */
  playDrama: (id: string) => {
    const ui = registry.get(dramaAtom);
    const pack = (ui.packs ?? []).concat(ui.latest ? [ui.latest] : []).find((p) => p.id === id);
    if (!pack) return;
    // Hotfix (FLT-78 does the full fix): this reloads into a NEW lab. Ask first, and keep the Drama lab from
    // autosaving over the player's lab.
    if (typeof window.confirm === "function" && !window.confirm(DRAMA_PLAY_CONFIRM)) return;
    markSeen();
    location.assign(withoutAutosave(withDrama(location.href, pack.url)));
  },
  /** A new lab without that mod. */
  removeMod: (id: string) => {
    const mod = modSession().mods.find((m) => m.id === id);
    if (mod) location.assign(withoutMod(location.href, mod.source));
  },
};
