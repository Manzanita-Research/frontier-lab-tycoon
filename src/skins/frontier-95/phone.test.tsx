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
      // "coached": the tutorial opened it, so the goal note leaves out its next step (FLT-93) and the map keeps its room.
      expect(out, `coach step ${step}`).toContain('class="f95-fold open coached"');
      expect(out, `coach step ${step}`).toContain("f95-foldbody");
    }
  });

  it("puts the tray icons and waiting windows behind the » measure, the rank and Speed outside it", () => {
    const out = render({ ...PHONE, leapfrog: true });
    const tray = out.slice(out.indexOf('class="f95-tray"'));
    // FLT-94: the leaderboard rank comes first and never hides.
    expect(tray).toMatch(/^class="f95-tray"><button[^>]*class="f95-rank[^"]*"[^>]*>.*?<\/button><div class="f95-more">/);
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

  it("gives the Staff Manager's Hire a thumb's height on a phone", () => {
    const phone = read("frontier-95/skin.css")!.split("@media (max-width: 640px)").slice(1).join("");
    expect(phone).toMatch(/\.f95-hire \.f95-btn \{\s*min-height: 32px;/);
  });

  it("keeps the bill's tilted Properties box off the Inspector, which shares its class", () => {
    const css = read("frontier-95/skin.css")!;
    expect(css).not.toMatch(/^\s*\.f95-props \{\s*position: absolute;/m);
    expect(css).toMatch(/\.f95-docwrap \.f95-props \{\s*position: absolute;/);
  });
});
