// Swag Drop's own promises: the badge says who is wearing it, the pins carry the lab's numbers, the memo is stamped.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureInput, fixtureWorld } from "../ui/hud/fixtures";
import { Docked, Modals } from "../ui/hud/tree";
import type { HudActions } from "../ui/hud/types";
import { hudViewModel } from "../ui/hud/vm";
import { SkinProvider } from "./context";
import { prepareSkin } from "./registry";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const world = fixtureWorld();

async function render(opts: Parameters<typeof fixtureInput>[0]) {
  const { skin } = await prepareSkin("swag-drop");
  const vm = hudViewModel(fixtureInput({ world, ...opts }));
  const html = renderToString(
    <SkinProvider skin={skin}>
      <Docked vm={vm} actions={actions} />
      <Modals vm={vm} actions={actions} />
    </SkinProvider>,
  );
  return { html, vm };
}

describe("Swag Drop", () => {
  it("hangs a researcher on the all-hands lanyard, and an agent on the cyan contractor one", async () => {
    const researcher = world.walkers.find((w) => w.kind === "researcher")!;
    const agent = world.walkers.find((w) => w.kind === "agent")!;
    const r = await render({ selected: researcher.id });
    expect(r.html).toContain("sd-lanyard kind-researcher");
    expect(r.html).toContain("ALL-HANDS ACCESS");
    expect(r.html).not.toContain("CONTRACTOR (NON-HUMAN)");
    const a = await render({ selected: agent.id });
    expect(a.html).toContain("sd-lanyard kind-agent");
    expect(a.html).toContain("CONTRACTOR (NON-HUMAN)");
  });

  it("keeps the badge's back face out of reach until it is flipped", async () => {
    const { html } = await render({});
    // Front is live, back is aria-hidden and inert (React writes `inert=""`).
    expect(html).toMatch(/sd-face front"[^>]*aria-hidden="false"/);
    expect(html).toMatch(/sd-face back"[^>]*aria-hidden="true"[^>]*inert=""/);
  });

  it("puts the lab's numbers on pins, sticky notes and a dial", async () => {
    const { html, vm } = await render({});
    expect(html).toContain("sd-badge hero");
    expect(html).toContain(vm.stats.runway.text);
    expect(html).toContain("sd-gauge");
    for (const g of vm.objectives.items) expect(html).toContain(g.label.replace(/&/g, "&amp;"));
    expect((html.match(/class="sd-sticky /g) ?? []).length).toBe(vm.objectives.items.length);
    expect(html).toContain("sd-key build");
  });

  it("carries the coach-mark hooks the playable v1 spotlights (a no-op for looks)", async () => {
    const { html, vm } = await render({});
    expect(html).toContain('data-coach="start"');
    expect(html).toContain('data-coach="training"');
    expect(html).toContain('data-coach="stat:runway"');
    expect(html).toContain('data-coach="goals"');
    // One `build:<kind>` per item the VM gives (the palette is filtered by unlock level, so nothing is hard-coded).
    for (const it of vm.buildItems) expect(html).toContain(`data-coach="build:${it.kind}"`);
  });

  it("stamps the event memo by its tone", async () => {
    const { html, vm } = await render({ event: "waterDiscourse" });
    expect(vm.event?.tone).toBe("bad");
    expect(html).toContain("sd-memo tone-bad");
    expect(html).toContain("URGENT");
    for (const c of vm.event!.choices) expect(html).toContain(c.label.replace(/'/g, "&#x27;"));
  });
});
