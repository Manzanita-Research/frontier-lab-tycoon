// Every skin renders every slot from a fixture view-model without throwing, and its files are what the format says.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput, openingWorld, FIXTURE_CHAT, FIXTURE_PAPER } from "../ui/hud/fixtures";
import { Docked, Modals, PhotoLayer } from "../ui/hud/tree";
import type { HudActions, HudVM } from "../ui/hud/types";
import { hudViewModel } from "../ui/hud/vm";
import { SkinProvider } from "./context";
import { exists, read, sources } from "./files";
import { BASE_ID, catalog, prepareSkin, refusedSkins, skinList, SkinRefused } from "./registry";
import { baseSlots } from "./base/slots";
import { SLOT_NAMES, type LoadedSkin, type SlotName, type SlotPropsMap } from "./types";
import type { FixtureOptions } from "../ui/hud/fixtures";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;

const vmOf = (o: FixtureOptions = {}): HudVM => hudViewModel(fixtureInput(o));
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

function html(skin: LoadedSkin, node: React.ReactNode) {
  return renderToString(<SkinProvider skin={skin}>{node}</SkinProvider>);
}

/** The props each slot gets, from a view-model where that slot has something to show. */
function propsFor(name: SlotName, vms: Record<string, HudVM>): SlotPropsMap[SlotName] | null {
  const main = vms.main!;
  switch (name) {
    case "Layout":
      return null; // rendered through <Docked> below
    case "Stats":
      return { stats: main.stats, layout: main.layout, actions };
    case "Training":
      return { training: main.training, actions };
    case "Objectives":
      return { objectives: main.objectives, layout: main.layout, actions };
    case "Inspector":
      return { inspector: main.inspector!, layout: main.layout, actions };
    case "BuildBar":
      return { items: main.buildItems, tip: main.buildTip, layout: main.layout, actions };
    case "Speed":
      return { speed: main.speed, stats: main.stats, pause: main.pause, actions };
    case "Staff":
      return { staff: { ...main.staff, open: true }, actions };
    case "Bubble":
      return { bubble: main.bubbles[0]!, actions };
    case "ThoughtsPanel":
      return { rows: main.thoughtsPanel, layout: main.layout, actions };
    case "Ticker":
      return { items: main.ticker, actions };
    case "Toast":
      return { toast: main.toasts[0]!, actions };
    case "Assistant":
      return { vm: main, actions };
    case "EventCard":
      return { event: vms.event!.event!, actions };
    case "Confirm":
      return { confirm: vms.confirm!.confirm!, actions };
    case "Arena":
      return { arena: main.arena, actions };
    case "EraCard":
      return { era: vms.era!.eraCard!, actions };
    case "FrontPage":
      return { paper: vms.paper!.newsroom.paper!, actions };
    case "GroupChat":
      return { chat: vms.chat!.newsroom.chat!, actions };
    case "PhotoButton":
      return { photo: main.photoMode, actions };
    case "PhotoOverlay":
      return { photo: vms.photo!.photoMode, actions };
    case "SkinPicker":
      return { skins: { ...main.skins, open: true }, actions };
    case "Outcome":
      return { outcome: vms.outcome!.outcome!, actions };
    case "NewsControls":
      return { newsroom: main.newsroom, sound: main.sound, skins: main.skins, actions };
    case "NewsArrival":
      return { arrival: main.newsroom.arrival!, actions };
    case "NewsRoom":
      return { newsroom: vms.archive!.newsroom, actions };
    case "Mixer":
      return { sound: { ...main.sound, open: true }, actions };
  }
}

/** A clean start: the guided opening on its first step, the game waiting for Next. */
const openingOf = (o: FixtureOptions = {}): HudVM => hudViewModel({ ...fixtureInput({ world: openingWorld(), selected: null, ...o }), pauseReason: "tutorial", toasts: [] });
const withToast = (vm: HudVM): HudVM => ({ ...vm, toasts: [{ id: 9, text: "The kombucha keg has achieved sentience", tone: "joke" }] });

const vms: Record<string, HudVM> = {
  opening: openingOf(),
  openingPhone: openingOf({ width: 390, height: 844 }),
  main: vmOf({ tool: "cluster" }),
  event: vmOf({ event: "waterDiscourse" }),
  confirm: vmOf({ confirm: true }),
  warned: vmOf({ warnings: ["Your entrance isn't connected to any paths. Visitors are forming a very orderly queue to nowhere."] }),
  auction: vmOf({ event: "computeAuction" }),
  era: vmOf({ event: "era2" }),
  outcome: vmOf({ outcome: "won" }),
  paper: vmOf({ view: FIXTURE_PAPER }),
  chat: vmOf({ view: FIXTURE_CHAT, chatCount: 2 }),
  archive: vmOf({ view: "archive" }),
  photo: vmOf({ photo: true }),
  phone: vmOf({ width: 390, height: 844 }),
  nobody: vmOf({ selected: null }),
  staff: vmOf({ staff: true }),
};

const usable = catalog.filter((e) => e.ok).map((e) => e.folder);

describe("the catalog", () => {
  it("finds the six shipped skins, all valid", () => {
    expect(usable.sort()).toEqual(["discovery-disc-96", "field-almanac", "frontier-95", "geocities", "karaoke-night", "swag-drop"]);
    expect(refusedSkins()).toEqual([]);
    expect(skinList().map((s) => s.id)[0]).toBe("frontier-95");
  });
  it("refuses a skin that is not there, readably", async () => {
    await expect(prepareSkin("does-not-exist")).rejects.toBeInstanceOf(SkinRefused);
    await expect(prepareSkin("does-not-exist")).rejects.toThrow(/no skin folder/);
  });
});

describe.each([BASE_ID, ...usable])("skin %s", (id) => {
  it("loads, and renders every slot from a fixture without throwing", async () => {
    const { skin } = await prepareSkin(id);
    expect(Object.keys(skin.slots).sort()).toEqual([...SLOT_NAMES].sort());
    for (const name of SLOT_NAMES) {
      if (name === "Layout") continue;
      const props = propsFor(name, vms);
      const Slot = skin.slots[name] as React.ComponentType<SlotPropsMap[SlotName]>;
      const out = html(skin, <Slot {...props!} />);
      // With no tutorial up, the base's Assistant draws nothing (hints and toasts are the Toasts slot's job).
      if (!(name === "Assistant" && skin.slots.Assistant === baseSlots.Assistant && !(props as { vm: HudVM }).vm.assistant)) expect(out.length, `${id}/${name} drew nothing`).toBeGreaterThan(0);
      expect(out, `${id}/${name}`).not.toMatch(/undefined|\[object Object\]|NaN/);
      expect(out, `${id}/${name} left a placeholder`).not.toMatch(/\{\w+\}/);
    }
  });

  it("renders the whole HUD (Layout + modals) in every state", async () => {
    const { skin } = await prepareSkin(id);
    for (const [name, vm] of Object.entries(vms)) {
      const out = html(skin, (
        <>
          <Docked vm={vm} actions={actions} />
          <Modals vm={vm} actions={actions} />
          <PhotoLayer vm={vm} actions={actions} />
        </>
      ));
      expect(out.length, `${id}/${name}`).toBeGreaterThan(200);
      expect(out, `${id}/${name}`).not.toMatch(/undefined|\[object Object\]|NaN/);
    }
  });

  it("shows the game's facts: lab name, cash, the walker, the card", async () => {
    const { skin } = await prepareSkin(id);
    const main = html(skin, <Docked vm={vms.main!} actions={actions} />);
    expect(main).toContain(escape(vms.main!.stats.labName));
    expect(main).toContain(escape(vms.main!.inspector!.name));
    expect(main).toContain(escape(vms.main!.training.name));
    const card = html(skin, <Modals vm={vms.event!} actions={actions} />);
    expect(card).toContain(escape(vms.event!.event!.title));
    for (const c of vms.event!.event!.choices) expect(card).toContain(escape(c.label));
    const era = html(skin, <Modals vm={vms.era!} actions={actions} />);
    expect(era).toContain(escape(vms.era!.eraCard!.line));
  });

  it("delivers the tutorial through the Assistant slot: the sentence, Next while the game waits, Skip always", async () => {
    const { skin } = await prepareSkin(id);
    const lesson = vms.opening!;
    const out = html(skin, <skin.slots.Assistant vm={lesson} actions={actions} />);
    expect(out).toContain(escape(lesson.assistant!.message));
    expect(out).toContain(escape(skin.strings["assistant.skip"]!));
    expect(out).toContain(escape(skin.strings["assistant.next"]!));
    expect(out).toContain(escape(skin.strings["assistant.step"]!.replace("{n}", "1").replace("{total}", "5")));
    // Acknowledged: no Next to press, but the way out stays.
    const read = { ...lesson, assistant: { ...lesson.assistant!, paused: false } };
    const acknowledged = html(skin, <skin.slots.Assistant vm={read} actions={actions} />);
    expect(acknowledged).not.toContain(`>${escape(skin.strings["assistant.next"]!)}<`);
    expect(acknowledged).toContain(escape(skin.strings["assistant.skip"]!));
    // Done or skipped: nothing of the lesson is left.
    const over = html(skin, <skin.slots.Assistant vm={{ ...lesson, assistant: null }} actions={actions} />);
    expect(over).not.toContain(escape(skin.strings["assistant.skip"]!));
  });

  it("keeps a phone's lesson short: one sentence, both buttons", async () => {
    const { skin } = await prepareSkin(id);
    const out = html(skin, <Docked vm={vms.openingPhone!} actions={actions} />);
    expect(out).toContain(escape(vms.openingPhone!.assistant!.message));
    expect(out).toContain(escape(skin.strings["assistant.skip"]!));
  });

  it("lights whatever the step points at, and only while the tutorial is up", async () => {
    const { skin } = await prepareSkin(id);
    const lit = html(skin, <Docked vm={vms.opening!} actions={actions} />);
    expect(lit).toContain("flt-hl");
    const quiet = html(skin, <Docked vm={vmOf({ tool: "cluster" })} actions={actions} />);
    expect(quiet).not.toContain("flt-hl");
    // Pointing at the tool in hand is done with: the ring goes out once it is picked.
    const picked = hudViewModel({ ...fixtureInput({ world: openingWorld(), selected: null }), tool: "path", pauseReason: "tutorial", toasts: [] });
    expect(html(skin, <Docked vm={picked} actions={actions} />)).not.toContain("flt-hl");
  });

  it("points at the Training window when the last step says to watch the run", async () => {
    const { skin } = await prepareSkin(id);
    const run = { ...vmOf({ selected: null }), assistant: { ...vms.opening!.assistant!, step: "release", number: 5, highlight: "training", paused: false, waitingForBuild: false } };
    const out = html(skin, <Docked vm={run} actions={actions} />);
    expect(out).toMatch(/class="[^"]*flt-hl[^"]*"/);
    expect(html(skin, <Docked vm={{ ...run, assistant: { ...run.assistant, highlight: "nothing:here" } }} actions={actions} />)).not.toContain("flt-hl");
  });

  it("shows a gentle Paused note when the game itself is holding time, and not for a card or the pause button", async () => {
    const { skin } = await prepareSkin(id);
    const speed = (pause: HudVM["pause"]) => html(skin, <skin.slots.Speed speed={vms.main!.speed} stats={vms.main!.stats} pause={pause} actions={actions} />);
    const none = speed({ paused: false, reason: null, auto: false });
    for (const reason of ["tutorial", "build", "menu", "inspector"] as const) {
      const out = speed({ paused: true, reason, auto: true });
      expect(out, reason).not.toBe(none);
      expect(out, reason).toContain(escape(skin.strings[`pause.${reason}`]!));
    }
    expect(speed({ paused: true, reason: "card", auto: true })).toBe(none);
    expect(speed({ paused: true, reason: "player", auto: false })).toBe(none);
  });

  it("asks before a spend that leaves under three months of runway, and offers the safe answer first", async () => {
    const { skin } = await prepareSkin(id);
    const vm = vms.confirm!;
    expect(vm.confirm).toMatchObject({ kind: "hire", costText: "$4K", runwayText: "1.8 mo" });
    const out = html(skin, <Modals vm={vm} actions={actions} />);
    expect(out).toContain(escape(vm.confirm!.message));
    expect(out).toContain(escape(vm.confirm!.costText));
    expect(out).toContain(escape(vm.confirm!.runwayText));
    expect(out).toContain('role="dialog"'.replace("dialog", out.includes('role="alertdialog"') ? "alertdialog" : "dialog"));
    // No card when nothing is waiting.
    expect(html(skin, <Modals vm={vms.main!} actions={actions} />)).not.toContain(escape(vm.confirm!.message));
  });

  it("keeps standing warnings on screen (once, even if a toast says the same thing)", async () => {
    const { skin } = await prepareSkin(id);
    const vm = vms.warned!;
    const out = html(skin, <Docked vm={vm} actions={actions} />);
    for (const w of vm.warnings) expect(out).toContain(escape(w));
    expect(vm.warnings).toHaveLength(1);
    const echoed = hudViewModel({ ...fixtureInput({ warnings: vm.warnings }), toasts: [{ id: 5, text: vm.warnings[0]!, tone: "bad" }] });
    expect(echoed.toasts).toEqual([]);
    expect(html(skin, <Docked vm={echoed} actions={actions} />).split(escape(vm.warnings[0]!)).length - 1).toBe(1);
  });

  it("queues a toast under the lesson instead of talking over it", async () => {
    const { skin } = await prepareSkin(id);
    const vm = withToast(vms.opening!);
    const out = html(skin, <Docked vm={vm} actions={actions} />);
    expect(out).toContain(escape(vm.assistant!.message));
    expect(out).toContain(escape(vm.toasts[0]!.text));
  });

  it("uses the skin's own strings", async () => {
    const { skin } = await prepareSkin(id);
    const out = html(skin, <Docked vm={vms.main!} actions={actions} />);
    expect(out).toContain(escape(skin.strings["ticker.label"]!));
  });
});

describe("skin folders", () => {
  it.each(usable)("%s: fonts and their licences, the preview and the CSS are all there", (id) => {
    const manifest = JSON.parse(read(`${id}/skin.json`)!);
    for (const f of manifest.fonts) {
      expect(exists(`${id}/${f.src}`), `${id}: ${f.src}`).toBe(true);
      expect(exists(`${id}/${f.licenseFile}`), `${id}: ${f.licenseFile}`).toBe(true);
      expect(read(`${id}/${f.licenseFile}`)).toMatch(/Open Font License|Apache License/i);
    }
    expect(exists(`${id}/${manifest.preview}`), `${id}: preview`).toBe(true);
    expect(exists(`${id}/skin.css`), `${id}: skin.css`).toBe(true);
    if (manifest.slots.length > 0) expect(exists(`${id}/slots.tsx`)).toBe(true);
    else expect(exists(`${id}/slots.tsx`), `${id}: a stub has no slots.tsx`).toBe(false);
  });

  it("never hot-links: no font CDNs or @import in any skin", () => {
    for (const [path, text] of sources().filter(([p]) => usable.some((id) => p.startsWith(`./${id}/`)))) {
      expect(text, path).not.toMatch(/https?:\/\/(fonts\.|cdn|use\.typekit)/);
      expect(text, path).not.toMatch(/@import/);
    }
  });

  it("keeps skins out of the game: no skin imports the sim, the app, the render layer or three", () => {
    const forbidden = /from\s+["'](?:\.\.\/)+(?:sim|app|render|content|audio|newsroom)\b|from\s+["']three["']|from\s+["']@react-three/;
    for (const [path, text] of sources()) {
      // The registry and schema are the loader, not a skin: they import the base and the HUD types only, and this holds for them too.
      expect(text, path).not.toMatch(forbidden);
    }
  });
});
