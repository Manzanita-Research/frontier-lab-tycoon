// Switching skins: load, apply, remember. The picker's preview/apply/cancel semantics live here so they survive a
// change of skin (the SkinPicker slot itself is replaced when the skin changes).
import { registry } from "../../app/game";
import { modSession } from "../../app/mods";
import { BASE_ID, DEFAULT_SKIN, MOTION_KEY, STORAGE_KEY, SkinRefused, applyPrepared, initialSkinId, modSkin, prepareSkin, registerModSkins, skinList } from "../../skins/registry";
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

/** A mod skin's answer ("yes" or "no") is kept per skin, so `flt.skin` only ever names a built-in skin. */
const OFFER_KEY = "flt.modskin.";

/** The mod skin a loaded mod asks to put on (its `activate`), if it is pickable. */
function askedFor(): string | null {
  const active = modSession().presentation?.skins.active;
  return active && modSkin(active) ? active : null;
}

/**
 * First paint: `?skin=`, then what the player last chose, then Frontier 95. Also restores the reduced-motion switch.
 * FLT-55: the session's mod skins are registered first (so `?skin=<mod skin>` works). A mod that asks for its skin
 * gets it only after the player says yes; the answer is remembered, and an explicit `?skin=` never asks.
 */
export async function bootSkin(): Promise<void> {
  if (recall(MOTION_KEY) === "reduced") applyMotion(true);
  const session = modSession();
  const owners = Object.fromEntries(session.mods.flatMap((m) => (m.skin ? [[m.skin, { id: m.id, name: m.name, version: m.version }]] : [])));
  const refused = registerModSkins(session.presentation?.skins.skins ?? {}, owners);
  if (refused.length > 0) setUi({ refused: [...ui().refused, ...refused] });
  const explicit = new URLSearchParams(window.location.search).get("skin");
  const asked = askedFor();
  const answer = asked ? recall(OFFER_KEY + asked) : null;
  await showSkin(asked && !explicit && answer === "yes" ? asked : initialSkinId(window.location.search, recall(STORAGE_KEY)));
  if (asked && !explicit && answer === null) {
    const skin = modSkin(asked)!;
    const info = skinList().find((s) => s.id === asked);
    setUi({ offer: { skin: asked, name: skin.data.name, mod: skin.mod.id, modName: skin.mod.name, description: info?.description ?? "", preview: info?.preview ?? "" } });
  }
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
    const active = ui().active;
    // A mod skin is remembered as a yes to that mod's skin; a built-in one is the player's skin, and turns a mod's down.
    if (modSkin(active)) remember(OFFER_KEY + active, "yes");
    else {
      remember(STORAGE_KEY, active);
      const asked = askedFor();
      if (asked) remember(OFFER_KEY + asked, "no");
    }
    setUi({ picker: { open: false, original: null } });
  },
  cancelSkinPicker() {
    const original = ui().picker.original;
    setUi({ picker: { open: false, original: null } });
    if (original && original !== ui().active) void showSkin(original);
  },
  acceptSkinOffer() {
    const offer = ui().offer;
    if (!offer) return;
    setUi({ offer: null });
    remember(OFFER_KEY + offer.skin, "yes");
    void showSkin(offer.skin);
  },
  declineSkinOffer() {
    const offer = ui().offer;
    if (!offer) return;
    setUi({ offer: null });
    remember(OFFER_KEY + offer.skin, "no");
  },
  setReducedMotion(on: boolean) {
    remember(MOTION_KEY, on ? "reduced" : null);
    applyMotion(on);
  },
};
