// FLT-75: a mod's Koota trait and system, added through a Layer, running in the real tick.
import { Effect } from "effect";
import retriever from "../../../mods/examples/golden-retriever-protest/mod.json";
import { composeMods } from "../loader";
import { decodeManifest } from "../schema";
import { resolveSystems, withCompanions } from "../companions";
import { WagLevel } from "./golden-retriever-wag";
import { installSystems } from "../../sim/ecs/systems";
import { ground } from "../../sim/ecs/protesters";
import { answer, createTestCampus } from "../../sim/testkit";
import { tick } from "../../sim/tick";
import { TICKS_PER_DAY } from "../../sim/constants";
import { decodeSave, encodeSave, serialize } from "../../save";
import type { GameState } from "../../sim/types";

const decode = (input: unknown) => Effect.runPromise(decodeManifest(input));
const wagOf = (s: GameState) => new Map(ground(s).views().map((v) => [v.id, v.entity.has(WagLevel) ? v.entity.get(WagLevel)!.wag : -1]));

/** The test campus has a Kombucha Bar by the gate; `dry` takes it away. */
function run(dry = false): GameState {
  const s = createTestCampus(3);
  if (dry) s.buildings = s.buildings.filter((b) => b.kind !== "kombucha");
  s.waterDiscourse = 100;
  for (let i = 0; i < 6 * TICKS_PER_DAY; i++) tick(s, answer(s));
  return s;
}

describe("FLT-75: the golden retrievers' WagLevel (a Koota trait from a mod Layer)", () => {
  afterEach(() => installSystems([]));

  it("composes on top of the JSON mod's Layer, and the base game has no systems", async () => {
    const mod = await decode(retriever);
    const { layer } = composeMods([mod]);
    const ids = async (l: typeof layer) => (await Effect.runPromise(resolveSystems(l))).map((s) => s.id);
    expect(await ids(layer)).toEqual([]);
    expect(await ids(withCompanions(layer, ["golden-retriever-protest"]))).toEqual(["wag-near-kombucha"]);
    expect(await ids(withCompanions(layer, ["someone-else"]))).toEqual([]);
  });

  it("wags near the Kombucha Bar, not without one, settles when it breaks, says so at full wag, and replays the same", async () => {
    const mod = await decode(retriever);
    installSystems(await Effect.runPromise(resolveSystems(withCompanions(composeMods([mod]).layer, [mod.id]))));
    const s = run();
    const wag = wagOf(s);
    expect(wag.size).toBeGreaterThan(10);
    // Everyone at the gate can smell the bar, so they're all at full wag.
    expect(Math.min(...wag.values())).toBe(1);
    // No bar, no wag.
    const dry = wagOf(run(true));
    expect(dry.size).toBeGreaterThan(10);
    expect(Math.max(...dry.values())).toBe(0);
    expect(s.thoughts.some((t) => t.kind === "protester" && /KOMBUCHA|SCOBY|sniffing|fermented|the bar/.test(t.text))).toBe(true);
    expect(JSON.stringify(run())).toBe(JSON.stringify(s));
    // The wag saves with the dog, and comes back with it.
    const { world } = await Effect.runPromise(decodeSave(serialize(await Effect.runPromise(encodeSave(s)))));
    expect(wagOf(world)).toEqual(wag);
    expect(JSON.stringify(world)).toContain('"wag":1');
    // The bar breaks: tails settle, slowly.
    for (const b of s.buildings) if (b.kind === "kombucha") b.broken = true;
    for (let i = 0; i < 100; i++) tick(s, answer(s));
    for (const w of wagOf(s).values()) expect(w).toBeLessThan(0.7);
  }, 60_000);
});
