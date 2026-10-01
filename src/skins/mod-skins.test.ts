// FLT-55: a mod's skin in the registry. It starts from a built-in skin, is re-scoped to its own id, and cannot take a
// built-in id or extend a skin that does not exist.
import { prepareSkin, registerModSkins, rescopeCss, skinList } from "./registry";
import type { SkinData } from "../mods/schema";

const owner = { id: "golden-retriever-protest", name: "Golden Retriever Protest", version: "1.0.0" };
const goodBoy: SkinData = {
  id: "good-boy-95", name: "Good Boy 95", extends: "frontier-95", description: "Every window is a good window.",
  tokens: { "color.titlebar": "#b86b1f", "--wag": "12deg" }, strings: { "stats.cash": "Treats" },
  fonts: [{ family: "Bark Sans", src: "blob:test/1", weight: 700 }], css: '[data-skin="good-boy-95"] .f95-title { letter-spacing: 1px }',
};

describe("mod skins (FLT-55)", () => {
  afterEach(() => registerModSkins({}, {}));

  it("lists a mod's skin in the picker, credited to the mod, and loads it by id on top of its parent", async () => {
    expect(registerModSkins({ "good-boy-95": goodBoy, "base-game": { id: "base-game", name: "Base game" } }, { "good-boy-95": owner })).toEqual([]);
    const listed = skinList().find((s) => s.id === "good-boy-95");
    expect(listed).toMatchObject({ name: "Good Boy 95", author: "Golden Retriever Protest", mod: "Golden Retriever Protest", version: "1.0.0", description: "Every window is a good window." });
    expect(skinList().some((s) => s.id === "base-game")).toBe(false);
    // FLT-71: the five unlisted skins stay out, but a mod's skin is always pickable, after Frontier 95 and Classic.
    expect(skinList().map((s) => s.id)).toEqual(["frontier-95", "base", "good-boy-95"]);

    const parent = await prepareSkin("frontier-95");
    const p = await prepareSkin("good-boy-95");
    expect(p.skin.id).toBe("good-boy-95");
    expect(p.skin.slots).toBe(parent.skin.slots);
    expect(p.skin.strings["stats.cash"]).toBe("Treats");
    expect(p.skin.strings["stats.runway"]).toBe(parent.skin.strings["stats.runway"]);
    // The parent's rules now answer to the mod skin's id, and nothing is left scoped to the parent.
    expect(p.css).not.toContain('[data-skin="frontier-95"]');
    expect(p.css).toContain('[data-skin="good-boy-95"] .f95-title');
    expect(p.css.length).toBeGreaterThan(parent.css.length);
    expect(p.tokenCss).toContain(':root[data-skin="good-boy-95"]{');
    expect(p.tokenCss).toContain("--flt-color-titlebar:#b86b1f;");
    expect(p.tokenCss).toContain("--wag:12deg;");
    expect(p.fontCss).toContain('@font-face{font-family:"Bark Sans";src:url("blob:test/1");font-weight:700;');
    expect(p.families).toEqual(expect.arrayContaining([...parent.families, "Bark Sans"]));
  });

  it("re-scopes the parent's rules however the build wrote the selector (the minifier drops the quotes)", () => {
    const css = `[data-skin="frontier-95"] .a{} [data-skin=frontier-95] .b{} [data-skin='frontier-95'] .c{} [data-skin=frontier-955] .d{}`;
    expect(rescopeCss(css, "frontier-95", "good-boy-95")).toBe(`[data-skin="good-boy-95"] .a{} [data-skin="good-boy-95"] .b{} [data-skin="good-boy-95"] .c{} [data-skin=frontier-955] .d{}`);
  });

  it("starts from the base when it extends nothing", async () => {
    registerModSkins({ plain: { id: "plain", name: "Plain", tokens: { "color.accent": "#d9a441" } } }, { plain: owner });
    const p = await prepareSkin("plain");
    expect(p.skin.slots).toBe((await prepareSkin("base")).skin.slots);
    expect(p.tokenCss).toContain("--flt-color-accent:#d9a441;");
  });

  it("refuses a built-in id and a parent that does not exist, and keeps the built-in skin", async () => {
    const refused = registerModSkins({ "frontier-95": { id: "frontier-95", name: "Impostor" }, pup: { id: "pup", name: "Pup", extends: "frontier-96" } }, { "frontier-95": owner, pup: owner });
    expect(refused).toEqual([
      { id: "golden-retriever-protest/frontier-95", errors: [expect.stringContaining("built-in skin's id")] },
      { id: "golden-retriever-protest/pup", errors: [expect.stringContaining('no built-in skin "frontier-96"')] },
    ]);
    expect((await prepareSkin("frontier-95")).skin.name).toBe("Frontier 95");
    await expect(prepareSkin("pup")).rejects.toThrow("pup");
  });
});
