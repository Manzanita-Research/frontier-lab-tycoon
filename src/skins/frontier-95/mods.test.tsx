// Add/Remove Mods (FLT-102): the mods this build ships, each with an Add button, and a voice picker once a mod has a
// voice. The picker stays readable under full voice.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HudActions, ModsVM } from "../../ui/hud/types";
import { ModManager as BaseModManager } from "../base/slots/ModManager";
import { SkinProvider } from "../context";
import { prepareSkin } from "../registry";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const { skin } = await prepareSkin("frontier-95");
const html = (node: React.ReactNode) => renderToString(<SkinProvider skin={skin}>{node}</SkinProvider>).replace(/<!-- -->/g, "");
const base: ModsVM = { open: true, list: [], conflicts: [], errors: [], contentHash: null };
const duck = { id: "duck-mode", name: "Duck Mode", blurb: "Everyone is a rubber duck.", added: false, adding: false };

describe.each([
  ["Frontier 95", skin.slots.ModManager],
  ["base", BaseModManager],
])("%s Add/Remove Mods", (_, ModManager) => {
  it("offers the mods the build ships that aren't on yet, with Add and Adding…", () => {
    expect(html(<ModManager mods={{ ...base, extras: [duck] }} actions={actions} />)).toMatch(/<button[^>]*>Add<\/button>/);
    expect(html(<ModManager mods={{ ...base, extras: [{ ...duck, adding: true }] }} actions={actions} />)).toMatch(/<button[^>]*disabled=""[^>]*>Adding…/);
    expect(html(<ModManager mods={{ ...base, extras: [{ ...duck, added: true }] }} actions={actions} />)).not.toContain("Everyone is a rubber duck.");
  });

  it("has no voice picker without a voice, and three choices, out of the voice's reach, with one", () => {
    expect(html(<ModManager mods={base} actions={actions} />)).not.toContain("type=\"radio\"");
    const out = html(<ModManager mods={{ ...base, voice: { mod: "Duck Mode", mode: "full" } }} actions={actions} />);
    expect(out.match(/type="radio"/g)).toHaveLength(3);
    expect(out).toContain('data-voice="off"');
    expect(out).toContain("Duck Mode&#x27;s voice");
  });
});
