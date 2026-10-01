// FLT-83: `?moment=queue` crashed the game on main, and nothing noticed, because a staging link is only ever opened by
// hand or by the screenshot script. These load every `?moment=` the code knows the way the game does on boot (stage the
// World, publish the first snapshot, build the HUD from it) and then play two days, answering any card that opens.
import { describe, expect, it } from "vitest";
import shots from "../../scripts/shots.scenes.json";
import { defs } from "../sim/defs";
import { TICKS_PER_DAY } from "../sim/tick";
import { answer } from "../sim/testkit";
import { fixtureInput } from "../ui/hud/fixtures";
import { hudViewModel } from "../ui/hud/vm";
import { createSimHandle, STAGED_MOMENTS } from "./sim";

const withArgs = () => [...STAGED_MOMENTS, ...defs().mishaps.map((m) => `stream:${m.id}`), ...defs().rivals.map((r) => `poach-offer:${r.id}`)];

function load(moment: string) {
  const handle = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment });
  const first = handle.report(true, true);
  expect(first?.snap).toBeDefined();
  hudViewModel({ ...fixtureInput(), snap: first!.snap! });
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) handle.step(1, answer(handle.world));
  const later = handle.report(true, true);
  hudViewModel({ ...fixtureInput(), snap: later!.snap! });
  return handle.world;
}

describe("every ?moment= staging link loads", () => {
  it.each(withArgs())("%s", (moment) => {
    expect(() => load(moment)).not.toThrow();
  });

  it("the queue moment has its line at the Kombucha Bar", () => {
    const w = createSimHandle({ seed: 1, warp: 0, agents: 0, discourse: 0, researchers: 0, moment: "queue" }).world;
    const bar = w.buildings.find((b) => b.kind === "kombucha");
    expect(bar).toBeDefined();
    const queuing = w.walkers.filter((x) => x.targetId === bar!.id && x.machine.value === "queuing").length;
    expect(queuing).toBeGreaterThanOrEqual(4);
  });

  it("every moment a screenshot scene uses is one the game knows", () => {
    const used = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) k === "moment" && typeof x === "string" ? used.add(x) : walk(x);
    };
    walk(shots);
    const known = new Set(withArgs());
    expect([...used].filter((m) => !known.has(m))).toEqual([]);
  });
});
