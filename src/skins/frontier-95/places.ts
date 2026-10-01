// Where the player put each window (FLT-90). Frontier 95's windows drag by their title bars, like the real thing, and
// stay where they were put: across reloads (localStorage, one key per skin), and against the HUD's own auto-layout (a
// moved window leaves the column, so the column's folding never touches it). Pure, so the rules are tested without a DOM.

/** A moved window: its top-left corner on the screen and the width it had when it was moved, in CSS pixels. */
export interface Place {
  x: number;
  y: number;
  w: number;
}

export interface View {
  width: number;
  height: number;
}

/** How much of the title bar must stay on the screen, across: enough to grab it again. */
export const GRIP = 64;
/** The title bar's height (`.f95-tb`). */
export const BAR = 26;
/** The taskbar along the bottom (`--taskbar`): a title bar under it could not be grabbed. */
export const TASKBAR = 42;

/**
 * Keep a window reachable: its title bar never goes above the top of the screen or under the taskbar, and at least
 * GRIP pixels of it stay on the screen across. Applied when a window is dropped and again on every resize, so a window
 * left near the edge of a big screen comes back on a small one (and goes back to where it was if the screen grows).
 */
export function clampPlace(p: Place, view: View): Place {
  const grip = Math.min(GRIP, p.w);
  const minX = grip - p.w;
  const maxX = Math.max(minX, view.width - grip);
  const maxY = Math.max(0, view.height - TASKBAR - BAR);
  return { x: Math.round(clamp(p.x, minX, maxX)), y: Math.round(clamp(p.y, 0, maxY)), w: p.w };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const isPlace = (v: unknown): v is Place => {
  const p = v as Place;
  return !!p && typeof p === "object" && [p.x, p.y, p.w].every((n) => typeof n === "number" && Number.isFinite(n)) && p.w > 0;
};

/** The storage key: one per skin, so a window moved in Frontier 95 does not move in a skin laid out differently. */
export const placesKey = (skin: string) => `flt.windows.${skin}`;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface Places {
  get(id: string): Place | undefined;
  /** The player dropped a window here (already clamped by the caller to the screen it was dropped on). */
  set(id: string, place: Place): void;
  /** Start ▸ Settings ▸ Reset window positions: every window goes back where the game puts it. */
  reset(): void;
  /** Has the player moved anything? (The Reset item is greyed out until they have.) */
  any(): boolean;
  subscribe(listener: () => void): () => void;
  /** Bumped on every change, for `useSyncExternalStore`. */
  version(): number;
}

/**
 * The positions for one skin. Storage is best effort: a blocked or full localStorage (private mode, a quota) costs the
 * memory across reloads and nothing else, and a garbled entry is ignored rather than trusted.
 */
export function makePlaces(skin: string, storage: Store | null): Places {
  const key = placesKey(skin);
  const map = new Map<string, Place>(Object.entries(read(storage, key)).filter((e): e is [string, Place] => isPlace(e[1])));
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => {
    version++;
    try {
      if (map.size === 0) storage?.removeItem(key);
      else storage?.setItem(key, JSON.stringify(Object.fromEntries(map)));
    } catch {
      /* the positions live for this visit only */
    }
    for (const f of [...listeners]) f();
  };
  return {
    get: (id) => map.get(id),
    set(id, place) {
      if (!isPlace(place)) return;
      map.set(id, { x: Math.round(place.x), y: Math.round(place.y), w: Math.round(place.w) });
      changed();
    },
    reset() {
      if (map.size === 0) return;
      map.clear();
      changed();
    },
    any: () => map.size > 0,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

function read(storage: Store | null, key: string): Record<string, unknown> {
  try {
    const raw = storage?.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Which window is in front: the one clicked or dragged last. Not saved (a fresh page starts with the game's own order).
 * `z(id)` is a z-index above the docked windows and a moved window that was never clicked (Z_BASE), and below the
 * Start menu (30), the coach (44) and the message layer (80).
 */
export interface Order {
  raise(id: string): void;
  z(id: string): number | undefined;
  subscribe(listener: () => void): () => void;
  version(): number;
}

export const Z_BASE = 10;
export const Z_TOP = 29;

export function makeOrder(): Order {
  let ids: string[] = [];
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    raise(id) {
      if (ids[ids.length - 1] === id) return;
      ids = [...ids.filter((x) => x !== id), id].slice(-(Z_TOP - Z_BASE));
      version++;
      for (const f of [...listeners]) f();
    },
    z(id) {
      const i = ids.indexOf(id);
      return i < 0 ? undefined : Z_BASE + 1 + i;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}
