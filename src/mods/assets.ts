import { ModError } from "./schema";

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
export function validateAssets(assets: Readonly<Record<string, string>>): void {
  let bytes = 0;
  for (const [id, url] of Object.entries(assets)) {
    if (!/^[\w./-]+$/.test(id) || id === "__proto__" || id === "constructor" || id.split("/").includes("..")) throw new ModError({ path: `assets.${id}`, detail: "invalid bundled asset id" });
    // SVG/HTML can load remote resources or carry executable markup, so v1 accepts raster images, fonts and GLBs.
    const match = /^data:(image\/(?:png|jpeg|webp|gif)|font\/(?:woff2?|ttf|otf)|model\/gltf-binary);base64,([A-Za-z0-9+/]*={0,2})$/.exec(url);
    if (!match || !match[2] || match[2].length % 4 !== 0) throw new ModError({ path: `assets.${id}`, detail: "expected a bundled base64 raster image, font, or GLB" });
    bytes += match[2].length * 3 / 4 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
    if (bytes > MAX_ASSET_BYTES) throw new ModError({ path: "assets", detail: "bundled assets exceed 2 MB per mod" });
  }
}
