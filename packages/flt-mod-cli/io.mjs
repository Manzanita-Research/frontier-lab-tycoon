import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

export const gameRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
export const MAX_MANIFEST_BYTES = 3 * 1024 * 1024;
export async function withGameRuntime(use) {
  // Keep Schema filters and decoders in one module graph. Mixing native Effect
  // with Vite's transformed Effect can misapply synchronous checks after imports.
  const server = await createServer({ root: gameRoot, server: { middlewareMode: true }, appType: "custom", ssr: { noExternal: ["effect"] } });
  try { return await use(server.environments.ssr.runner); }
  finally { await server.close(); }
}
export async function manifestPath(input) {
  const absolute = resolve(input);
  if (!(await stat(absolute)).isDirectory()) return absolute;
  try { await stat(resolve(absolute, "mod.ts")); return resolve(absolute, "mod.ts"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return resolve(absolute, "mod.json");
}
const mimeTypes = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".glb": "model/gltf-binary" };
export async function inside(directory, path) {
  const root = await realpath(directory);
  const full = await realpath(resolve(directory, path));
  const part = relative(root, full);
  if (part === ".." || part.startsWith("../") || isAbsolute(part)) throw new Error(`path escapes mod directory: ${path}`);
  return full;
}
export async function loadManifest(input, runner) {
  const path = await manifestPath(input);
  if ((await stat(path)).size > MAX_MANIFEST_BYTES) throw new Error("manifest exceeds 3 MB");
  // mod.ts is trusted LOCAL author code. Shared bundles contain JSON only.
  const manifest = extname(path) === ".ts"
    ? structuredClone((await runner.import(path)).default)
    : JSON.parse(await readFile(path, "utf8"));
  if (!manifest || typeof manifest !== "object") throw new Error("expected a manifest object (default export in mod.ts)");
  let assetBytes = 0;
  for (const assets of [manifest.assets, manifest.skin?.assets]) {
    for (const [id, value] of Object.entries(assets ?? {})) {
      if (typeof value !== "string") throw new Error(`assets.${id}: expected a path or data URL`);
      if (value.startsWith("data:")) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) throw new Error(`assets.${id}: remote assets are unsupported`);
      const assetPath = await inside(dirname(path), value);
      const mime = mimeTypes[extname(assetPath).toLowerCase()];
      if (!mime) throw new Error(`assets.${id}: unsupported asset type`);
      assetBytes += (await stat(assetPath)).size;
      if (assetBytes > 2 * 1024 * 1024) throw new Error("bundled assets exceed 2 MB per mod");
      assets[id] = `data:${mime};base64,${(await readFile(assetPath)).toString("base64")}`;
    }
  }
  if (Buffer.byteLength(JSON.stringify(manifest)) > MAX_MANIFEST_BYTES) throw new Error("manifest exceeds 3 MB after bundling");
  return { manifest, path };
}
