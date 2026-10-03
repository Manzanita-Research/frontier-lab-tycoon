// FLT-101's generic verbs: set dressing on a building (lights out, a prop on the door), a nudge to the Vibes, and a
// camera beat that brings its own kicker.
import { describe, expect, it } from "vitest";
import { TICKS_PER_DAY } from "./constants";
import { createRng } from "./rng";
import { createInitialState } from "./state";
import { checkCall, runVerb, type VerbEnv } from "./verbs";
import type { GameState } from "./types";

const env = (s: GameState): VerbEnv => ({ state: s, rng: createRng(7), run: null, owner: "mod:test" });

describe("set dressing and nudges (FLT-101)", () => {
  it("building.lights darkens a building by kind for some hours, and turns them back on", () => {
    const s = createInitialState(1);
    const cluster = s.buildings.find((b) => b.kind === "cluster")!;
    runVerb(env(s), { type: "building.lights", params: { building: "cluster", off: true, hours: 12 } });
    expect(s.dressing).toEqual([{ building: cluster.id, dark: true, until: s.tick + TICKS_PER_DAY / 2 }]);
    runVerb(env(s), { type: "building.lights", params: { building: "cluster", off: false } });
    expect(s.dressing).toEqual([]);
  });

  it("building.prop hangs one prop per kind per door, and old dressing falls away when the next is hung", () => {
    const s = createInitialState(1);
    const cluster = s.buildings.find((b) => b.kind === "cluster")!;
    runVerb(env(s), { type: "building.prop", params: { building: "cluster", prop: "sock" } });
    runVerb(env(s), { type: "building.prop", params: { building: "cluster", prop: "sock", hours: 48 } });
    expect(s.dressing).toEqual([{ building: cluster.id, prop: "sock", until: s.tick + 2 * TICKS_PER_DAY }]);
    s.tick += 3 * TICKS_PER_DAY;
    runVerb(env(s), { type: "building.prop", params: { building: "cluster", prop: "dnd", hours: 1 } });
    expect(s.dressing!.map((d) => d.prop)).toEqual(["dnd"]);
  });

  it("dresses nothing for a building the lab has not built, and checks the prop's name", () => {
    const s = createInitialState(1);
    runVerb(env(s), { type: "building.prop", params: { building: "honeypot", prop: "sock" } });
    expect(s.dressing).toBeUndefined();
    expect(checkCall({ type: "building.prop", params: { building: "cluster", prop: "tie" } }, "verb", "x")[0]).toMatch(/unknown prop "tie"; props are sock, dnd/);
    expect(checkCall({ type: "building.lights", params: { building: "cluster", off: true } }, "verb", "x")).toEqual([]);
  });

  it("vibes.delta nudges the Vibes now, inside 0 to 999", () => {
    const s = createInitialState(1);
    const was = s.vibes.value;
    runVerb(env(s), { type: "vibes.delta", params: { amount: 40 } });
    expect(s.vibes.value).toBe(Math.min(999, was + 40));
    runVerb(env(s), { type: "vibes.delta", params: { amount: -5000 } });
    expect(s.vibes.value).toBe(0);
  });

  it("camera.beat carries a kicker when it has one, filled in like the caption", () => {
    const s = createInitialState(1);
    runVerb(env(s), { type: "camera.beat", params: { kind: "fade", caption: "Later.", kicker: "Meanwhile, at {lab}", on: "cluster" } });
    const cue = s.disasters.cues.at(-1)!;
    expect(cue).toMatchObject({ type: "beat", beat: "fade", caption: "Later.", kicker: `Meanwhile, at ${s.labName}` });
    runVerb(env(s), { type: "camera.beat", params: { kind: "exit", caption: "Bye.", on: "cluster" } });
    expect(s.disasters.cues.at(-1)).not.toHaveProperty("kicker");
  });
});
