// FLT-70: Jem kept the CRT shader for the box's beige PC and turned the tube over the game off for every skin. This
// pins the switch off, keeps the box on the shader, and keeps screenshots from asking for a tube the game no longer has.
// FLT-88 (this branch) turns GAME_CRT on only where HTML-in-canvas is: never under vitest, so it still reads off here.
import { describe, expect, it } from "vitest";
import { GAME_CRT } from "./state";
import { glassSupport } from "../../ui/glass/support";

const src = import.meta.glob<string>(["/src/intro/stage/Kiosk.tsx", "/src/ui/juice/crt.ts", "/src/ui/hud/useHudVM.ts", "/src/render/crt/state.ts", "/scripts/shots.scenes.json"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the in-game picture tube is off (FLT-70)", () => {
  it("GAME_CRT is off without HTML-in-canvas (FLT-88)", () => {
    expect(glassSupport).toBe(null);
    expect(GAME_CRT).toBe(false);
    expect(src["/src/render/crt/state.ts"]).toMatch(/export const GAME_CRT = glassSupport !== null;/);
  });

  it("the switch gates the look, ?crt=, the saved pick and the Display Properties setting", () => {
    const crt = src["/src/ui/juice/crt.ts"]!;
    expect(crt).toMatch(/const mode: CrtMode = !GAME_CRT \|\|/);
    expect(crt).toMatch(/const pinnedMode = GAME_CRT &&/);
    expect(crt).toMatch(/GAME_CRT \? recall\(\) : null/);
    expect(crt).toMatch(/setCrtMode\(mode: CrtMode\) {\n\s*if \(!GAME_CRT\) return;/);
    expect(src["/src/ui/hud/useHudVM.ts"]).toMatch(/\.\.\.\(GAME_CRT \? { crt:/);
  });

  it("the box's beige PC keeps the shader", () => {
    expect(src["/src/intro/stage/Kiosk.tsx"]).toMatch(/new CRTPipeline\(/);
    expect(src["/src/intro/stage/Kiosk.tsx"]).not.toMatch(/GAME_CRT|crtAtom/);
  });

  it("no screenshot scene asks for a tube", () => {
    const { scenes } = JSON.parse(src["/scripts/shots.scenes.json"]!) as { scenes: Record<string, { query?: Record<string, unknown> }> };
    const tubed = Object.entries(scenes).filter(([id, s]) => id.startsWith("crt-") || (s.query && ("crt" in s.query || "crttier" in s.query)));
    expect(tubed.map(([id]) => id)).toEqual([]);
  });
});
