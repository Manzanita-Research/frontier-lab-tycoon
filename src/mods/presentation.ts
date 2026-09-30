// What a mod set looks and sounds like (FLT-55): the Skin, Assets, Audio and Looks services, resolved from the same
// composed Layer as the GameDefinition. None of it reaches the sim: the goldens and replays only see the definition.
import { Effect, type Layer } from "effect";
import { Assets } from "./services/assets";
import { Audio, type AudioApi } from "./services/audio";
import { Looks, type ResolvedLook } from "./services/looks";
import { Skin, type SkinApi } from "./services/skin";

export interface Presentation {
  readonly skins: SkinApi;
  /** Every mod's bundled assets by id (later mods win a shared id). */
  readonly assets: Readonly<Record<string, string>>;
  readonly audio: AudioApi;
  readonly looks: Readonly<Record<string, ResolvedLook>>;
}

export function resolvePresentation<E, R>(layer: Layer.Layer<Skin | Assets | Audio | Looks, E, R>) {
  return Effect.gen(function* () {
    const skins = yield* Skin;
    const assets = yield* Assets;
    const audio = yield* Audio;
    const looks = yield* Looks;
    return structuredClone({ skins, assets: assets.urls, audio, looks: looks.looks }) satisfies Presentation;
  }).pipe(Effect.provide(layer));
}

/** The two browser calls the adapter needs; tests pass fakes. */
export interface ObjectUrls {
  readonly create: (blob: Blob) => string;
  readonly revoke: (url: string) => void;
}
export const browserObjectUrls: ObjectUrls = { create: (blob) => URL.createObjectURL(blob), revoke: (url) => URL.revokeObjectURL(url) };

/** A validated `data:<mime>;base64,<bytes>` URL as a Blob. No fetch: the bytes are already in the manifest. */
export function dataUrlBlob(url: string): Blob {
  const comma = url.indexOf(",");
  const mime = url.slice(5, url.indexOf(";"));
  const binary = atob(url.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const DATA_URL = /^data:[\w/+.-]+;base64,[A-Za-z0-9+/]*={0,2}$/;
const CSS_DATA_URL = /url\("(data:[\w/+.-]+;base64,[A-Za-z0-9+/]*={0,2})"\)/g;

/**
 * The browser adapter for the Assets service: every bundled data URL in the presentation becomes a `blob:` URL (one
 * per distinct asset), in the asset table, the looks, the skins' fonts and previews, and the sanitised CSS. The URLs
 * live as long as the Scope and are revoked when it closes. Nothing is fetched and nothing outside the mods' own
 * bundled bytes can be named: the CSS was already limited to the mod's assets by `sanitizeCss`.
 */
export const materialise = (presentation: Presentation, urls: ObjectUrls = browserObjectUrls) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const made = new Map<string, string>();
      const blobOf = (data: string) => {
        let url = made.get(data);
        if (!url) made.set(data, (url = urls.create(dataUrlBlob(data))));
        return url;
      };
      const walk = (value: unknown, key?: string): unknown => {
        if (typeof value === "string") {
          if (DATA_URL.test(value)) return blobOf(value);
          return key === "css" ? value.replace(CSS_DATA_URL, (_, data: string) => `url("${blobOf(data)}")`) : value;
        }
        if (Array.isArray(value)) return value.map((item) => walk(item));
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
        return value;
      };
      return { presentation: walk(presentation) as Presentation, urls: [...made.values()] };
    }),
    ({ urls: made }) => Effect.sync(() => made.forEach((url) => urls.revoke(url))),
  );

