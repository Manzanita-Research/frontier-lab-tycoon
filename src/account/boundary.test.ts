// Accounts (FLT-67) ship only in builds with VITE_FLT_AUTH=on, so nothing else may reach into src/account: the one way
// in is main.tsx's flagged dynamic import, which Vite drops when the flag is off (the byte-identical proof relies on it).
// And like a skin, the account UI reads nothing of the game: no sim, no store, no three. The one exception is
// `game.ts`, the cloud saves' port onto FLT-65's save desk, which is inside the same flagged chunk.
const game = import.meta.glob<string>(["../**/*.{ts,tsx}", "!./**", "!**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true });
const account = import.meta.glob<string>(["./**/*.{ts,tsx}", "!**/*.test.{ts,tsx}"], { query: "?raw", import: "default", eager: true });

const specifiers = (code: string) => [...code.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((m) => m[1]!);

describe("accounts stay behind their flag", () => {
  it("reads the whole game", () => {
    expect(Object.keys(game)).toContain("../main.tsx");
    expect(Object.keys(game).length).toBeGreaterThan(100);
    expect(Object.keys(account)).toContain("./boot.tsx");
  });

  it("is imported only by main.tsx, dynamically, under VITE_FLT_AUTH", () => {
    const into = Object.entries(game).flatMap(([file, code]) => specifiers(code).filter((s) => /(^|\/)account(\/|$)/.test(s)).map((s) => `${file}: ${s}`));
    expect(into).toEqual(["../main.tsx: ./account/boot", "../main.tsx: ./account/boot"]);
    const main = game["../main.tsx"]!;
    // Booted with the game, and (fromBox) when the intro hands over to it.
    expect(main).toMatch(/if \(import\.meta\.env\.VITE_FLT_AUTH === "on"[^\n]*\{\n[^\n]*import\("\.\/account\/boot"\)/);
    expect(main).toMatch(/const fromBox[^\n]*=\n\s*import\.meta\.env\.VITE_FLT_AUTH === "on"\n\s*\? [^]*?import\("\.\/account\/boot"\)[^]*?\n\s*: loadGame;/);
  });

  it("never imports the sim, the store, the app shell or three", () => {
    const bad = Object.entries(account)
      .filter(([file]) => file !== "./game.ts")
      .flatMap(([file, code]) =>
      specifiers(code).filter((s) => /(^|\/)(sim|app|render|store)(\/|$)|^three|^@react-three/.test(s)).map((s) => `${file}: ${s}`),
    );
    expect(bad).toEqual([]);
  });

  it("reaches the game only through game.ts, which only the cloud hook imports", () => {
    const via = Object.entries(account).flatMap(([file, code]) => specifiers(code).filter((s) => /^\.\.?\/game$/.test(s)).map((s) => `${file}: ${s}`));
    expect(via).toEqual(["./useCloud.ts: ./game"]);
  });
});
