import { Effect } from "effect";
import { sanitizeCss } from "./css";
import { validateAssets } from "./assets";
import { fetchMod, loadModLinks, MAX_MANIFEST_BYTES, parseModLinks } from "./links";
import { composeMods } from "./loader";
import { decodeManifest, type ModManifest } from "./schema";
import { Skin } from "./services/skin";
import { Assets } from "./services/assets";
import { Audio } from "./services/audio";

const image = "data:image/png;base64,aGVsbG8=";
const assets = { "sign.png": image };
const manifest: ModManifest = { apiVersion: 1, id: "test", name: "Test", version: "1" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe("shared mod boundaries", () => {
  it("scopes selectors, strips imports and rewrites only owned asset urls", () => {
    const result = sanitizeCss('@import "https://evil.invalid/font.css"; :root { --ink: red } .card, button:hover { background: url("sign.png"); }', "test", assets);
    expect(result).not.toContain("@import");
    expect(result).not.toContain("evil.invalid");
    expect(result).toContain('[data-skin="test"] { --ink: red }');
    expect(result).toContain('[data-skin="test"] .card, [data-skin="test"] button:hover');
    expect(result).toContain(`url("${image}")`);
    expect(sanitizeCss('.card { color: red }', "test", {})).not.toContain("url");
  });
  it.each([
    '.card { background: url(https://evil.invalid/pixel); }',
    '.card { background: url(data:image/png;base64,aGVsbG8=); }',
    '.card { background: url(blob:someone-elses); }',
    '.card { background: u\\72l(https://evil.invalid/pixel); }',
    '.card { background: image-set("https://evil.invalid/pixel" 1x); }',
    '.card { background: image("https://evil.invalid/pixel"); }',
    '.card { background: __FLT_ASSET_missing__ }',
    '@font-face { src: url(sign.png); }',
    '@media (width > 10px) { body { color: red } }',
    '.card { color:red; .evil { color: blue } }',
    '.card { background: url("sign.png); }',
    ':is(body, .card) { color: red }',
    '.card { background: url(missing.png); }',
  ])("rejects ambiguous or unsafe shared CSS: %s", (css) => {
    expect(() => sanitizeCss(css, "test", assets)).toThrow("skin.css");
  });
  it("caps bundled assets and rejects external URLs, SVG and path traversal", () => {
    expect(() => sanitizeCss(".card { background: url(pixel) }", "test", { pixel: "https://evil.invalid/pixel" })).toThrow("assets.pixel");
    expect(() => validateAssets(assets)).not.toThrow();
    expect(() => validateAssets({ "f.woff2": "data:font/woff2;base64,aGVsbG8=" })).not.toThrow();
    expect(() => validateAssets({ "m.glb": "data:model/gltf-binary;base64,aGVsbG8=" })).not.toThrow();
    for (const url of ["https://evil.invalid/pixel", "data:text/html;base64,aGVsbG8=", "data:image/svg+xml;base64,aGVsbG8=", "data:image/png;base64,abc"]) expect(() => validateAssets({ bad: url })).toThrow("assets.bad");
    expect(() => validateAssets({ "../sign.png": image })).toThrow("asset id");
    expect(() => validateAssets({ huge: `data:image/png;base64,${"AAAA".repeat(800_000)}` })).toThrow("2 MB");
  });
  it("registers skins without activating them unless requested; service overrides retain assets/audio", async () => {
    const input = { ...manifest, assets, skin: { id: "test-skin", name: "Test", css: ".card { background: url(sign.png); }", tokens: { "--ink": "red" } }, audio: { cues: { custom: [{ at: 0, hz: 440, gain: 0.2, duration: 0.1, wave: "sine" }] } } };
    const mod = await Effect.runPromise(decodeManifest(input));
    const { layer } = composeMods([mod]);
    const result = await Effect.runPromise(Effect.gen(function* () { return { skin: yield* Skin, assets: yield* Assets, audio: yield* Audio }; }).pipe(Effect.provide(layer)));
    expect(result.skin.active).toBe("base-game");
    expect(result.skin.skins["test-skin"]?.css).toContain(image);
    expect(result.assets.resolve("sign.png")).toBe(image);
    expect(result.audio.cues.custom).toHaveLength(1);
    expect(result.audio.cues.place).toBeDefined();
    const active = await Effect.runPromise(Skin.pipe(Effect.provide(composeMods([{ ...mod, skin: { ...mod.skin!, activate: true } }]).layer)));
    expect(active.active).toBe("test-skin");
    const second = { ...manifest, id: "second", skin: { id: "other", name: "Other", activate: true } };
    expect(composeMods([{ ...mod, skin: { ...mod.skin!, activate: true } }, second]).conflicts).toMatchObject([{ path: "skin.active", earlier: "test", later: "second" }]);
  });
  it("validates skin tokens, fonts, and same-mod asset ownership", async () => {
    const read = (mod: ModManifest) => Effect.runPromise(Skin.pipe(Effect.provide(composeMods([mod]).layer)));
    await expect(read({ ...manifest, skin: { id: "skin", name: "Skin", tokens: { "--ink": "red;} body{color:green" } } })).rejects.toThrow("skin.tokens.--ink");
    await expect(read({ ...manifest, skin: { id: "skin", name: "Skin", tokens: { "--image": "url(https://evil.invalid/pixel)" } } })).rejects.toThrow("skin.tokens.--image");
    await expect(read({ ...manifest, skin: { id: "skin", name: "Skin", fonts: ["missing"] } })).rejects.toThrow("skin.fonts");
    const a = { ...manifest, assets };
    const b = { ...manifest, id: "other", skin: { id: "other", name: "Other", css: ".card { background: url(sign.png) }" } };
    await expect(Effect.runPromise(Skin.pipe(Effect.provide(composeMods([a, b]).layer)))).rejects.toThrow("unbundled asset");
  });
  it("parses repeated mod params, relative URLs and gist shorthand in load order", () => {
    const links = parseModLinks("?seed=1&mod=/mods/one.json&mod=gist:abcdef123&mod=https%3A%2F%2Fexample.invalid%2Fmod.json", "https://game.invalid/");
    expect(links.map((link) => link.url)).toEqual(["https://game.invalid/mods/one.json", "https://api.github.com/gists/abcdef123", "https://example.invalid/mod.json"]);
    expect(parseModLinks("?seed=1")).toEqual([]);
    for (const search of ["?mod=", "?mod=gist:nope", "?mod=javascript:alert(1)", "?mod=https://user:pass@example.invalid/mod.json"]) expect(() => parseModLinks(search)).toThrow("mod[0]");
  });
  it("fetches and validates mods sequentially, including gist discovery", async () => {
    const requested: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input); requested.push(url);
      if (url.includes("api.github.com")) return json({ files: { "readme.txt": { raw_url: "https://ignored.invalid" }, "mod.json": { raw_url: "https://gist.githubusercontent.com/steve/abcdef/raw/mod.json" } } });
      return json({ ...manifest, id: url.includes("gist.githubusercontent") ? "gist-mod" : "first" });
    };
    const mods = await Effect.runPromise(loadModLinks("?mod=/one.json&mod=gist:abcdef", { baseUrl: "https://game.invalid/", fetcher }));
    expect(mods.map((mod) => mod.id)).toEqual(["first", "gist-mod"]);
    expect(requested).toEqual(["https://game.invalid/one.json", "https://api.github.com/gists/abcdef", "https://gist.githubusercontent.com/steve/abcdef/raw/mod.json"]);
  });
  it("reports HTTP, JSON, schema, oversized response and ambiguous gist failures", async () => {
    const link = parseModLinks("?mod=https://example.invalid/mod.json")[0]!;
    await expect(Effect.runPromise(fetchMod(link, async () => json({}, 404)))).rejects.toThrow("HTTP 404");
    await expect(Effect.runPromise(fetchMod(link, async () => new Response("oops")))).rejects.toThrow("SyntaxError");
    await expect(Effect.runPromise(fetchMod(link, async () => json({ ...manifest, apiVersion: 2 })))).rejects.toThrow("apiVersion");
    await expect(Effect.runPromise(fetchMod(link, async () => new Response("x", { headers: { "content-length": String(MAX_MANIFEST_BYTES + 1) } })))).rejects.toThrow("3 MB");
    await expect(Effect.runPromise(fetchMod(link, async () => new Response("x".repeat(MAX_MANIFEST_BYTES + 1))))).rejects.toThrow("3 MB");
    const gist = parseModLinks("?mod=gist:abcdef")[0]!;
    await expect(Effect.runPromise(fetchMod(gist, async () => json({ files: {} })))).rejects.toThrow("gist.files");
    await expect(Effect.runPromise(fetchMod(gist, async () => json({ files: { "mod.json": { raw_url: "https://evil.invalid/mod.json" } } })))).rejects.toThrow("raw gist URL");
  });
});
