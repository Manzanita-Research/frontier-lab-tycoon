// FLT-71: "Start" is Start in every skin. The coach names controls ("Click Start.", "Press ▶▶"), so the controls it names say
// exactly that, and no skin renames a core control. Flavour lives in titles and body copy, never on the buttons.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COACH } from "../content/coach";
import { fixtureInput } from "../ui/hud/fixtures";
import type { HudActions } from "../ui/hud/types";
import { hudViewModel } from "../ui/hud/vm";
import { SkinProvider } from "./context";
import { BASE_ID, catalog, prepareSkin } from "./registry";
import { BASE_STRINGS } from "./schema";

const actions = new Proxy({}, { get: () => () => undefined }) as HudActions;
const vm = hudViewModel(fixtureInput());
const skins = [BASE_ID, ...catalog.filter((e) => e.ok).map((e) => e.folder)];

/** The labels on core controls (Start, OK, Cancel, Close, Pause, the speeds, Build, Settings, Help...). A skin may not override them. */
const CONTROL_KEYS = [
  "build.open", "build.close", "build.help", "build.settings", "build.display", "build.putAway",
  "speed.pause", "speed.1", "speed.3", "speed.10", "speed.short.1", "speed.short.3", "speed.short.10",
  "inspector.ok", "inspector.close", "training.cancel", "confirm.ok", "confirm.cancel",
  "coach.skip", "unlock.ok", "help.close", "help.replay", "skin.apply", "skin.cancel", "photo.done", "papers.close", "disasters.close",
];

const coachSays = (id: string) => COACH.find((c) => c.id === id)!.text;
/** The button carrying `data-coach="<id>"`, as [its attributes, its inner HTML]. Buttons do not nest. */
function target(html: string, id: string): [string, string] {
  const m = html.match(new RegExp(`<button([^>]*data-coach="${id}"[^>]*)>([\\s\\S]*?)</button>`));
  expect(m, `no button with data-coach="${id}"`).not.toBeNull();
  return [m![1]!, m![2]!];
}
const text = (inner: string) => inner.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

describe("the coach's words", () => {
  it("are what these tests expect", () => {
    expect(coachSays("start")).toMatch(/Click Start\./);
    expect(coachSays("speed")).toMatch(/Press ▶▶ /);
  });
});

describe.each(skins)("skin %s", (id) => {
  it("renames no core control", async () => {
    const entry = catalog.find((e) => e.folder === id);
    const overridden = Object.keys(entry?.manifest?.strings ?? {}).filter((k) => CONTROL_KEYS.includes(k));
    expect(overridden, "put the flavour in a title or the body copy, not on a control").toEqual([]);
    const { skin } = await prepareSkin(id);
    for (const k of CONTROL_KEYS) expect(skin.strings[k]).toBe(BASE_STRINGS[k]);
  });

  it('labels the Start button "Start", the word the coach says', async () => {
    const word = coachSays("start").match(/Click (\w+)\./)![1]!;
    const { skin } = await prepareSkin(id);
    const html = renderToString(
      <SkinProvider skin={skin}>
        <skin.slots.BuildBar items={vm.buildItems} tip={null} teasers={[]} layout={vm.layout} actions={actions} />
      </SkinProvider>,
    );
    const [, inner] = target(html, "start");
    expect(text(inner)).toMatch(new RegExp(`\\b${word}\\b`));
  });

  it("draws ▶▶ on the button the coach calls ▶▶ (the 3× speed)", async () => {
    const glyph = coachSays("speed").match(/Press (\S+) /)![1]!;
    const { skin } = await prepareSkin(id);
    const html = renderToString(
      <SkinProvider skin={skin}>
        <skin.slots.Speed speed={vm.speed} stats={vm.stats} actions={actions} />
      </SkinProvider>,
    );
    const [attrs, inner] = target(html, "speed");
    expect(inner.match(/<(polygon|path)\b/g)?.length, "one drawn triangle per ▶").toBe([...glyph].length);
    expect(attrs).toContain(`aria-label="${BASE_STRINGS["speed.3"]}"`);
  });
});
