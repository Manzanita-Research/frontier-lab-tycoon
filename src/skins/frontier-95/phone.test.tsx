// Frontier 95 on a phone (FLT-87): Training, the goal and the Objectives fold into one strip so the campus shows, the tray
// sits behind a » when it runs out of room, and every title-bar button is a thumb wide. A desktop renders as it did.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput, type FixtureOptions } from "../../ui/hud/fixtures";
import { Docked } from "../../ui/hud/tree";
import type { HudActions } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { read } from "../files";
import { prepareSkin } from "../registry";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const { skin } = await prepareSkin("frontier-95");
const PHONE = { width: 390, height: 844 };
const render = (o: FixtureOptions) =>
  renderToString(
    <SkinProvider skin={skin}>
      <Docked vm={hudViewModel(fixtureInput(o))} actions={actions} />
    </SkinProvider>,
  );

describe("Frontier 95 on a phone", () => {
  it("folds Training, the goal and the Objectives into one strip, closed", () => {
    const out = render({ ...PHONE, level: 4, coach: null });
    expect(out).toContain('class="f95-fold"');
    expect(out).toMatch(/<button[^>]*class="f95-foldbar"[^>]*aria-expanded="false"/);
    expect(out).not.toContain("f95-foldbody");
  });

  it("opens the fold when the coach points inside it (the fixture's training and goals lines)", () => {
    for (const step of [3, 6]) {
      const out = render({ ...PHONE, level: 1, coach: step });
      expect(out, `coach step ${step}`).toContain('class="f95-fold open"');
      expect(out, `coach step ${step}`).toContain("f95-foldbody");
    }
  });

  it("puts the tray icons and waiting windows behind the » measure, Speed outside it", () => {
    const out = render({ ...PHONE, leapfrog: true });
    const tray = out.slice(out.indexOf('class="f95-tray"'));
    expect(tray).toMatch(/^class="f95-tray"><div class="f95-more">/);
    expect(tray.indexOf("f95-more")).toBeLessThan(tray.indexOf("f95-speed"));
  });

  it("leaves a desktop as it was: no fold, no measure", () => {
    const out = render({ leapfrog: true });
    expect(out).not.toContain("f95-fold");
    expect(out).not.toContain("f95-more");
  });

  it("gives every title-bar button 32 x 32 on a phone and under a finger", () => {
    const css = read("frontier-95/skin.css")!;
    const blocks = [css.slice(css.indexOf("@media (pointer: coarse)")), css.slice(css.indexOf("@media (max-width: 640px)"))];
    for (const block of blocks) expect(block).toMatch(/\.f95-b \{\s*min-width: 32px;\s*height: 32px;/);
  });
});
