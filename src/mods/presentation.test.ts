// FLT-55: the presentation boundary. Each security rule (remote files, blob-only assets, the size cap, scoped CSS,
// strings as text) and each looks rule gets a test, and the base game's presentation stays empty of mod looks.
import { Effect, Exit, Scope } from "effect";
import { validateAssets } from "./assets";
import { composeMods } from "./loader";
import { materialise, resolvePresentation, type ObjectUrls } from "./presentation";
import { decodeManifest, type ModManifest } from "./schema";
import { Looks } from "./services/looks";
import { Skin } from "./services/skin";

const png = "data:image/png;base64,aGVsbG8=";
const font = "data:font/woff2;base64,aGVsbG8=";
const glb = "data:model/gltf-binary;base64,aGVsbG8=";
const base: ModManifest = { apiVersion: 1, id: "test", name: "Test", version: "1" };
const decode = (input: unknown) => Effect.runPromise(decodeManifest(input));
const looksOf = (mod: ModManifest) => Effect.runPromise(Looks.pipe(Effect.provide(composeMods([mod]).layer)));
const dog = { recipe: [{ shape: "box" as const, size: [0.3, 0.3, 0.5] as const, at: [0, 0.4, 0] as const, color: "coat" }], coats: ["#d9a441"] };

function fakeUrls() {
  const made: string[] = [];
  const revoked: string[] = [];
  const urls: ObjectUrls = { create: () => { const url = `blob:test/${made.length}`; made.push(url); return url; }, revoke: (url) => { revoked.push(url); } };
  return { urls, made, revoked };
}

describe("FLT-55 presentation boundary", () => {
  it("rejects remote files with a friendly error that says how to bundle them", () => {
    for (const url of ["https://cdn.invalid/dog.png", "http://cdn.invalid/dog.png", "//cdn.invalid/dog.png", "blob:https://game.invalid/1", "file:///dog.png", "javascript:alert(1)"]) {
      expect(() => validateAssets({ "dog.png": url })).toThrow(/assets\.dog\.png.*remote files can't be loaded.*flt-mod bundle/);
    }
  });

  it("caps bundled assets at 2 MB per mod, across all of them", () => {
    const half = `data:image/png;base64,${"AAAA".repeat(270_000)}`;
    expect(() => validateAssets({ a: half })).not.toThrow();
    expect(() => validateAssets({ a: half, b: half, c: half })).toThrow("2 MB");
  });

  it("serves assets only as blob: URLs, one per distinct asset, revoked when the scope closes", async () => {
    const mod = await decode({ ...base, assets: { "dog.png": png, "bark.woff2": font }, skin: { id: "good-boy", name: "Good Boy", css: ".card { background: url(dog.png) }", fonts: [{ family: "Bark Sans", src: "bark.woff2" }], preview: "dog.png" }, looks: { protester: { sprite: "dog.png" } } });
    const presentation = await Effect.runPromise(resolvePresentation(composeMods([mod]).layer));
    const { urls, made, revoked } = fakeUrls();
    const scope = Effect.runSync(Scope.make());
    const out = await Effect.runPromise(Scope.provide(materialise(presentation, urls), scope));
    expect(made).toHaveLength(2);
    const text = JSON.stringify(out.presentation);
    expect(text).not.toContain("data:");
    const skin = out.presentation.skins.skins["good-boy"]!;
    expect(skin.css).toContain('url("blob:test/');
    expect(skin.preview).toMatch(/^blob:test\//);
    expect(skin.fonts?.[0]).toMatchObject({ family: "Bark Sans", src: expect.stringMatching(/^blob:test\//) });
    expect(out.presentation.looks.protester?.src).toBe(skin.preview);
    expect(out.presentation.assets["dog.png"]).toBe(skin.preview);
    expect(revoked).toEqual([]);
    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(revoked.sort()).toEqual(made.sort());
  });

  it("scopes a mod skin's CSS under [data-skin] and strips @import", async () => {
    const mod = await decode({ ...base, skin: { id: "good-boy", name: "Good Boy", css: '@import "https://evil.invalid/x.css"; .hud-top { color: red }' } });
    const skin = await Effect.runPromise(Skin.pipe(Effect.provide(composeMods([mod]).layer)));
    const css = skin.skins["good-boy"]!.css ?? "";
    expect(css).not.toContain("@import");
    expect(css).toContain('[data-skin="good-boy"] .hud-top');
  });

  it("checks skin tokens by FLT-14 name, and fonts and previews against the mod's own assets of the right kind", async () => {
    const read = async (skin: object, assets: Record<string, string> = {}) => Effect.runPromise(Skin.pipe(Effect.provide(composeMods([await decode({ ...base, assets, skin: { id: "s", name: "S", ...skin } })]).layer)));
    await expect(read({ tokens: { "color.accent": "#d9a441", "x.fur": "#fff", "--ink": "#000" } })).resolves.toBeDefined();
    await expect(read({ tokens: { "color accent": "#fff" } })).rejects.toThrow("skin.tokens.color accent");
    await expect(read({ tokens: { "color.accent": "red} body{x:y" } })).rejects.toThrow("skin.tokens.color.accent");
    await expect(read({ tokens: { "color.accent": "expression(alert(1))" } })).rejects.toThrow("skin.tokens.color.accent");
    await expect(read({ tokens: { "color.accent": "</style><script>" } })).rejects.toThrow("skin.tokens.color.accent");
    await expect(read({ fonts: ["dog.png"] }, { "dog.png": png })).rejects.toThrow(/skin\.fonts\[0\].*not a font/);
    await expect(read({ preview: "bark.woff2" }, { "bark.woff2": font })).rejects.toThrow(/skin\.preview.*not an image/);
    await expect(read({ preview: "nope.png" }, { "dog.png": png })).rejects.toThrow(/skin\.preview.*"nope\.png" is not one of this mod's assets \(it has "dog\.png"\)/);
    await expect(read({ extends: "s" })).rejects.toThrow("skin.extends");
    await expect(decode({ ...base, skin: { id: "s", name: "S", fonts: [{ family: "Bark;} body{", src: "x" }] } })).rejects.toThrow();
  });

  it("keeps skin strings as data: a string is never parsed as markup", async () => {
    const mod = await decode({ ...base, skin: { id: "s", name: "S", strings: { "title": "<img src=x onerror=alert(1)>" } } });
    const skin = await Effect.runPromise(Skin.pipe(Effect.provide(composeMods([mod]).layer)));
    expect(skin.skins.s!.strings?.title).toBe("<img src=x onerror=alert(1)>");
  });

  it("resolves looks for walker kinds and roles, with one form each", async () => {
    const got = await looksOf(await decode({ ...base, assets: { "dog.png": png, "dog.glb": glb }, looks: { protester: { ...dog, signs: ["WOOF LIES"] }, "visitor:Journalist": { sprite: "dog.png" }, researcher: { glb: "dog.glb" }, agent: { tint: { body: "#d9a441" } } } }));
    expect(Object.keys(got.looks).sort()).toEqual(["agent", "protester", "researcher", "visitor:Journalist"]);
    expect(got.looks.protester).toMatchObject({ mod: "test", signs: ["WOOF LIES"] });
    expect(got.looks["visitor:Journalist"]?.src).toBe(png);
    expect(got.looks.researcher?.src).toBe(glb);
  });

  it.each([
    [{ protestor: dog }, /looks\.protestor.*unknown walker kind "protestor".*protester/],
    [{ "protester:Angry": dog }, /looks\.protester:Angry.*one role/],
    [{ "visitor:Plumber": dog }, /looks\.visitor:Plumber.*unknown visitor role/],
    [{ protester: {} }, /exactly one of/],
    [{ protester: { ...dog, tint: { body: "#fff" } } }, /exactly one of.*recipe, tint/],
    [{ protester: { ...dog, coats: ["gold"] } }, /looks\.protester\.coats\[0\]/],
    [{ protester: { recipe: dog.recipe } }, /recipe\[0\]\.color.*needs a "coats" list/],
    [{ protester: { tint: { body: "red" } } }, /looks\.protester\.tint\.body/],
    [{ visitor: { ...dog, signs: ["WOOF"] } }, /looks\.visitor\.signs.*only protesters/],
    [{ protester: { sprite: "dog.glb" } }, /looks\.protester\.sprite.*not an image/],
    [{ protester: { glb: "dog.png" } }, /looks\.protester\.glb.*not a \.glb/],
    [{ protester: { sprite: "cat.png" } }, /looks\.protester\.sprite.*"cat\.png" is not one of this mod's assets/],
  ])("rejects a bad look: %j", async (looks, message) => {
    await expect(looksOf(await decode({ ...base, assets: { "dog.png": png, "dog.glb": glb }, looks }))).rejects.toThrow(message);
  });

  it("rejects out-of-range looks in the schema: parts, signs, shapes", async () => {
    await expect(decode({ ...base, looks: { protester: { ...dog, signs: ["x".repeat(41)] } } })).rejects.toThrow();
    await expect(decode({ ...base, looks: { protester: { ...dog, recipe: Array(17).fill(dog.recipe[0]) } } })).rejects.toThrow();
    await expect(decode({ ...base, looks: { protester: { ...dog, recipe: [{ ...dog.recipe[0], shape: "teapot" }] } } })).rejects.toThrow();
    await expect(decode({ ...base, looks: { protester: { ...dog, recipe: [{ ...dog.recipe[0], size: [0, 1, 1] }] } } })).rejects.toThrow();
  });

  it("names audio cues like protest.chant and ui.click, and nothing that isn't a name", async () => {
    const note = { at: 0, hz: 440, gain: 0.2, duration: 0.1, wave: "square" };
    await expect(decode({ ...base, audio: { cues: { "protest.grow": [note], "ui.click": [note], bark: [note] } } })).resolves.toBeDefined();
    for (const name of ["Protest.grow", "protest..grow", "a b", "__proto__", ""]) await expect(decode({ ...base, audio: { cues: { [name]: [note] } } })).rejects.toThrow();
  });

  it("gives the base game no looks and the base cues plus the hooks", async () => {
    const presentation = await Effect.runPromise(resolvePresentation(composeMods([]).layer));
    expect(presentation.looks).toEqual({});
    expect(Object.keys(presentation.audio.cues)).toEqual(expect.arrayContaining(["place", "protest.chant", "protest.grow", "ui.click"]));
  });

  it("marks a look two mods both set as a clash", () => {
    const other = { ...base, id: "other" };
    expect(composeMods([{ ...base, looks: { protester: dog } } as ModManifest, { ...other, looks: { protester: dog } } as ModManifest]).conflicts).toMatchObject([{ path: "looks.protester", earlier: "test", later: "other" }]);
  });
});
