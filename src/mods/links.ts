import { Effect } from "effect";
import { decodeManifest, ModError, type ModManifest } from "./schema";

export type ModLink = { readonly source: string; readonly url: string; readonly gist: boolean };
export function parseModLinks(search: string, baseUrl = "https://flt.invalid/"): readonly ModLink[] {
  return new URLSearchParams(search).getAll("mod").map((source, i) => {
    if (source.startsWith("gist:")) {
      const id = source.slice(5);
      if (!/^[a-f0-9]{5,64}$/i.test(id)) throw new ModError({ path: `mod[${i}]`, detail: "expected gist:<hex id>" });
      return { source, url: `https://api.github.com/gists/${id}`, gist: true };
    }
    if (!source.trim()) throw new ModError({ path: `mod[${i}]`, detail: "empty mod URL" });
    let url: URL;
    try { url = new URL(source, baseUrl); } catch { throw new ModError({ path: `mod[${i}]`, detail: "invalid URL" }); }
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new ModError({ path: `mod[${i}]`, detail: "expected an HTTP(S) URL without credentials" });
    return { source, url: url.href, gist: false };
  });
}
export const MAX_MANIFEST_BYTES = 3 * 1024 * 1024;
async function fetchJson(url: string, fetcher: typeof fetch, signal?: AbortSignal): Promise<unknown> {
  const response = await fetcher(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new ModError({ path: url, detail: `HTTP ${response.status}` });
  if (Number(response.headers.get("content-length")) > MAX_MANIFEST_BYTES) throw new ModError({ path: url, detail: "manifest exceeds 3 MB" });
  const reader = response.body?.getReader();
  if (!reader) throw new ModError({ path: url, detail: "empty response body" });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MANIFEST_BYTES) throw new ModError({ path: url, detail: "manifest exceeds 3 MB" });
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function gistRaw(value: unknown): string {
  if (typeof value !== "object" || value === null || !("files" in value) || typeof value.files !== "object" || value.files === null) throw new ModError({ path: "gist.files", detail: "missing files" });
  const files = Object.entries(value.files).filter(([name]) => name === "mod.json" || name.endsWith(".fltmod.json"));
  const preferred = files.find(([name]) => name === "mod.json");
  const file = preferred ?? (files.length === 1 ? files[0] : undefined);
  if (!file || typeof file[1] !== "object" || file[1] === null || !("raw_url" in file[1]) || typeof file[1].raw_url !== "string") throw new ModError({ path: "gist.files", detail: "expected mod.json or exactly one .fltmod.json file" });
  const url = new URL(file[1].raw_url);
  if (url.protocol !== "https:" || url.hostname !== "gist.githubusercontent.com" || url.username || url.password) throw new ModError({ path: "gist.files.raw_url", detail: "expected a raw gist URL" });
  return url.href;
}
export const fetchMod = Effect.fn("Mods.fetchMod")(function* (link: ModLink, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const input = yield* Effect.tryPromise({
    try: async () => {
      const value = await fetchJson(link.url, fetcher, signal);
      return link.gist ? fetchJson(gistRaw(value), fetcher, signal) : value;
    },
    catch: (error) => error instanceof ModError ? error : new ModError({ path: link.source, detail: String(error) }),
  });
  return yield* decodeManifest(input);
});
/** Sequential fetch preserves load order and keeps memory use bounded. The app opts into this in M1b. */
export const loadModLinks = Effect.fn("Mods.loadModLinks")(function* (search: string, options: { baseUrl?: string; fetcher?: typeof fetch; signal?: AbortSignal } = {}) {
  const links = yield* Effect.try({ try: () => parseModLinks(search, options.baseUrl), catch: (error) => error instanceof ModError ? error : new ModError({ path: "mod", detail: String(error) }) });
  const mods: ModManifest[] = [];
  for (const link of links) mods.push(yield* fetchMod(link, options.fetcher, options.signal));
  return mods;
});
