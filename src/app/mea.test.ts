// FLT-101: the Maximally Effective Altruists example mod, loaded the way `?mod=` loads it, and every beat's one-click
// `?moment=arc:mea-story:<state>` link landing on its beat: the card open, the lights out, the sock on the door, the posts up.
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import mea from "../../mods/examples/maximally-effective-altruists/mod.json";
import script from "../../docs/specs/FLT-101-script.md?raw";
import { composeMods } from "../mods/loader";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { decodeManifest } from "../mods/schema";
import { runHeadless } from "../mods/headless";
import { withDefs } from "../sim/defs";
import { openEventOf } from "../sim/events";
import { fixtureInput } from "../ui/hud/fixtures";
import { hudViewModel } from "../ui/hud/vm";
import { createSimHandle } from "./sim";

const resolve = async (): Promise<GameDefinition> => Effect.runPromise(resolveGameDefinition(composeMods([await Effect.runPromise(decodeManifest(mea))]).layer));
const staged = (def: GameDefinition, state: string) => createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment: `arc:mea-story:${state}` }, def);
const hud = (def: GameDefinition, handle: ReturnType<typeof staged>) => withDefs(def, () => hudViewModel({ ...fixtureInput(), snap: handle.report(true, true)!.snap! }));
/** Every string a player can read in a mod: its name and description, and every text field under `content`. */
const NOT_SHOWN = new Set(["id", "kind", "type", "target", "color", "tone", "archetype", "outcome", "role", "on", "building", "prop", "cue", "flag", "style", "is", "card", "initial", "when", "requires", "from", "to"]);
const shown = (x: unknown, key = ""): string[] =>
  typeof x === "string" ? (NOT_SHOWN.has(key) ? [] : [x]) : Array.isArray(x) ? x.flatMap((v) => shown(v, key)) : x && typeof x === "object" ? Object.entries(x).flatMap(([k, v]) => shown(v, k)) : [];
const manorOf = (w: { buildings: { kind: string; id: number }[] }) => w.buildings.find((b) => b.kind === "manor");

describe("Maximally Effective Altruists (FLT-101)", () => {
  it("arrival: Utilsbury Manor stands beside the gate, and the camera goes to look", async () => {
    const def = await resolve();
    const w = staged(def, "arrival").world;
    expect(manorOf(w)).toBeDefined();
    expect(w.modArcs!["mea-story"]!.value).toBe("arrival");
    expect(w.news.some((n) => n.text.includes("Utilsbury Manor"))).toBe(true);
  });

  it("invited: the retreat card is open with its three answers", async () => {
    const def = await resolve();
    const h = staged(def, "invited");
    expect(openEventOf(h.world)?.id).toBe("mea-convening");
    const vm = hud(def, h);
    expect(vm.event?.choices.map((c) => c.label)).toEqual(["Attend the Convening", "Run the numbers first", "Decline (your EV drops)"]);
  });

  it("each answer to the invitation moves the Vibes and Hype its own way, and packs for the night", async () => {
    const def = await resolve();
    const moved = [0, 1, 2].map((pick) => {
      const h = staged(def, "invited");
      const vibes = h.world.vibes.value, hype = h.world.hype;
      h.step(1, [{ type: "chooseEvent", eventId: "mea-convening", choiceIndex: pick }]);
      expect(h.world.modArcs!["mea-story"]!.value).toBe("packing");
      return [Math.sign(h.world.vibes.value - vibes), Math.sign(h.world.hype - hype)];
    });
    expect(moved).toEqual([[1, 1], [1, 1], [-1, -1]]);
  });

  it("convening: a fade beat on the manor, its lights out, and a door closing", async () => {
    const def = await resolve();
    const w = staged(def, "convening").world;
    const manor = manorOf(w)!;
    expect(w.dressing).toEqual(expect.arrayContaining([expect.objectContaining({ building: manor.id, dark: true })]));
    const beat = w.disasters.cues.find((c) => c.type === "beat");
    expect(beat).toMatchObject({ beat: "fade", kicker: "Later that evening, at Utilsbury Manor" });
    expect(w.disasters.cues.some((c) => c.type === "sound" && c.cue === "mea.door")).toBe(true);
  });

  it("sock: a sock on the Cluster door, and a plain cut back to the lab to see it", async () => {
    const def = await resolve();
    const w = staged(def, "sock").world;
    const cluster = w.buildings.find((b) => b.kind === "cluster")!;
    expect(w.dressing).toEqual(expect.arrayContaining([expect.objectContaining({ building: cluster.id, prop: "sock" })]));
    expect(w.disasters.cues.find((c) => c.type === "beat")).toMatchObject({ beat: "cut", kicker: `Meanwhile, back at ${w.labName}` });
  });

  it("leaked: the Sankey leaks, Trust drops, and the card shows the chart in Sankey Panky 95", async () => {
    const def = await resolve();
    const before = staged(def, "packing").world.disasters.trust;
    const h = staged(def, "leaked");
    expect(openEventOf(h.world)?.id).toBe("mea-leak");
    expect(h.world.disasters.trust).toBeLessThan(before);
    const doc = hud(def, h).event?.drama;
    expect(doc).toMatchObject({ style: "sankey", app: "Sankey Panky 95", file: "Retreat Attendance Flow (FINAL_v7).sankey" });
    const chart = doc!.chart!;
    expect(chart.units).toBe("expected hugs");
    expect(chart.columns).toBe(3);
    expect(chart.headings.map((x) => x.text)).toEqual(["Who", "Breakout session", "Ended up in"]);
    // The lab's own delegation is on it, by name.
    expect(chart.nodes.find((n) => n.id === "lab")!.label).toBe(h.world.labName);
    // The joke is that the Hot Tub is the widest thing on the page.
    const hottub = chart.nodes.find((n) => n.id === "hottub")!;
    expect(Math.max(...chart.nodes.filter((n) => n.column === 2).map((n) => n.value))).toBe(hottub.value);
  });

  it("pileon: the Bird App piles on, the lab's posters and a rival's", async () => {
    const def = await resolve();
    const w = staged(def, "pileon").world;
    expect(w.birdapp?.enabled).toBe(true);
    const texts = [...(w.birdapp?.posts ?? []).map((p) => p.text), ...(w.birdapp?.rivals?.posts ?? []).map((p) => p.text)];
    expect(texts).toEqual(expect.arrayContaining(["The real alignment problem was the rooming spreadsheet all along.", "We also convene. In a conference room. With the lights on."]));
  });

  it("crisis: the Comms Desk's draft statement, and the Senate's question on the ticker", async () => {
    const def = await resolve();
    const h = staged(def, "crisis");
    expect(openEventOf(h.world)?.id).toBe("mea-statement");
    expect(hud(def, h).event?.drama).toMatchObject({ style: "email", from: "Comms Desk" });
    expect(h.world.news.some((n) => n.text.includes("define \"convening\" under oath"))).toBe(true);
  });

  it("the script for review lists every line the mod can show (docs/specs/FLT-101-script.md)", () => {
    // A drama doc's `from`/`to` are shown, but so are flow ends (node ids); the doc's are checked by hand here.
    const lines = [mea.name, mea.description, ...shown(mea.content), "Comms Desk", "Everyone at {lab}"];
    expect(lines.length).toBeGreaterThan(120);
    expect(lines.filter((l) => !script.includes(l))).toEqual([]);
  });

  it("a lab that just plays reaches the end of the story, the same way twice", async () => {
    const def = await resolve();
    const a = runHeadless(def, { days: 200, seed: 4 });
    expect(a.arcStates["mea-story"]).toBe("done");
    expect(a.state.buildings.some((b) => (b.kind as string) === "manor")).toBe(true);
    expect(JSON.stringify(runHeadless(def, { days: 200, seed: 4 }).state)).toBe(JSON.stringify(a.state));
  });
});
