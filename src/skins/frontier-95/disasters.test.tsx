// Frontier 95's Disasters (FLT-32): the error box for each disaster under way, and the Settings applet.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../../ui/hud/fixtures";
import type { HudActions } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { prepareSkin } from "../registry";
import { exeName } from "./disasters";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const { skin } = await prepareSkin("frontier-95");
const html = (node: React.ReactNode) => renderToString(<SkinProvider skin={skin}>{node}</SkinProvider>).replace(/<!-- -->/g, "");
const mid = hudViewModel(fixtureInput({ disaster: true, disastersOpen: true }));
const calm = hudViewModel(fixtureInput({ level: 5 }));
const { DisasterAlert, DisasterMenu } = skin.slots;

describe("Frontier 95 disasters", () => {
  it("names a disaster the way a crashed program is named", () => {
    expect(exeName("Rogue Agent Swarm")).toBe("ROGUE_AGENT_SWARM.EXE");
    expect(exeName("GPU Fire!")).toBe("GPU_FIRE.EXE");
  });

  it("draws an application error box per disaster, with who was pulled off their post", () => {
    const out = html(<DisasterAlert disasters={mid.disasters} layout={mid.layout} actions={actions} />);
    expect(out).toContain("ROGUE_AGENT_SWARM.EXE is being shut down. Please wait.");
    expect(out).toContain("WEIGHTS_LEAK.EXE");
    expect(out).toContain("GATE UNGUARDED");
    expect(out).toContain("Details &gt;&gt;");
    expect(html(<DisasterAlert disasters={calm.disasters} layout={calm.layout} actions={actions} />)).toBe("");
  });

  it("is a Control Panel applet with the four settings as radio buttons and Start… waiting for a pick", () => {
    const out = html(<DisasterMenu disasters={mid.disasters} actions={actions} />);
    expect(out).toContain("Disasters Properties");
    expect(out.match(/type="radio"/g)).toHaveLength(4);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Start…/);
  });

});
