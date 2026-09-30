// Switching skins: load, apply, remember. The picker's preview/apply/cancel semantics live here so they survive a
// change of skin (the SkinPicker slot itself is replaced when the skin changes).
import { registry } from "../../app/game";
import { BASE_ID, DEFAULT_SKIN, MOTION_KEY, STORAGE_KEY, SkinRefused, applyPrepared, initialSkinId, prepareSkin } from "../../skins/registry";
import { loadedSkinAtom, skinUiAtom, type SkinUi } from "./state";

const ui = () => registry.get(skinUiAtom);
const setUi = (patch: Partial<SkinUi>) => registry.set(skinUiAtom, { ...ui(), ...patch });

function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Private mode: the choice lasts for this visit. */
  }
}
const recall = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

function refuse(e: unknown, id: string) {
  const errors = e instanceof SkinRefused ? e.errors : [String(e)];
  console.warn(e instanceof SkinRefused ? e.message : `Skin "${id}" failed to load: ${errors[0]}`);
  const rest = ui().refused.filter((r) => r.id !== id);
  setUi({ refused: [...rest, { id, errors }] });
}

/**
 * Show a skin. A skin that is refused is reported (console and the picker) and the game falls back to the default,
 * then to the base, so the player is never left without a HUD. Returns the id that ended up showing.
 */
export async function showSkin(id: string, opts: { persist?: boolean } = {}): Promise<string> {
  for (const candidate of [...new Set([id, DEFAULT_SKIN, BASE_ID])]) {
    try {
      const prepared = await prepareSkin(candidate);
      await applyPrepared(prepared);
      registry.set(loadedSkinAtom, prepared.skin);
      setUi({ active: candidate, refused: ui().refused.filter((r) => r.id !== candidate) });
      if (opts.persist && candidate === id) remember(STORAGE_KEY, id);
      return candidate;
    } catch (e) {
      refuse(e, candidate);
    }
  }
  return BASE_ID;
}

/** First paint: `?skin=`, then what the player last chose, then Frontier 95. Also restores the reduced-motion switch. */
export async function bootSkin(): Promise<void> {
  if (recall(MOTION_KEY) === "reduced") applyMotion(true);
  await showSkin(initialSkinId(window.location.search, recall(STORAGE_KEY)));
}

function applyMotion(on: boolean) {
  if (on) document.documentElement.dataset.motion = "reduced";
  else delete document.documentElement.dataset.motion;
  setUi({ reducedMotion: on });
}

export const skinActions = {
  openSkinPicker() {
    setUi({ picker: { open: true, original: ui().active } });
  },
  previewSkin(id: string) {
    void showSkin(id);
  },
  applySkin() {
    remember(STORAGE_KEY, ui().active);
    setUi({ picker: { open: false, original: null } });
  },
  cancelSkinPicker() {
    const original = ui().picker.original;
    setUi({ picker: { open: false, original: null } });
    if (original && original !== ui().active) void showSkin(original);
  },
  setReducedMotion(on: boolean) {
    remember(MOTION_KEY, on ? "reduced" : null);
    applyMotion(on);
  },
};
