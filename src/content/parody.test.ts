// The app's tsconfig has no Node types, so node:fs comes in untyped (as in the collusion test) and paths are joined by hand.
type Fs = { readdirSync(p: string, o?: { recursive: boolean }): string[]; readFileSync(p: string, enc: "utf8"): string };
const { readdirSync, readFileSync } = (await import(/* @vite-ignore */ ("node:fs" as string))) as Fs;
const join = (...parts: string[]) => parts.join("/").replace(/\/+/g, "/");

// Parody names only (AGENTS.md). Every content string, skin string and window title the game can show: the content
// tables, the 2D UI and all six skins (code, JSON and CSS), and every base pack under mods/. The defection test keeps
// its narrower check on its own two packs; this one covers the rest, so a real product name fails wherever it lands.
const REAL = [
  "Copilot", "Internet Explorer", "Notepad", "WordPad", "LinkedIn", "Excel", "PowerPoint", "Outlook", "Slack", "Twitter",
  "Windows 95", "Windows 98", "Clippy", "Microsoft", "OpenAI", "Anthropic", "DeepMind", "Google", "Gmail", "ChatGPT",
];
// Our parodies that contain (or sit next to) a real name. They are removed before the scan.
const ALLOWED = ["Outlook Excess", "WordSad", "WordPerfectly", "NoteBad"];

const root = new URL("../..", import.meta.url).pathname;
const SOURCES = /\.(ts|tsx|json|css)$/;

function files(dir: string, keep: RegExp): string[] {
  return readdirSync(join(root, dir), { recursive: true })
    .filter((f) => keep.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(dir, f));
}

const packs = readdirSync(join(root, "mods")).filter((d) => d.startsWith("base-"));
const scanned = [
  ...files("src/content", SOURCES),
  ...files("src/ui", SOURCES),
  ...files("src/skins", SOURCES),
  ...packs.flatMap((p) => files(join("mods", p), /\.json$/)),
];

/** Every real name in `text`, once the allowed parodies are taken out. */
function realNames(text: string): string[] {
  const clean = ALLOWED.reduce((t, ok) => t.split(ok).join(""), text);
  return REAL.filter((name) => new RegExp(`\\b${name.replace(" ", "\\s+")}\\b`).test(clean));
}

describe("parody names only", () => {
  it("knows a real name from our parodies", () => {
    expect(realNames('title: "RUN.TXT - Notepad", "Internet Explorer 3.0", "Macrohard Copilot for Copilot"')).toEqual(["Copilot", "Internet Explorer", "Notepad"]);
    expect(realNames("Outlook Excess, WordSad, WordPerfectly, NoteBad, Internet Exploder 3.0, LinkedOut, Excellent, the outlook")).toEqual([]);
  });
  it("reads the content, the UI, all six skins and every base pack", () => {
    for (const skin of ["base", "frontier-95", "homepage-98", "discovery-disc-96", "field-almanac", "karaoke-night", "swag-drop"]) {
      expect(scanned.some((f) => f.startsWith(join("src/skins", skin))), skin).toBe(true);
    }
    expect(packs.length).toBeGreaterThanOrEqual(10);
    for (const p of packs) expect(scanned).toContain(join("mods", p, "mod.json"));
  });
  it("names no real product, app, site or lab anywhere the player can read", () => {
    const found = scanned.flatMap((f) => realNames(readFileSync(join(root, f), "utf8")).map((name) => `${f}: ${name}`));
    expect(found).toEqual([]);
  });
});
