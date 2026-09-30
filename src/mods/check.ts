import { Effect } from "effect";
import { decodeManifest, ModError, type ModManifest } from "./schema";
import { composeMods } from "./loader";
import { resolveGameDefinition } from "./game-definition";
import { runHeadless } from "./headless";
import { validateAssets } from "./assets";
import { resolvePresentation } from "./presentation";
import { CUES, HOOKS } from "../audio/score";
import { modSkinErrors, validateManifest } from "../skins/schema";

const skinJsons = import.meta.glob<unknown>("/src/skins/*/skin.json", { eager: true, import: "default" });

/** What `flt-mod check` says about a mod's skin, assets, cues and looks (FLT-55). The sim never sees any of it. */
export interface PresentationReport {
  readonly assets: { readonly count: number; readonly bytes: number };
  readonly skin: { readonly id: string; readonly name: string; readonly extends: string; readonly asks: boolean } | null;
  readonly cues: { readonly added: string[]; readonly replaced: string[]; readonly played: string[] };
  readonly looks: { readonly target: string; readonly form: string; readonly detail: string }[];
}

const bytesOf = (url: string) => {
  const data = url.slice(url.indexOf(",") + 1);
  return (data.length * 3) / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
};

/** Every `sound.cue` the mod's content plays, wherever it sits (arcs, events, disasters), with its path. */
function playedCues(value: unknown, path: string, out: { cue: string; path: string }[] = []) {
  if (Array.isArray(value)) value.forEach((v, i) => playedCues(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const params = record.params as Record<string, unknown> | undefined;
    if (record.type === "sound.cue" && typeof params?.cue === "string") out.push({ cue: params.cue, path: `${path}.params.cue` });
    for (const [key, v] of Object.entries(record)) playedCues(v, path ? `${path}.${key}` : key, out);
  }
  return out;
}

/**
 * The presentation half of a check: the 2 MB asset cap, remote files, the skin (scoped CSS, tokens, strings, fonts,
 * `extends`), every look's assets and recipe, and every cue the mod plays existing somewhere. Throws a ModError with
 * the path to fix.
 */
export async function checkPresentation(manifest: ModManifest): Promise<PresentationReport> {
  const assets = manifest.assets ?? {};
  validateAssets(assets);
  const presentation = await Effect.runPromise(resolvePresentation(composeMods([manifest]).layer));
  if (manifest.skin) {
    const folders = Object.keys(skinJsons).map((path) => path.split("/").at(-2)!);
    const usable = folders.filter((folder) => validateManifest(skinJsons[`/src/skins/${folder}/skin.json`], folder).ok);
    const [error] = modSkinErrors(manifest.skin.id, manifest.skin.extends, folders, usable);
    if (error) throw new ModError({ path: `skin.${error.split(":")[0]}`, detail: error.slice(error.indexOf(":") + 2) });
  }
  const own = Object.keys(manifest.audio?.cues ?? {});
  const known = new Set<string>([...CUES, ...HOOKS, "alarm", ...own]);
  for (const { cue, path } of playedCues(manifest.content ?? {}, "content")) {
    if (!known.has(cue)) throw new ModError({ path, detail: `no sound cue "${cue}": use a base cue (${["alarm", ...CUES, ...HOOKS].join(", ")}) or add it under audio.cues` });
  }
  const base = new Set<string>([...CUES, ...HOOKS]);
  return {
    assets: { count: Object.keys(assets).length, bytes: Math.round(Object.values(assets).reduce((sum, url) => sum + bytesOf(url), 0)) },
    skin: manifest.skin ? { id: manifest.skin.id, name: manifest.skin.name, extends: manifest.skin.extends ?? "base", asks: manifest.skin.activate === true } : null,
    cues: { added: own.filter((c) => !base.has(c)), replaced: own.filter((c) => base.has(c)), played: [...new Set(playedCues(manifest.content ?? {}, "content").map((p) => p.cue))] },
    looks: Object.entries(presentation.looks).map(([target, look]) => ({
      target,
      form: look.recipe ? "recipe" : look.sprite ? "sprite" : look.glb ? "glb" : "tint",
      detail: [
        look.recipe ? `${look.recipe.length} parts` : look.sprite ?? look.glb ?? Object.entries(look.tint ?? {}).map(([k, v]) => `${k} ${v}`).join(", "),
        look.signs ? `${look.signs.length} placards` : "",
        look.label ? `"${look.label}"` : "",
      ].filter(Boolean).join(", "),
    })),
  };
}

export async function checkMod(input: unknown) {
  const manifest = await Effect.runPromise(decodeManifest(input));
  const presentation = await checkPresentation(manifest);
  const { layer, conflicts } = composeMods([manifest]);
  const definition = await Effect.runPromise(resolveGameDefinition(layer));
  return { report: runHeadless(definition), replay: runHeadless(definition), conflicts, presentation, mod: { id: manifest.id, version: manifest.version } };
}
