import { ModError } from "./schema";

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
export function validateAssets(assets: Readonly<Record<string, string>>): void {
  let bytes = 0;
  for (const [id, url] of Object.entries(assets)) {
    if (!/^[\w./-]+$/.test(id) || id === "__proto__" || id === "constructor" || id.split("/").includes("..")) throw new ModError({ path: `assets.${id}`, detail: "invalid bundled asset id" });
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^(?:https?|ftp|blob|file|javascript):/i.test(url)) throw new ModError({ path: `assets.${id}`, detail: `remote files can't be loaded (no fetches from a mod); bundle "${id}" into the mod instead: \`flt-mod bundle <dir>\` inlines local files` });
    // SVG/HTML can load remote resources or carry executable markup, so v1 accepts raster images, fonts and GLBs.
    const match = /^data:(image\/(?:png|jpeg|webp|gif)|font\/(?:woff2?|ttf|otf)|model\/gltf-binary);base64,([A-Za-z0-9+/]*={0,2})$/.exec(url);
    if (!match || !match[2] || match[2].length % 4 !== 0) throw new ModError({ path: `assets.${id}`, detail: "expected a bundled base64 raster image, font, or GLB" });
    bytes += match[2].length * 3 / 4 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
    if (bytes > MAX_ASSET_BYTES) throw new ModError({ path: "assets", detail: "bundled assets exceed 2 MB per mod" });
  }
}

/** What a bundled asset is, from its (validated) data URL. */
export function assetKind(url: string): "image" | "font" | "model" | null {
  return url.startsWith("data:image/") ? "image" : url.startsWith("data:font/") ? "font" : url.startsWith("data:model/gltf-binary;") ? "model" : null;
}
/** A mod's own asset of the right kind, or a ModError that says which is missing or wrong. */
export function ownAsset(assets: Readonly<Record<string, string>>, id: string, kind: "image" | "font" | "model", path: string): string {
  const url = Object.hasOwn(assets, id) ? assets[id] : undefined;
  if (!url) {
    const known = Object.keys(assets);
    throw new ModError({ path, detail: `"${id}" is not one of this mod's assets${known.length ? ` (it has ${known.map((k) => `"${k}"`).join(", ")})` : "; add it under \"assets\""}` });
  }
  if (assetKind(url) !== kind) throw new ModError({ path, detail: `"${id}" is not ${kind === "image" ? "an image (PNG, JPEG, WebP or GIF)" : kind === "font" ? "a font (WOFF2, WOFF, TTF or OTF)" : "a .glb model"}` });
  return url;
}
