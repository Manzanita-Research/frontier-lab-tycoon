// Frontier 95's mark is the sunrise over water (FLT-70). The four-pane Start flag it replaced was a real OS's logo in
// all but name, so this scans everything the player can be shown (code, styles, content, mods, the page itself) for
// the flag's component, its class, and the emoji and Unicode stand-ins for it. Git history keeps the old one.
const files = import.meta.glob<string>(["/src/**/*.{ts,tsx,css,json,html,svg}", "/mods/**/*.{json,css,svg}", "/index.html", "!**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const OLD_FLAG = [
  { what: "the flag's class", re: /\bf95-flag\b/ },
  { what: "the Flag icon component", re: /\b(?:function|const)\s+Flag\s*\(\s*\)|import\s*{[^}]*\bFlag\b[^}]*}\s*from\s*"[^"]*icons"/ },
  { what: "a window or four-pane stand-in glyph", re: /🪟|⊞|❖/u },
];

describe("the Frontier 95 mark (FLT-70)", () => {
  it("scans the whole UI, every skin, the intro and the mods", () => {
    const names = Object.keys(files);
    for (const f of ["/src/skins/frontier-95/taskbar.tsx", "/src/skins/frontier-95/skin.css", "/src/skins/frontier-95/icons.tsx", "/src/intro/art.ts", "/index.html"]) expect(names).toContain(f);
    expect(names.some((f) => f.startsWith("/mods/"))).toBe(true);
  });

  it("the old four-pane Start flag is gone everywhere", () => {
    expect(OLD_FLAG[0]!.re.test('<span className="f95-flag">')).toBe(true);
    expect(OLD_FLAG[1]!.re.test('import { Flag, Ico } from "./icons";')).toBe(true);
    // The 3D cloth flags on the buildings (render/fx/Flag.tsx) are not the logo.
    expect(OLD_FLAG[1]!.re.test('import { Flag } from "../fx/Flag";')).toBe(false);
    const found = Object.entries(files).flatMap(([f, text]) => OLD_FLAG.filter(({ re }) => re.test(text)).map(({ what }) => `${f}: ${what}`));
    expect(found).toEqual([]);
  });

  it("the Start button wears the sunrise", () => {
    expect(files["/src/skins/frontier-95/taskbar.tsx"]).toMatch(/data-testid="start-button"[^\n]*\n\s*<SunriseMark\b/);
  });
});
