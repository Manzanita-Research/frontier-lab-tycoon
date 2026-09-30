import type { SkinApi } from "./services/skin";

/** The sole FLT-14 seam. Pass its registry here when it lands; no UI/DOM import is required headlessly. */
export function readSkinRegistry(registry?: SkinApi): SkinApi {
  if (registry) return structuredClone(registry);
  // Faithful token snapshot of today's ui.css. This does not register or activate a new HUD skin.
  return {
    active: "base-game",
    skins: { "base-game": { id: "base-game", name: "Base game", tokens: {
      "--ink": "#3a2a1c", "--cream": "#fff3d6", "--cream-2": "#ffe8b8", "--orange": "#ff8a4c", "--good": "#2c9a58", "--bad": "#d6452f",
      "--shadow": "0 4px 0 rgba(58, 42, 28, 0.85), 0 10px 18px rgba(58, 42, 28, 0.25)",
      "--font": 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
    } } },
  };
}
