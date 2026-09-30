import { describe, expect, it } from "vitest";
import { BASE_STRINGS, BASE_TOKENS, REQUIRED_TOKENS, fillString, tokenVar, validateManifest } from "./schema";
import { BASE_ID, DEFAULT_SKIN, catalog, initialSkinId, tokenSheet } from "./registry";
import { SLOT_NAMES } from "./types";
import { docs, read, sources } from "./files";

/** A minimal valid skin.json to break in one place at a time. */
function good(over: Record<string, unknown> = {}) {
  return {
    apiVersion: 1,
    id: "test-skin",
    name: "Test Skin",
    author: "Somebody",
    version: "1.0.0",
    description: "A skin for the tests.",
    preview: "assets/preview.png",
    slots: [],
    fonts: [],
    strings: {},
    tokens: Object.fromEntries(REQUIRED_TOKENS.map((k) => [k, BASE_TOKENS[k]!])),
    ...over,
  };
}

describe("skin.json validation", () => {
  it("accepts a minimal skin", () => {
    const v = validateManifest(good(), "test-skin");
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("accepts every shipped skin", () => {
    for (const e of catalog) {
      const json = JSON.parse(read(`${e.folder}/skin.json`)!);
      expect(validateManifest(json, e.folder).errors, e.folder).toEqual([]);
    }
  });

  it("refuses another apiVersion, readably", () => {
    const v = validateManifest(good({ apiVersion: 2 }));
    expect(v.ok).toBe(false);
    expect(v.errors.join("\n")).toMatch(/apiVersion/);
  });

  it("refuses unknown slots and lists the known ones", () => {
    const v = validateManifest(good({ slots: ["Stats", "Sidebar"] }));
    expect(v.ok).toBe(false);
    expect(v.errors.join("\n")).toContain('unknown slot "Sidebar"');
    expect(v.errors.join("\n")).toContain("Layout");
    expect(validateManifest(good({ slots: ["Stats", "Stats"] })).ok).toBe(false);
  });

  it("refuses a skin with a missing required token", () => {
    const tokens = Object.fromEntries(REQUIRED_TOKENS.filter((k) => k !== "color.panel").map((k) => [k, BASE_TOKENS[k]!]));
    const v = validateManifest(good({ tokens }));
    expect(v.ok).toBe(false);
    expect(v.errors).toContain('tokens: missing required token "color.panel"');
  });

  it("refuses token typos but allows x.* customs", () => {
    const base = good().tokens;
    expect(validateManifest(good({ tokens: { ...base, "colour.panel": "#fff" } })).errors.join()).toMatch(/unknown token "colour.panel"/);
    expect(validateManifest(good({ tokens: { ...base, "x.sparkle": "#fff" } })).ok).toBe(true);
  });

  it("refuses token values that could break out of a style rule", () => {
    const base = good().tokens;
    for (const bad of ["red; } body { display:none", "url(https://evil.example/x.png)", "</style><script>", "@import 'x'"]) {
      expect(validateManifest(good({ tokens: { ...base, "color.panel": bad } })).ok, bad).toBe(false);
    }
  });

  it("refuses unknown string keys, a folder mismatch, a bad id, a bad preview, a font without a licence", () => {
    expect(validateManifest(good({ strings: { "no.such.key": "x" } })).errors.join()).toMatch(/unknown key/);
    expect(validateManifest(good(), "other-folder").errors.join()).toMatch(/must match the folder/);
    expect(validateManifest(good({ id: "Bad Id" })).ok).toBe(false);
    expect(validateManifest(good({ preview: "../../etc/passwd" })).ok).toBe(false);
    const font = { family: "X", src: "assets/fonts/x.woff2", license: "All rights reserved", licenseFile: "assets/fonts/x.txt" };
    expect(validateManifest(good({ fonts: [font] })).errors.join()).toMatch(/licence/);
    expect(validateManifest(good({ fonts: [{ ...font, license: "OFL-1.1", src: "https://fonts.example/x.woff2" }] })).ok).toBe(false);
    expect(validateManifest(good({ fonts: [{ ...font, license: "OFL-1.1" }] })).ok).toBe(true);
  });

  it("gives up cleanly on garbage", () => {
    for (const junk of [null, 5, "skin", [], {}]) {
      const v = validateManifest(junk);
      expect(v.ok).toBe(false);
      expect(v.errors.length).toBeGreaterThan(0);
    }
  });
});

describe("the token and string contract", () => {
  it("only uses strings the base defines (every t(\"key\") in a skin exists)", () => {
    const used = new Set<string>();
    for (const [path, text] of sources()) if (path.endsWith(".tsx")) for (const [, key] of text.matchAll(/\bt\("([\w.]+)"/g)) used.add(key!);
    expect(used.size).toBeGreaterThan(40);
    for (const key of used) expect(BASE_STRINGS, `t("${key}") is not in base/strings.json`).toHaveProperty([key]);
    for (const key of ["speed.short.1", "speed.short.3", "speed.short.10", "hint.gateway", "hint.tap"]) expect(BASE_STRINGS).toHaveProperty([key]);
  });

  it("has every required token in the base set, and a reduced variant for every duration", () => {
    for (const k of REQUIRED_TOKENS) expect(BASE_TOKENS, k).toHaveProperty([k]);
    for (const m of ["fast", "base", "slow", "pulse"]) expect(BASE_TOKENS).toHaveProperty([`motion.reduced.${m}`]);
  });
  it("names CSS variables predictably", () => {
    expect(tokenVar("color.panel")).toBe("--flt-color-panel");
    expect(tokenVar("motion.reduced.fast")).toBe("--flt-motion-reduced-fast");
  });
  it("fills {placeholders} and leaves unknown ones alone", () => {
    expect(fillString("Properties of {name}", { name: "Ada" })).toBe("Properties of Ada");
    expect(fillString("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
  it("builds the token sheet: base first, the skin on top, reduced motion last", () => {
    const sheet = tokenSheet("test-skin", { "color.panel": "#123456" });
    expect(sheet.indexOf(":root{")).toBeLessThan(sheet.indexOf(':root[data-skin="test-skin"]{'));
    expect(sheet).toContain("--flt-color-panel:#123456;");
    expect(sheet).toContain("prefers-reduced-motion:reduce");
    expect(sheet).toContain('[data-motion="reduced"]');
    expect(sheet.lastIndexOf("--flt-motion-fast:var(--flt-motion-reduced-fast)")).toBeGreaterThan(sheet.indexOf('[data-skin="test-skin"]{'));
    expect(tokenSheet(BASE_ID, {})).not.toContain("data-skin=");
  });
  it("picks the starting skin from ?skin=, then storage, then the default", () => {
    expect(initialSkinId("?skin=geocities", "swag-drop")).toBe("geocities");
    expect(initialSkinId("", "swag-drop")).toBe("swag-drop");
    expect(initialSkinId("?debug=1", null)).toBe(DEFAULT_SKIN);
    expect(DEFAULT_SKIN).toBe("frontier-95");
  });
  it("keeps the slot list and the docs in step", () => {
    expect(docs.length).toBeGreaterThan(1000);
    for (const slot of SLOT_NAMES) expect(docs, `docs/SKINS.md should mention the ${slot} slot`).toContain(slot);
    for (const token of Object.keys(BASE_TOKENS)) expect(docs, `docs/SKINS.md should mention ${token}`).toContain(token);
    for (const key of Object.keys(BASE_STRINGS)) expect(docs, `docs/SKINS.md should list the string ${key}`).toContain(key);
  });
});
