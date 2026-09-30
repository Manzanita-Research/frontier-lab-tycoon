// The CRT setting (FLT-73): the player's pick (Display Properties → Settings), the skin's default, `?crt=` for a
// visit, and what the canvas can afford. Everything lands in `crtAtom`, which the scene (CrtFX) and the CSS tube read.
import { registry } from "../../app/game";
import { isCrtMode, type CrtMode, type CrtTier, CRT_TIERS } from "../../render/crt/looks";
import { CrtGovernor } from "../../render/crt/governor";
import { crtAtom, crtGovernor } from "../../render/crt/state";
import { photoAtom } from "../../render/fx/photoState";
import { loadedSkinAtom } from "../hud/state";

const KEY = "flt.crt";

function recall(): CrtMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return isCrtMode(v) ? v : null;
  } catch {
    return null;
  }
}

const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
/** `?crt=off|subtle|full` pins the look for this visit (never saved), and `?crttier=multi|lite|flat` the canvas. Both switch the governor off. */
const pinnedMode = isCrtMode(params.get("crt")) ? (params.get("crt") as CrtMode) : null;
const pinnedTier = (CRT_TIERS as readonly string[]).includes(params.get("crttier") ?? "") ? (params.get("crttier") as CrtTier) : null;

/** A phone starts on the lite shader: a small touch screen, where the multi-pass pipeline costs the most per useful pixel. */
function startTier(): CrtTier {
  if (pinnedTier) return pinnedTier;
  if (typeof window === "undefined") return "multi";
  const touch = !!window.matchMedia?.("(pointer: coarse)").matches;
  return touch && Math.min(window.innerWidth, window.innerHeight) < 700 ? "lite" : "multi";
}

let chosen: CrtMode | null = recall();
const pinned = pinnedMode !== null || pinnedTier !== null;

function recompute(patch: { tier?: CrtTier; reduced?: boolean } = {}) {
  const skinDefault = registry.get(loadedSkinAtom).crt ?? "off";
  const mode: CrtMode = registry.get(photoAtom) ? "off" : (pinnedMode ?? chosen ?? skinDefault);
  const prev = registry.get(crtAtom);
  const next = { ...prev, mode, pinned, ...patch };
  // The first time the tube comes on, a governor starts watching the frame rate (the canvas feeds it; see CrtLayer).
  if (mode !== "off" && !pinned && !crtGovernor.current) crtGovernor.current = new CrtGovernor(next.tier);
  if (next.mode !== prev.mode || next.tier !== prev.tier || next.reduced !== prev.reduced || next.pinned !== prev.pinned) registry.set(crtAtom, next);
}

/** The player picked a look: remember it, and give the canvas a fresh chance at its best tier. */
export function setCrtMode(mode: CrtMode) {
  chosen = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* Private mode: the pick lasts for this visit. */
  }
  crtGovernor.current = null;
  recompute({ tier: startTier(), reduced: false });
}

/** The player's own pick, or null while the skin's default applies. */
export const crtChoice = () => chosen;

// The look follows the skin (its default) and photo mode (off while it is up). Runs once, when the game UI loads.
if (typeof window !== "undefined") {
  recompute({ tier: startTier(), reduced: false });
  registry.subscribe(loadedSkinAtom, () => recompute());
  registry.subscribe(photoAtom, () => recompute());
}
