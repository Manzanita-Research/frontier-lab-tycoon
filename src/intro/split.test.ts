// FLT-70: the intro must not grow the game's entry chunk. Read the static import graph from the sources and check
// that the entry (main.tsx) reaches the intro only through a dynamic import, and that the intro's first paint doesn't
// drag in the game or three (the game comes in through `loadGame`, the 3D stage and the still are lazy).
import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true });

/** "../main.tsx" (relative to this file) → "/src/main.tsx". */
const norm = (key: string) => new URL(key, "file:///src/intro/").pathname;
const files = new Map(Object.entries(sources).map(([k, v]) => [norm(k), v]));

type Edges = { static: string[]; dynamic: string[]; bare: string[] };

function resolve(from: string, spec: string): string | null {
  const base = new URL(spec, `file://${from}`).pathname;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (files.has(base + ext)) return base + ext;
  return null;
}

function edges(file: string): Edges {
  const src = files.get(file) ?? "";
  const out: Edges = { static: [], dynamic: [], bare: [] };
  // Type-only imports are erased, so they don't count.
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\s)(?:[^;]*?\sfrom\s*)?["']([^"']+)["']/gm)) {
    const spec = m[1]!;
    if (!spec.startsWith(".")) out.bare.push(spec);
    else {
      const r = resolve(file, spec);
      if (r) out.static.push(r);
    }
  }
  for (const m of src.matchAll(/(?<!typeof\s)import\(\s*["']([^"']+)["']\s*\)/g)) {
    const r = m[1]!.startsWith(".") ? resolve(file, m[1]!) : null;
    if (r) out.dynamic.push(r);
  }
  return out;
}

/** Every file reachable from `entry` through static imports, and every package they import. */
function closure(entry: string): { files: Set<string>; bare: Set<string> } {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const e = edges(f);
    e.bare.forEach((b) => bare.add(b));
    todo.push(...e.static);
  }
  return { files: seen, bare };
}

describe("the intro is its own chunk (FLT-70)", () => {
  it("reads the graph", () => {
    expect(files.has("/src/main.tsx")).toBe(true);
    expect(files.has("/src/intro/boot.tsx")).toBe(true);
    expect(closure("/src/main.tsx").files.has("/src/introRoute.ts")).toBe(true);
  });

  it("main.tsx reaches the intro only through a dynamic import", () => {
    const entry = closure("/src/main.tsx");
    expect([...entry.files].filter((f) => f.startsWith("/src/intro/"))).toEqual([]);
    expect(edges("/src/main.tsx").dynamic).toContain("/src/intro/boot.tsx");
  });

  it("the game's own chunks (App, the skin control) never import the intro", () => {
    for (const root of ["/src/App.tsx", "/src/ui/hud/skinControl.ts"]) {
      const c = closure(root);
      expect([...c.files].filter((f) => f.startsWith("/src/intro/")), root).toEqual([]);
    }
  });

  it("the intro's first paint loads neither the game nor three", () => {
    const boot = closure("/src/intro/boot.tsx");
    const game = ["/src/App.tsx", "/src/app/game.ts", "/src/ui/hud/skinControl.ts", "/src/skins/registry.ts"];
    expect(game.filter((f) => boot.files.has(f))).toEqual([]);
    expect([...boot.files].filter((f) => f.startsWith("/src/intro/stage/"))).toEqual([]);
    expect([...boot.bare].filter((b) => b === "three" || b.startsWith("@react-three/") || b === "postprocessing")).toEqual([]);
    // ...and the stage and the still come in lazily.
    expect(edges("/src/intro/Intro.tsx").dynamic).toEqual(expect.arrayContaining(["/src/intro/stage/Stage.tsx", "/src/intro/Still.tsx"]));
  });
});
