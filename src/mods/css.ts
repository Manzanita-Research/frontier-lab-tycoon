import { ModError } from "./schema";

/** Conservative shared-skin CSS subset. Reject ambiguous syntax rather than letting the browser recover it.
 * No nesting, escapes, comments, at-rules (except stripped @import), or network-bearing image functions.
 * Built-in skins are trusted separately and can use richer CSS. */
export function sanitizeCss(css: string, skinId: string, assets: Readonly<Record<string, string>>): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skinId)) throw new ModError({ path: "skin.id", detail: "expected a kebab-case skin id" });
  if (/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(css)) throw new ModError({ path: "skin.css", detail: "CSS escapes and control characters are not supported" });
  let clean = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import\s+(?:[^;{}]*);/gi, "");
  if (/@|image-set\s*\(|expression\s*\(|-moz-binding|behavior\s*:/i.test(clean)) throw new ModError({ path: "skin.css", detail: "at-rules and executable/network image functions are not supported" });
  // Every URL must name a bundled asset. Remote, data and pre-existing blob URLs from CSS are forbidden.
  clean = clean.replace(/url\s*\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^()\s"']+))\s*\)/gi, (_, a: string | undefined, b: string | undefined, c: string | undefined) => {
    const id = a ?? b ?? c ?? "";
    const url = Object.hasOwn(assets, id) ? assets[id] : undefined;
    if (!url) throw new ModError({ path: "skin.css", detail: `url() references unbundled asset "${id}"` });
    return `__FLT_ASSET_${encodeURIComponent(id)}__`;
  });
  if (/url\s*\(/i.test(clean)) throw new ModError({ path: "skin.css", detail: "malformed url()" });
  const scope = `[data-skin="${skinId}"]`;
  const output: string[] = [];
  while (clean.trim()) {
    const match = /^\s*([^{}]+)\{([^{}]*)\}/.exec(clean);
    if (!match) throw new ModError({ path: "skin.css", detail: "expected a flat CSS rule; nesting is not supported" });
    const selectors = (match[1] ?? "").split(",").map((selector) => {
      const s = selector.trim();
      // Limited selectors make scoping unambiguous; :root and existing [data-skin] rules cannot escape it.
      if (!/^[\w\s.#:[\]="'()-]+$/.test(s) || /:has\(|:is\(|:where\(|:not\(/i.test(s)) throw new ModError({ path: "skin.css", detail: `unsupported selector "${s}"` });
      return s === ":root" || s === "html" || s === "body" ? scope : `${scope} ${s}`;
    });
    output.push(`${selectors.join(", ")} {${match[2] ?? ""}}`);
    clean = clean.slice(match[0].length);
  }
  return output.join("\n").replace(/__FLT_ASSET_([^\s]+?)__/g, (_, key: string) => `url("${assets[decodeURIComponent(key)]}")`);
}
