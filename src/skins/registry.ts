// The skin registry: finds every skins/<id>/skin.json, validates it, and loads only the active skin's slots, CSS and
// fonts (Vite splits each into its own chunk). Adding a skin is adding a folder: nothing here lists them.
import { BASE_ID, BASE_STRINGS, BASE_TOKENS, modSkinErrors, tokenVar, validateManifest, type SkinManifest } from "./schema";
import { baseSlots } from "./base/slots";
import { SLOT_NAMES, type LoadedSkin, type SkinSlots, type SlotComponents } from "./types";
import type { SkinInfoVM } from "../ui/hud/types";
import type { SkinData } from "../mods/schema";

export { BASE_ID };
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

/** The base as a pick of its own: the warm, chunky toy look the game started with. */
export const CLASSIC: SkinInfoVM = {
  id: BASE_ID,
  name: "Classic",
  author: "Frontier Lab Tycoon",
  description: "The warm, chunky toy look the lab started with. No windows, no Start menu jokes, just the diorama.",
  version: "1.0.0",
  preview: previewUrls["/src/skins/base/assets/preview.jpg"] ?? "",
};

/** Can the player pick this skin in the Display picker? The base (Classic) always; a skin when it is valid and not `unlisted`. */
export const isListed = (id: string, entries: readonly CatalogEntry[] = catalog) => id === BASE_ID || entries.some((e) => e.folder === id && e.ok && !e.manifest?.unlisted);

/** The mod that brought a skin (FLT-55): who to credit in the picker and the offer. */
export interface SkinOwner {
  id: string;
  name: string;
  version: string;
}
/** A skin from a mod (`?mod=`): checked by the mod loader, its assets already `blob:` URLs. It lives for the page. */
export interface ModSkin {
  id: string;
  data: SkinData;
  mod: SkinOwner;
}
const modSkins = new Map<string, ModSkin>();
const modRefused: { id: string; errors: string[] }[] = [];

/**
 * Make the session's mod skins pickable (before `bootSkin`, so `?skin=<id>` finds them). A mod skin starts from a built-in
 * skin (`extends`, default the base) and adds its tokens, strings, fonts and scoped CSS; it cannot take a built-in id.
 * Returns the ones refused, with why.
 */
export function registerModSkins(skins: Readonly<Record<string, SkinData>>, owners: Readonly<Record<string, SkinOwner>>): { id: string; errors: string[] }[] {
  for (const id of modSkins.keys()) cache.delete(id);
  modSkins.clear();
  modRefused.length = 0;
  const builtIn = catalog.filter((e) => e.ok).map((e) => e.folder);
  for (const [id, data] of Object.entries(skins)) {
    const mod = owners[id];
    if (!mod) continue; // Not from a mod: the base game's own entry.
    const errors = modSkinErrors(id, data.extends, catalog.map((e) => e.folder), builtIn);
    if (errors.length > 0) modRefused.push({ id: `${mod.id}/${id}`, errors });
    else modSkins.set(id, { id, data, mod });
  }
  return [...modRefused];
}
export const modSkin = (id: string): ModSkin | undefined => modSkins.get(id);

/** The skins the player can pick, for the Display picker: the listed built-ins (Frontier 95), Classic, then the mods'. `?skin=<id>` still reaches the unlisted ones. */
export function skinList(entries: readonly CatalogEntry[] = catalog): SkinInfoVM[] {
  const own = entries
    .filter((e) => e.ok && e.manifest)
    .map((e) => ({ id: e.folder, name: e.manifest!.name, author: e.manifest!.author, description: e.manifest!.description, version: e.manifest!.version, preview: previewOf(e.folder, e.manifest!) }));
  const listed = own.filter((s) => entries.some((e) => e.folder === s.id && !e.manifest?.unlisted));
  // A mod skin shows its parent's thumbnail when it has none, even when the parent is unlisted.
  const parentPreview = (id: string) => (id === BASE_ID ? CLASSIC.preview : (own.find((s) => s.id === id)?.preview ?? ""));
  const mods = [...modSkins.values()].map(({ id, data, mod }) => ({
    id, name: data.name, author: data.author ?? mod.name, description: data.description ?? `From the mod "${mod.name}".`, version: mod.version,
    preview: data.preview ?? parentPreview(data.extends ?? BASE_ID), mod: mod.name,
  }));
  return [...listed, CLASSIC, ...mods];
}

/** Skins that were found but refused, with why. */
export const refusedSkins = (entries: readonly CatalogEntry[] = catalog) => [...entries.filter((e) => !e.ok).map((e) => ({ id: e.folder, errors: e.errors })), ...modRefused];

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
const MOTION = ["fast", "base", "slow", "pulse"];

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
  const fromMod = modSkins.get(id);
  if (!entry && fromMod) return loadModSkin(fromMod);
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

/**
 * A mod skin on top of its parent: the parent's slots, strings, fonts and CSS (re-scoped from `[data-skin="<parent>"]`
 * to the mod skin's id, so the parent's rules still apply), then the mod's tokens, strings, fonts and CSS. The mod's
 * CSS was already scoped and limited to its own assets by the loader; its strings are only ever rendered as text.
 */
/** A built-in skin's rules, moved to a mod skin that extends it. The build's minifier drops the quotes (`[data-skin=frontier-95]`). */
export function rescopeCss(css: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.replace(new RegExp(`\\[data-skin=(["']?)${escaped}\\1\\]`, "g"), `[data-skin="${to}"]`);
}

async function loadModSkin({ id, data }: ModSkin): Promise<Prepared> {
  const parentId = data.extends ?? BASE_ID;
  const parent = await prepareSkin(parentId);
  const rescope = (css: string) => (parentId === BASE_ID ? css : rescopeCss(css, parentId, id));
  const parentTokens = catalog.find((e) => e.folder === parentId)?.manifest?.tokens ?? {};
  const tokens = Object.entries(data.tokens ?? {});
  const named = Object.fromEntries(tokens.filter(([k]) => !k.startsWith("--")));
  const raw = tokens.filter(([k]) => k.startsWith("--")).map(([k, v]) => `${k}:${v};`).join("");
  const fonts = (data.fonts ?? []).flatMap((f) => (typeof f === "string" ? [] : [f]));
  // The browser sniffs the format from the bytes (a `blob:` URL has no extension to go by).
  const fontCss = fonts.map((f) => `@font-face{font-family:"${f.family}";src:url("${f.src}");font-weight:${f.weight ?? 400};font-style:${f.style ?? "normal"};font-display:swap;}`).join("");
  return {
    skin: { id, name: data.name, slots: parent.skin.slots, strings: { ...parent.skin.strings, ...data.strings } },
    tokenCss: tokenSheet(id, { ...parentTokens, ...named }) + (raw ? `:root[data-skin="${id}"]{${raw}}` : ""),
    css: `${rescope(parent.css)}\n${data.css ?? ""}`,
    fontCss: parent.fontCss + fontCss,
    families: [...new Set([...parent.families, ...fonts.map((f) => f.family)])],
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

/** The one-off notice for a player whose saved skin was hidden (FLT-71). */
export const MIGRATED_NOTICE = "Frontier 95 is back as your desktop.";

export interface BootChoice {
  /** The skin to show on this visit. */
  id: string;
  /** Write this as the saved pick (an old pick of a hidden skin becomes the default, once), or leave storage alone. */
  save?: string;
  /** Tell the player their desktop changed. */
  notice: boolean;
}

/**
 * Which skin to start with: `?skin=`, then the saved pick, then the default. `?skin=` lasts for the visit and is never
 * saved here. A saved pick of a skin that is now `unlisted` is moved to the default, with a notice when that is what shows.
 */
export function bootChoice(search: string, stored: string | null, entries: readonly CatalogEntry[] = catalog): BootChoice {
  const q = new URLSearchParams(search).get("skin");
  if (stored && entries.some((e) => e.folder === stored && e.manifest?.unlisted)) {
    const id = q || DEFAULT_SKIN;
    return { id, save: DEFAULT_SKIN, notice: id === DEFAULT_SKIN };
  }
  return { id: q || stored || DEFAULT_SKIN, notice: false };
}

/** What the picker's OK saves: the skin showing, if the player could have picked it there. A `?skin=` visit to a hidden skin never sticks. */
export const pickToSave = (active: string, entries: readonly CatalogEntry[] = catalog): string | null => (isListed(active, entries) ? active : null);
