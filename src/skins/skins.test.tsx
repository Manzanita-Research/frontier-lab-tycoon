// Every skin renders every slot from a fixture view-model without throwing, and its files are what the format says.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput, FIXTURE_CHAT, FIXTURE_PAPER } from "../ui/hud/fixtures";
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
      return { speed: main.speed, stats: main.stats, actions };
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
    case "Coach":
      return { coach: vms.coached!.coach!, anchor: { x: 4, y: 862, w: 72, h: 32 }, layout: vms.coached!.layout, actions };
    case "UnlockCard":
      return { unlock: vms.coached!.unlock!, actions };
    case "HowToPlay":
      return { help: vms.help!.help!, actions };
    case "Arena":
      return { arena: main.arena, leapfrog: vms.lf!.leapfrog, layout: main.layout, actions };
    case "Benchmarks":
      return { leapfrog: vms.lf!.leapfrog, layout: vms.lf!.layout, actions };
    case "Voice":
      return { leapfrog: vms.lf!.leapfrog, layout: vms.lf!.layout, actions };
    case "Livestream":
      return { event: vms.stream!.event!, stream: vms.stream!.event!.stream!, actions };
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
    case "Papers":
      return { papers: vms.papers!.papers, layout: vms.papers!.layout, actions };
    case "PaperMoment":
      return { moment: vms.scoop!.paperMoment!, actions };
    case "CrumbWiki":
      return { wiki: vms.scandal!.crumbWiki!, actions };
  }
}

const vms: Record<string, HudVM> = {
  main: vmOf({ tool: "cluster" }),
  event: vmOf({ event: "waterDiscourse" }),
  confirm: vmOf({ confirm: true }),
  coached: vmOf({ level: 1, coach: 0, unlock: true }),
  garage: vmOf({ level: 1, selected: null }),
  lab: vmOf({ level: 5, selected: null }),
  help: vmOf({ level: 2, help: true }),
  // Nobody else is talking: a skin with one speech balloon (Chip, in Discovery Disc) shows a standing warning when it is quiet.
  warned: hudViewModel({ ...fixtureInput({ warnings: ["Your entrance isn't connected to any paths. Visitors are forming a very orderly queue to nowhere."] }), toasts: [] }),
  lf: vmOf({ leapfrog: true }),
  lfPhone: vmOf({ leapfrog: true, width: 390, height: 844 }),
  shipNow: vmOf({ leapfrog: true, event: "shipNow" }),
  stream: vmOf({ leapfrog: true, event: "stream:dog" }),
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
  papers: vmOf({ papers: "panel" }),
  drop: vmOf({ papers: "drop" }),
  scoop: vmOf({ papers: "scoop" }),
  award: vmOf({ papers: "award" }),
  sign: vmOf({ collusion: "sign" }),
  scandal: vmOf({ collusion: "scandal" }),
};

const usable = catalog.filter((e) => e.ok).map((e) => e.folder);

describe("the catalog", () => {
  it("finds the six shipped skins, all valid", () => {
    expect(usable.sort()).toEqual(["discovery-disc-96", "field-almanac", "frontier-95", "homepage-98", "karaoke-night", "swag-drop"]);
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
      // The base has no assistant character: its Assistant draws nothing (hints and toasts show as ordinary toasts).
      if (!(name === "Assistant" && skin.slots.Assistant === baseSlots.Assistant)) expect(out.length, `${id}/${name} drew nothing`).toBeGreaterThan(0);
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

  it("draws Papers once earned, and the paper and collusion moments (FLT-45, FLT-46)", async () => {
    const { skin } = await prepareSkin(id);
    const panel = html(skin, <Docked vm={vms.papers!} actions={actions} />);
    expect(vms.papers!.papers.open).toBe(true);
    expect(panel).toContain(escape(vms.papers!.papers.papers[0]!.title));
    for (const p of vms.papers!.papers.policies) expect(panel).toContain(escape(p.label));
    // Not earned yet (Level 4): nothing at all, not even the chip.
    const locked = hudViewModel({ ...fixtureInput({ papers: "panel", level: 4 }) });
    expect(html(skin, <Docked vm={locked} actions={actions} />)).not.toContain(escape(vms.papers!.papers.papers[0]!.title));
    const scoop = html(skin, <Modals vm={vms.scoop!} actions={actions} />);
    expect(scoop).toContain(escape(vms.scoop!.paperMoment!.rival!));
    expect(scoop).toContain(escape(vms.scoop!.paperMoment!.gapText!));
    expect(html(skin, <Modals vm={vms.award!} actions={actions} />)).toContain(escape(vms.award!.paperMoment!.award!));
    expect(html(skin, <Modals vm={vms.drop!} actions={actions} />)).toContain(escape(vms.drop!.paperMoment!.paper.arxiveId));
    const sign = html(skin, <Modals vm={vms.sign!} actions={actions} />);
    expect(sign).toContain(escape(vms.sign!.event!.title));
    expect(sign).toContain("POST definitely-not-the-internet.local");
    const scandal = html(skin, <Modals vm={vms.scandal!} actions={actions} />);
    expect(scandal).toContain(escape(vms.scandal!.crumbWiki!.frontPage!.headline));
    expect(scandal).toContain("Talk");
  });

  it("asks before a spend that leaves under three months of runway, in a modal of its own", async () => {
    const { skin } = await prepareSkin(id);
    const vm = vms.confirm!;
    expect(vm.confirm).toMatchObject({ kind: "hire", costText: "$4K", runwayText: "1.8 mo" });
    const out = html(skin, <Modals vm={vm} actions={actions} />);
    expect(out).toContain(escape(vm.confirm!.message));
    expect(out).toContain(escape(vm.confirm!.costText));
    expect(out).toContain(escape(vm.confirm!.runwayText));
    expect(out).toMatch(/role="(alert)?dialog"/);
    // Nothing waiting: no card.
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

  it("hides what the lab has not earned yet (level 1: cash, runway, date, the goal, the training bar) and shows it all later", async () => {
    const { skin } = await prepareSkin(id);
    const garage = html(skin, <Docked vm={vms.garage!} actions={actions} />);
    const lab = html(skin, <Docked vm={vms.lab!} actions={actions} />);
    const rival = vms.lab!.arena.rows[0]!.short;
    const thought = vms.lab!.thoughtsPanel[0]!.text;
    expect(lab).toContain(escape(rival));
    expect(garage).not.toContain(escape(rival));
    expect(garage).not.toContain(`aria-label="${escape(skin.strings["news.open"]!)}"`);
    expect(lab).toContain(escape(thought));
    expect(garage).not.toContain(escape(thought));
    // The goal is one line (its words, and no scenario checklist behind it).
    expect(garage).toContain(escape(vms.garage!.progress.goal.text));
    expect(garage).not.toContain(escape(vms.garage!.objectives.items[0]!.label));
    // The Vibes breakdown and the payroll are earned later too.
    expect(garage).not.toContain(escape(vms.garage!.stats.vibes.rows[0]!.label));
    expect(garage).toContain(escape(vms.garage!.stats.cash.text));
  });

  it("marks what the coach can point at, in this skin: start, runway, goals, the training bar; and lights only the current one", async () => {
    const { skin } = await prepareSkin(id);
    for (const [target, step] of [["start", 0], ["training", 3], ["stat:runway", 5], ["goals", 6]] as const) {
      const vm = vmOf({ level: 1, coach: step, selected: null });
      expect(vm.coach!.target).toBe(target);
      const out = html(skin, <Docked vm={vm} actions={actions} />);
      expect(out, `${id}: data-coach="${target}"`).toContain(`data-coach="${target}"`);
      // Exactly the one the coach is on is active.
      expect(out.match(/data-coach-active/g)?.length, `${id}: active ${target}`).toBe(1);
      expect(out).toMatch(new RegExp(`data-coach="${target.replace(":", ":")}"[^>]*data-coach-active|data-coach-active[^>]*data-coach="${target}"`));
    }
    // With nobody coaching nothing is active, but the hooks are still there.
    const quiet = html(skin, <Docked vm={vms.garage!} actions={actions} />);
    expect(quiet).not.toContain("data-coach-active");
    expect(quiet).toContain('data-coach="start"');
  });

  it("draws the coach's balloon: one line, 'N of 7', a Skip that is always there, and no Continue", async () => {
    const { skin } = await prepareSkin(id);
    const vm = vms.coached!;
    const out = html(skin, <skin.slots.Coach coach={vm.coach!} anchor={{ x: 4, y: 862, w: 72, h: 32 }} layout={vm.layout} actions={actions} />);
    expect(out).toContain(escape(vm.coach!.text));
    expect(out).toContain(escape(skin.strings["coach.skip"]!));
    expect(out).toContain(escape(skin.strings["coach.step"]!.replace("{n}", "1").replace("{total}", "7")));
    expect(out).not.toMatch(/>\s*(Next|Continue)\s*</);
    // On a phone it docks instead of floating beside the target.
    const phone = vmOf({ level: 1, coach: 0, width: 390, height: 844 });
    const docked = html(skin, <skin.slots.Coach coach={phone.coach!} anchor={{ x: 4, y: 800, w: 72, h: 44 }} layout={phone.layout} actions={actions} />);
    expect(docked).toContain("docked");
  });

  it("draws the New! card (what unlocked) and Help (the loop, the unlocked buildings, the numbers)", async () => {
    const { skin } = await prepareSkin(id);
    const card = html(skin, <skin.slots.UnlockCard unlock={vms.coached!.unlock!} actions={actions} />);
    expect(card).toContain(escape(vms.coached!.unlock!.title));
    for (const item of vms.coached!.unlock!.items) expect(card).toContain(escape(item));
    const help = html(skin, <skin.slots.HowToPlay help={vms.help!.help!} actions={actions} />);
    for (const line of vms.help!.help!.loop) expect(help).toContain(escape(line));
    for (const b of vms.help!.help!.buildings) expect(help).toContain(escape(b.line));
    expect(help).not.toContain(escape(vmOf({ level: 5, help: true }).help!.buildings.find((b) => b.kind === "demo")!.line));
    expect(help).toContain(escape(skin.strings["help.replay"]!));
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
