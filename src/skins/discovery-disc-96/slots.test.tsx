// Discovery Disc '96's own behaviour, on top of the checks every skin gets in skins.test.tsx: the guide bot says the right
// thing for each kind of message, the Star Chart fills in met goals, Pace speaks Oregon Trail, and nothing is an emoji.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../../ui/hud/fixtures";
import { Docked } from "../../ui/hud/tree";
import type { HudActions, HudVM } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { prepareSkin } from "../registry";
import type { LoadedSkin } from "../types";
import { firstName } from "./badge";
import { Stamps } from "./stamps";
import { burstPoints, STAR_POINTS } from "./art";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const vm: HudVM = hudViewModel(fixtureInput({ tool: "hall" }));
const { skin } = await prepareSkin("discovery-disc-96");
// React puts <!-- --> between text runs on the server; take them out so the text reads the way it does on screen.
const html = (node: React.ReactNode, s: LoadedSkin = skin) => renderToString(<SkinProvider skin={s}>{node}</SkinProvider>).replace(/<!-- -->/g, "");
const slot = skin.slots;

describe("Discovery Disc '96", () => {
  it("replaces the slots skin.json says it does", () => {
    expect(Object.keys(slot).length).toBeGreaterThan(20);
    expect(slot.Layout.name).toBe("Layout");
    expect(slot.Stats.name).toBe("Stats");
  });

  it("Chip says GREAT JOB! for good news, OOPS! for bad news and PSST! for a hint", () => {
    const say = (patch: Partial<HudVM>) => html(<slot.Assistant vm={{ ...vm, ...patch }} actions={actions} />);
    expect(say({ toasts: [{ id: 1, text: "Frontier-2 is out!", tone: "good" }], hints: [] })).toContain("GREAT JOB!");
    expect(say({ toasts: [{ id: 1, text: "Hugo left.", tone: "bad" }], hints: [] })).toContain("OOPS!");
    const hint = say({ toasts: [], hints: ["tap"] });
    expect(hint).toContain("PSST!");
    expect(hint).toContain("Tap anyone to read their mind.");
    // Nobody talking: the bot is there, the balloon is not.
    const quiet = say({ toasts: [], hints: [] });
    expect(quiet).toContain("dd-guide");
    expect(quiet).not.toContain("dd-say");
    // The newest toast wins.
    const two = say({ toasts: [{ id: 1, text: "old", tone: "bad" }, { id: 2, text: "new", tone: "good" }], hints: [] });
    expect(two).toContain("new");
    expect(two).not.toContain(">old<");
  });

  it("the Star Chart fills in a star for each goal that is met", () => {
    const objectives = { ...vm.objectives, items: vm.objectives.items.map((g, i) => ({ ...g, met: i < 2 })) };
    const out = html(<slot.Objectives objectives={objectives} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out.match(/dd-staricon on/g)?.length).toBe(1 + 2); // the heading's star and the two met goals
    expect(out).toContain("MY STAR CHART");
  });

  it("Pace uses the trail's words and says how the party feels", () => {
    const out = html(<slot.Speed speed={vm.speed} stats={vm.stats} actions={actions} />);
    for (const word of ["Rest", "Steady", "Strenuous", "Grueling"]) expect(out).toContain(word);
    expect(out).toContain("Pace");
    expect(out).toMatch(/dd-pace-cap/);
  });

  it("the Field Trip Badge follows by first name and keeps a title off it", () => {
    const out = html(<slot.Inspector inspector={vm.inspector!} layout={{ ...vm.layout, compact: false }} actions={actions} />);
    expect(out).toContain("FIELD TRIP BADGE");
    expect(out).toContain(`Follow ${firstName(vm.inspector!.name)}`);
    expect(firstName("Dr. Ada Gradient")).toBe("Ada");
    expect(firstName("Ada Gradient")).toBe("Ada");
    expect(firstName("Agent-0042")).toBe("Agent-0042");
  });

  it("a thought bubble keeps the class photo mode copies", () => {
    const out = html(<slot.Bubble bubble={vm.bubbles[0]!} actions={actions} />);
    expect(out).toMatch(/^<div class="bubble /);
  });

  it("the Build Stamps tray is a tab you press to open (the coach's first target)", () => {
    const out = html(<slot.BuildBar items={vm.buildItems} tip={vm.buildTip} teasers={[]} layout={vm.layout} actions={actions} />);
    expect(out).toContain("BUILD STAMPS");
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('data-coach="start"');
    expect(out).not.toContain("dd-stamp-art");
  });

  it("the open tray is buttons with a picture each, a price and the hotkey, then the locked stamps, then Help", () => {
    const teasers = [{ label: "2 more", hint: "Ship your first model" }];
    // The top row is the tools, Facilities, Run… and Help; Facilities is a back stamp, every building and the locked one (FLT-63).
    const top = html(<Stamps items={vm.buildItems} teasers={teasers} onPick={() => undefined} onHelp={() => undefined} actions={actions} />);
    const exhibits = html(<Stamps items={vm.buildItems} teasers={teasers} onPick={() => undefined} onHelp={() => undefined} actions={actions} view="facilities" />);
    const out = top + exhibits;
    expect(out.match(/dd-stamp-art/g)?.length).toBe(vm.buildItems.length + 5);
    expect(top).toContain('data-testid="start-facilities"');
    expect(top).toContain('data-testid="start-run"');
    expect(exhibits).toContain("Big Machines");
    expect(out).toContain('aria-pressed="true"'); // the tool in hand
    expect(out).toContain("2 more");
    expect(out).toContain("Ship your first model");
    for (const it of vm.buildItems) {
      expect(out).toContain(`data-coach="build:${it.kind}"`);
      if (it.hotkey !== null) expect(out).toContain(`>${it.hotkey}<`);
    }
  });

  it("draws every icon itself: no emoji anywhere on the screen", () => {
    const out = html(<Docked vm={vm} actions={actions} />);
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u);
    // ...and every icon it asks for exists (an unknown name draws an empty <svg>).
    expect(out).not.toMatch(/<svg class="dd-icon"[^>]*><\/svg>/);
  });

  it("the clip-art shapes are well formed", () => {
    expect(STAR_POINTS.split(" ")).toHaveLength(10);
    expect(burstPoints(14).split(" ")).toHaveLength(28);
    expect(burstPoints(14)).not.toMatch(/NaN/);
  });
});
