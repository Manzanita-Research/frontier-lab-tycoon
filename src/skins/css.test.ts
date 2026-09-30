import { describe, expect, it } from "vitest";
import { catalog } from "./registry";
import { read } from "./files";

/**
 * A tiny reader for the shape skin.css is allowed to have: a top-level rule per selector list, every selector starting
 * with the skin's own scope, plus @keyframes named after the skin. (Nested rules inherit the scope from their parent.)
 */
export function topLevelRules(css: string): { head: string; body: string }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: { head: string; body: string }[] = [];
  let depth = 0;
  let head = "";
  let body = "";
  for (const ch of text) {
    if (ch === "{") {
      if (depth === 0) body = "";
      else body += ch;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        rules.push({ head: head.trim(), body });
        head = "";
      } else body += ch;
    } else if (depth === 0) head += ch;
    else body += ch;
  }
  return rules;
}

describe.each(catalog.filter((e) => e.ok))("skin.css of $folder", ({ folder }) => {
  const css = read(`${folder}/skin.css`) ?? "";
  const rules = topLevelRules(css);
  const scope = `[data-skin="${folder}"]`;

  it("has rules", () => expect(rules.length).toBeGreaterThan(0));

  it("scopes every top-level rule under its own [data-skin] and names its keyframes after itself", () => {
    for (const r of rules) {
      if (r.head.startsWith("@keyframes")) expect(r.head, r.head).toMatch(new RegExp(`^@keyframes ${folder}-`));
      else expect(r.head.split(",").map((s) => s.trim()), r.head).toSatisfy((list: string[]) => list.every((s) => s.startsWith(scope)));
    }
  });

  it("does not reach into another skin or load anything from outside", () => {
    expect(css).not.toMatch(/@import|@font-face|expression\(/);
    for (const other of catalog.map((e) => e.folder).filter((f) => f !== folder)) expect(css).not.toContain(`data-skin="${other}"`);
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
  });

  it("only reads --flt-* tokens it can rely on (its own, the base's, or its x.* customs) and its own local variables", () => {
    const manifest = catalog.find((e) => e.folder === folder)!.manifest!;
    const declared = new Set(Object.keys(manifest.tokens).map((k) => `--flt-${k.replace(/\./g, "-")}`));
    const base = read("base/tokens.json") ?? "{}";
    for (const k of Object.keys(JSON.parse(base))) declared.add(`--flt-${k.replace(/\./g, "-")}`);
    for (const [, name] of css.matchAll(/var\((--flt-[\w-]+)/g)) expect(declared.has(name!), `${folder} uses ${name}`).toBe(true);
  });
});

describe("the reader", () => {
  it("finds top-level rules through nesting", () => {
    const r = topLevelRules('/* c */ [data-skin="a"] { .x { color: red; &:hover { color: blue } } @media (max-width: 1px) { .y { top: 0 } } } @keyframes a-k { from { top: 0 } }');
    expect(r.map((x) => x.head)).toEqual(['[data-skin="a"]', "@keyframes a-k"]);
  });
});
