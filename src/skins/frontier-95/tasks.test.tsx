// Frontier 95's Task Mangler (the Arena). FLT-94: it opens on the leaderboard whoever opened it (the player, the tray's
// rank, the game after a drop or a launch); the benchmark table is a tab away. At the benchmark table (FLT-54) the one
// the game opened keeps to the right edge and the one the player opened takes its full width, every column showing.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput } from "../../ui/hud/fixtures";
import type { HudActions } from "../../ui/hud/types";
import { hudViewModel } from "../../ui/hud/vm";
import { SkinProvider } from "../context";
import { read } from "../files";
import { prepareSkin } from "../registry";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const { skin } = await prepareSkin("frontier-95");
const { Arena } = skin.slots;
const render = (chosen: boolean) => {
  const input = fixtureInput({ leapfrog: true });
  const vm = hudViewModel({ ...input, arena: { ...input.arena, open: true, chosen } });
  return renderToString(
    <SkinProvider skin={skin}>
      <Arena arena={vm.arena} leapfrog={vm.leapfrog} layout={vm.layout} actions={actions} />
    </SkinProvider>,
  );
};
const classesOf = (out: string) => out.match(/class="(f95-win[^"]*f95-tasks[^"]*|f95-tasks[^"]*)"/)![1]!.split(/\s+/);

describe("Frontier 95's Task Mangler", () => {
  it("opens on the leaderboard when the game opened it, kept to the edge", () => {
    const out = render(false);
    expect(classesOf(out)).toEqual(expect.arrayContaining(["f95-tasks", "open", "auto"]));
    expect(classesOf(out)).not.toContain("wide");
    expect(out).toMatch(/role="table" aria-label="[^"]*"/);
    expect(out).toMatch(/aria-selected="true"[^>]*>[^<]*Arena/);
  });

  it("opens on the leaderboard when the player opened it too", () => {
    const out = render(true);
    expect(classesOf(out)).toEqual(expect.arrayContaining(["f95-tasks", "open"]));
    expect(classesOf(out)).not.toContain("auto");
    expect(classesOf(out)).not.toContain("wide");
    expect(out).toContain('data-anchor="win:arena"');
  });

  it("caps only the benchmark table the game opened, in the stylesheet", () => {
    const css = read("frontier-95/skin.css")!;
    expect(css).toMatch(/> \.f95-tasks\.wide \{\s*width: 100%;/);
    expect(css).toMatch(/> \.f95-tasks\.wide\.auto \{\s*width: min\(100%, max\(400px, calc\(30vw - 10px\)\)\);/);
  });
});
