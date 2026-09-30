// GeoCities' own behaviour: the hit counter, the ring, the pop-ups. (skins.test.tsx already renders every slot of every skin.)
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../ui/hud/fixtures";
import type { BuildItemVM, HudActions, HudVM } from "../ui/hud/types";
import { hudViewModel } from "../ui/hud/vm";
import { SkinProvider } from "./context";
import { prepareSkin } from "./registry";
import { ringStep } from "./geocities/webring";
import type { LoadedSkin, SlotPropsMap } from "./types";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const vm = (): HudVM => hudViewModel(fixtureInput({ width: 1440, height: 900 }));
const html = (skin: LoadedSkin, node: React.ReactNode) => renderToString(<SkinProvider skin={skin}>{node}</SkinProvider>).replace(/<!-- -->/g, "");

describe("geocities", () => {
  it("welcomes you to the lab's home page and shows Vibes as a six-digit hit counter", async () => {
    const { skin } = await prepareSkin("geocities");
    const v = vm();
    const Stats = skin.slots.Stats;
    const out = html(skin, <Stats stats={{ ...v.stats, vibes: { ...v.stats.vibes, value: 636, trend: "up" } }} layout={v.layout} actions={actions} />);
    expect(out).toMatch(/Welcome to .+Home Page!!!/);
    // 000636: the zeros stay white, the real digits are hot.
    const digits = [...out.matchAll(/<span class="(hot)?"[^>]*>(\d)<\/span>/g)].map((m) => `${m[1] ? "!" : ""}${m[2]}`);
    expect(digits.join("")).toBe("000!6!3!6");
    expect(out).toContain("NEW!");
  });

  it("pads a small score to six digits, and says OUCH when it falls", async () => {
    const { skin } = await prepareSkin("geocities");
    const v = vm();
    const Stats = skin.slots.Stats;
    const out = html(skin, <Stats stats={{ ...v.stats, vibes: { ...v.stats.vibes, value: 0, trend: "down" } }} layout={v.layout} actions={actions} />);
    expect([...out.matchAll(/<span class="(?:hot)?"[^>]*>(\d)<\/span>/g)]).toHaveLength(6);
    expect(out).toContain("OUCH!");
    expect(out).not.toContain("NEW!");
  });

  it("spells out an infinite runway (the infinity sign is not in every font)", async () => {
    const { skin } = await prepareSkin("geocities");
    const v = vm();
    const Stats = skin.slots.Stats;
    const out = html(skin, <Stats stats={{ ...v.stats, runway: { months: null, text: "∞", warning: false } }} layout={v.layout} actions={actions} />);
    expect(out).toContain("Infinite!!");
    expect(out).not.toContain("∞");
  });

  it("titles a toast by its mood, and offers to make it go away", async () => {
    const { skin } = await prepareSkin("geocities");
    const Toast = skin.slots.Toast as React.ComponentType<SlotPropsMap["Toast"]>;
    const bad = html(skin, <Toast toast={{ id: 1, text: "GPU fire", tone: "bad" }} actions={actions} />);
    expect(bad).toContain("WARNING!!!");
    expect(bad).toContain("Click here!!!");
    const hint = html(skin, <Toast toast={{ id: -1, text: "Build a Gateway", tone: "hint" }} actions={actions} />);
    expect(hint).toContain("Tip of the Day!");
    expect(hint).not.toContain("Click here!!!"); // a standing hint is not dismissable
  });

  it("guestbook entries keep the `bubble` class the game pins and photo mode copies", async () => {
    const { skin } = await prepareSkin("geocities");
    const v = vm();
    const Bubble = skin.slots.Bubble;
    const b = v.bubbles[0]!;
    const out = html(skin, <Bubble bubble={b} actions={actions} />);
    expect(out).toMatch(/^<div class="bubble /);
    expect(out).toContain(`${b.speaker} wrote:`);
  });

  describe("the WebRing", () => {
    const item = (kind: string, o: Partial<BuildItemVM> = {}): BuildItemVM => ({ kind, name: kind, short: kind, blurb: null, price: 1, priceText: "$1", free: false, affordable: true, hotkey: null, selected: false, race: false, built: 0, isBulldoze: false, isPath: false, ...o });
    const ring = [item("path"), item("cluster"), item("hall"), item("bulldoze"), item("staff")];

    it("starts at the first tool going Next and at the last going Prev", () => {
      expect(ringStep(ring, 1)).toBe("path");
      expect(ringStep(ring, -1)).toBe("bulldoze"); // the payroll tile is not part of the ring
    });

    it("goes round from the tool in hand, in both directions, and never runs out", () => {
      const on = (kind: string) => ring.map((i) => ({ ...i, selected: i.kind === kind }));
      expect(ringStep(on("path"), 1)).toBe("cluster");
      expect(ringStep(on("bulldoze"), 1)).toBe("path");
      expect(ringStep(on("path"), -1)).toBe("bulldoze");
    });

    it("skips what you cannot afford", () => {
      const poor = [item("path"), item("cluster", { affordable: false }), item("hall")];
      expect(ringStep([{ ...poor[0]!, selected: true }, poor[1]!, poor[2]!], 1)).toBe("hall");
      expect(ringStep([item("path", { affordable: false })], 1)).toBeNull();
    });
  });
});
