// The skin folders as the tests see them: every source file as text, and every asset path that exists. Vite's glob
// stands in for `fs` (the repo's tests don't depend on Node's types).
export const texts = import.meta.glob<string>("./**/*.{css,ts,tsx,json,txt}", { query: "?raw", eager: true, import: "default" });
export const assets = import.meta.glob<string>("./*/assets/**/*", { query: "?url", eager: true, import: "default" });
export const docs = import.meta.glob<string>("/docs/SKINS.md", { query: "?raw", eager: true, import: "default" })["/docs/SKINS.md"] ?? "";

/** Text of a file inside src/skins, by path relative to it ("frontier-95/skin.css"). */
export const read = (path: string): string | undefined => texts[`./${path}`];
/** Does this asset exist? Path relative to src/skins ("frontier-95/assets/preview.png"). */
export const exists = (path: string): boolean => `./${path}` in assets || `./${path}` in texts;
/** Source files (not tests, not assets) as [path, text]. */
export const sources = (): [string, string][] => Object.entries(texts).filter(([p]) => /\.(tsx?|css)$/.test(p) && !/\.test\./.test(p) && !p.includes("/assets/"));
