// Frontier 95's Task Mangler (the Arena) at the benchmark table (FLT-54): opened by the game it keeps to the right edge,
// opened by the player it takes its full width, every column showing.
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
const classesOf = (chosen: boolean) => {
  const input = fixtureInput({ leapfrog: true });
  const vm = hudViewModel({ ...input, arena: { ...input.arena, open: true, chosen } });
  const out = renderToString(
    <SkinProvider skin={skin}>
      <Arena arena={vm.arena} leapfrog={vm.leapfrog} layout={vm.layout} actions={actions} />
    </SkinProvider>,
  );
  return out.match(/class="(f95-win[^"]*f95-tasks[^"]*|f95-tasks[^"]*)"/)![1]!.split(/\s+/);
};

describe("Frontier 95's Task Mangler width", () => {
  it("keeps to the edge when the game opened it", () => {
    expect(classesOf(false)).toEqual(expect.arrayContaining(["f95-tasks", "open", "wide", "auto"]));
  });

  it("takes its full width when the player opened it", () => {
    const classes = classesOf(true);
    expect(classes).toEqual(expect.arrayContaining(["f95-tasks", "open", "wide"]));
    expect(classes).not.toContain("auto");
  });

  it("caps only the one the game opened, in the stylesheet", () => {
    const css = read("frontier-95/skin.css")!;
    expect(css).toMatch(/> \.f95-tasks\.wide \{\s*width: 100%;/);
    expect(css).toMatch(/> \.f95-tasks\.wide\.auto \{\s*width: min\(100%, max\(400px, calc\(30vw - 10px\)\)\);/);
  });
});
