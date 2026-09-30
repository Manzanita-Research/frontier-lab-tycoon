// The skin registry: finds every skins/<id>/skin.json, validates it, and loads only the active skin's slots, CSS and
// fonts (Vite splits each into its own chunk). Adding a skin is adding a folder: nothing here lists them.
import { BASE_STRINGS, BASE_TOKENS, tokenVar, validateManifest, type SkinManifest } from "./schema";
import { baseSlots } from "./base/slots";
import { SLOT_NAMES, type LoadedSkin, type SkinSlots, type SlotComponents } from "./types";
import type { SkinInfoVM } from "../ui/hud/types";

/** The skin that is just the base: no skin.json, no custom slots. Used only when the default itself is refused. */
export const BASE_ID = "base";
export const DEFAULT_SKIN = "frontier-95";
export const STORAGE_KEY = "flt.skin";
export const MOTION_KEY = "flt.motion";

const manifests = import.meta.glob<unknown>("/src/skins/*/skin.json", { eager: true, import: "default" });
const cssLoaders = import.meta.glob<string>("/src/skins/*/skin.css", { query: "?inline", import: "default" });
const slotLoaders = import.meta.glob<{ default: SkinSlots }>("/src/skins/*/slots.tsx");
const fontLoaders = import.meta.glob<string>("/src/skins/*/assets/**/*.{woff2,woff,ttf,otf}", { query: "?url", import: "default" });
const previewUrls = import.meta.glob<string>("/src/skins/*/assets/preview.*", { query: "?url", import: "default", eager: true });

export interface CatalogEntry {
  /** The folder name. */
  folder: string;
  ok: boolean;
  errors: string[];
  manifest: SkinManifest | null;
}

const folderOf = (path: string) => path.split("/").at(-2)!;

function buildCatalog(input: Record<string, unknown>): CatalogEntry[] {
  return Object.entries(input)
    .map(([path, json]) => {
      const folder = folderOf(path);
      const v = validateManifest(json, folder);
      return { folder, ok: v.ok, errors: v.errors, manifest: v.manifest } satisfies CatalogEntry;
    })
    .sort((a, b) => (a.folder === DEFAULT_SKIN ? -1 : b.folder === DEFAULT_SKIN ? 1 : a.folder.localeCompare(b.folder)));
}

/** Every skin folder that has a skin.json, valid or not. */
export const catalog: readonly CatalogEntry[] = buildCatalog(manifests);

export const previewOf = (folder: string, manifest: SkinManifest) => previewUrls[`/src/skins/${folder}/${manifest.preview}`] ?? "";

/** The skins the player can pick, for the Display picker. */
export function skinList(entries: readonly CatalogEntry[] = catalog): SkinInfoVM[] {
  return entries
    .filter((e) => e.ok && e.manifest)
    .map((e) => ({ id: e.folder, name: e.manifest!.name, author: e.manifest!.author, description: e.manifest!.description, version: e.manifest!.version, preview: previewOf(e.folder, e.manifest!) }));
}

/** Skins that were found but refused, with why. */
export const refusedSkins = (entries: readonly CatalogEntry[] = catalog) => entries.filter((e) => !e.ok).map((e) => ({ id: e.folder, errors: e.errors }));

/** A skin that cannot be loaded. `errors` are readable lines for the player or the modder. */
export class SkinRefused extends Error {
  constructor(
    readonly id: string,
    readonly errors: string[],
  ) {
    super(`Skin "${id}" was refused:\n  ${errors.join("\n  ")}`);
  }
}

export interface Prepared {
  skin: LoadedSkin;
  /** CSS custom properties: the base set, the skin's overrides, and the reduced-motion swap. */
  tokenCss: string;
  css: string;
  fontCss: string;
  families: string[];
}

const decl = (tokens: Readonly<Record<string, string>>) => Object.entries(tokens).map(([k, v]) => `${tokenVar(k)}:${v};`).join("");
const MOTION = ["fast", "base", "slow"];

/** The token stylesheet. Reduced motion (the OS setting, or `data-motion="reduced"`) swaps every duration for its reduced variant. */
export function tokenSheet(id: string, tokens: Readonly<Record<string, string>>): string {
  const reduced = MOTION.map((m) => `${tokenVar(`motion.${m}`)}:var(${tokenVar(`motion.reduced.${m}`)});`).join("");
  const scope = id === BASE_ID ? ":root" : `:root[data-skin="${id}"]`;
  return `:root{${decl(BASE_TOKENS)}}${id === BASE_ID ? "" : `${scope}{${decl(tokens)}}`}@media (prefers-reduced-motion:reduce){:root,${scope}{${reduced}}}:root[data-motion="reduced"],${scope}[data-motion="reduced"]{${reduced}}`;
}

const cache = new Map<string, Promise<Prepared>>();

function prepare(id: string): Promise<Prepared> {
  if (id === BASE_ID) return Promise.resolve({ skin: { id: BASE_ID, name: "Base", slots: baseSlots, strings: { ...BASE_STRINGS } }, tokenCss: tokenSheet(BASE_ID, {}), css: "", fontCss: "", families: [] });
  const entry = catalog.find((e) => e.folder === id);
  if (!entry) return Promise.reject(new SkinRefused(id, [`no skin folder "src/skins/${id}" with a skin.json`]));
  if (!entry.ok || !entry.manifest) return Promise.reject(new SkinRefused(id, entry.errors));
  return load(id, entry.manifest);
}

async function load(id: string, m: SkinManifest): Promise<Prepared> {
  const dir = `/src/skins/${id}`;
  const errors: string[] = [];
  let custom: SkinSlots = {};
  if (m.slots.length > 0) {
    const loader = slotLoaders[`${dir}/slots.tsx`];
    if (!loader) errors.push(`skin.json lists slots but ${dir}/slots.tsx does not exist`);
    else {
      const mod = await loader();
      custom = mod.default ?? {};
      const exported = Object.keys(custom);
      for (const name of exported) if (!(SLOT_NAMES as readonly string[]).includes(name)) errors.push(`slots.tsx exports unknown slot "${name}"`);
      for (const name of exported) if (!m.slots.includes(name)) errors.push(`slots.tsx exports "${name}" but skin.json does not list it in "slots"`);
      for (const name of m.slots) if (!(name in custom)) errors.push(`skin.json lists slot "${name}" but slots.tsx does not export it`);
    }
  }
  const cssLoader = cssLoaders[`${dir}/skin.css`];
  const css = cssLoader ? await cssLoader() : "";
  let fontCss = "";
  for (const f of m.fonts) {
    const url = await fontLoaders[`${dir}/${f.src}`]?.();
    if (!url) errors.push(`fonts: file not found: ${f.src}`);
    else fontCss += `@font-face{font-family:"${f.family}";src:url("${url}") format("${f.src.endsWith("woff2") ? "woff2" : f.src.endsWith("woff") ? "woff" : f.src.endsWith("otf") ? "opentype" : "truetype"}");font-weight:${f.weight ?? 400};font-style:${f.style ?? "normal"};font-display:swap;}`;
  }
  if (errors.length > 0) throw new SkinRefused(id, errors);
  const slots = { ...baseSlots, ...custom } as SlotComponents;
  return {
    skin: { id, name: m.name, slots, strings: { ...BASE_STRINGS, ...m.strings } },
    tokenCss: tokenSheet(id, m.tokens),
    css,
    fontCss,
    families: [...new Set(m.fonts.map((f) => f.family))],
  };
}

/** Load (once) everything a skin needs. Rejects with `SkinRefused` and a readable list of what is wrong. */
export function prepareSkin(id: string): Promise<Prepared> {
  let p = cache.get(id);
  if (!p) {
    p = prepare(id);
    cache.set(id, p);
    // A refusal is not cached: fixing the files and reloading (or HMR) should try again.
    p.catch(() => cache.delete(id));
  }
  return p;
}

function styleEl(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

/** Put a prepared skin on the page: tokens, fonts, its CSS and `data-skin`. Swapping is live; nothing reloads. */
export async function applyPrepared(p: Prepared): Promise<void> {
  styleEl("flt-skin-tokens").textContent = p.tokenCss;
  styleEl("flt-skin-fonts").textContent = p.fontCss;
  styleEl("flt-skin-css").textContent = p.css;
  document.documentElement.dataset.skin = p.skin.id;
  // Canvas text and the first paint should not flash a fallback face: wait for the fonts, but never for long.
  if (p.families.length > 0 && document.fonts) {
    await Promise.race([Promise.all(p.families.map((f) => document.fonts.load(`16px "${f}"`))), new Promise((done) => setTimeout(done, 1500))]).catch(() => undefined);
  }
}

/** Which skin to start with: `?skin=`, then localStorage, then the default. `base` is accepted for debugging. */
export function initialSkinId(search: string, stored: string | null): string {
  const q = new URLSearchParams(search).get("skin");
  return q || stored || DEFAULT_SKIN;
}
