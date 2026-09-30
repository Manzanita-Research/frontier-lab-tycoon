// FLT-37: the resolved GameDefinition threaded through the sim. The base definition must be invisible (the goldens
// cover the no-def path; this covers "a def that equals the base"), and a mod must change the running game.
import { Effect } from "effect";
import { composeMods } from "../mods/loader";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { decodeManifest, type ModManifest } from "../mods/schema";
import steve from "../../mods/examples/every-lab-is-steve/mod.json";
import { RIVAL_DEFS } from "../content/rivals";
import { coachOf } from "./coach";
import { BASE_DEFS, defs, setSessionDefinition, withDefs } from "./defs";
import { headlinePool } from "./news";
import { boardView } from "./race/arena";
import { createRng } from "./rng";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { applyNow, tick } from "./tick";
import type { GameState } from "./types";

const mod = (id: string, content: ModManifest["content"] = {}): ModManifest => ({ apiVersion: 1, id, name: id, version: "1.0.0", content });
const resolve = async (mods: readonly unknown[]): Promise<GameDefinition> => {
  const decoded = await Promise.all(mods.map((m) => Effect.runPromise(decodeManifest(m))));
  return Effect.runPromise(resolveGameDefinition(composeMods(decoded).layer));
};

/** A campus that builds, trains, ships and answers every card: enough to touch every content lookup. */
function play(seed: number, days: number, def?: GameDefinition, opening: "garage" | "campus" = "campus"): GameState {
  const s = createInitialState(seed, opening, def);
  applyNow(s, [{ type: "placeBuilding", kind: "gateway", x: 7, z: 17 }, { type: "hire", job: "sre" }], def);
  for (let i = 0; i < days * 20 * 3 && s.day < days; i++) tick(s, withDefs(def, () => answer(s, (id) => (id === "computeAuction" ? 0 : 1))), def);
  return s;
}

describe("the resolved definition (FLT-37)", () => {
  it("a definition equal to the base changes nothing, byte for byte", async () => {
    const base = await resolve([]);
    for (const seed of [1, 42]) {
      for (const opening of ["garage", "campus"] as const) {
        expect(JSON.stringify(play(seed, 120, base, opening))).toBe(JSON.stringify(play(seed, 120, undefined, opening)));
      }
    }
  });

  it("Every Lab Is Steve renames the Arena, and only inside its own run", async () => {
    const def = await resolve([steve]);
    const s = createInitialState(7, "campus", def);
    const names = withDefs(def, () => boardView(s)).filter((r) => !r.you).map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["Steve (Safety-Flavoured)", "Steve (Formerly Non-Profit)", "Steve Superintelligence Labs"]));
    expect(withDefs(def, () => boardView(s)).filter((r) => r.short === "Steve")).toHaveLength(3);
    // Outside the call the base game is back.
    expect(boardView(s).map((r) => r.name)).toContain("Anthropomorphic");
    expect(RIVAL_DEFS[0]!.name).toBe("Anthropomorphic");
  });

  it("modded runs replay exactly", async () => {
    const def = await resolve([steve]);
    expect(JSON.stringify(play(3, 200, def))).toBe(JSON.stringify(play(3, 200, def)));
  });

  it("a new rival joins the race, widens the Arena and keeps 'top 3' meaning top 3", async () => {
    const def = await resolve([mod("more-steves", { rivals: { add: [{ ...RIVAL_DEFS[0]!, id: "steve", name: "Steve Prime", short: "Steve Prime" }] } })]);
    const s = createInitialState(1, "campus", def);
    expect(s.race.rivals.map((r) => r.context.id)).toContain("steve");
    expect(withDefs(def, () => defs().arenaSize)).toBe(RIVAL_DEFS.length + 2);
    const arena = withDefs(def, () => defs().goals.find((g) => g.metric === "arena"))!;
    expect(arena.target).toBe(BASE_DEFS.goals.find((g) => g.metric === "arena")!.target + 1);
    expect(s.goals.context.goals.find((g) => g.id === arena.id)!.target).toBe(arena.target);
    const after = play(1, 60, def);
    expect(withDefs(def, () => boardView(after)).some((r) => r.name === "Steve Prime")).toBe(true);
  });

  it("the coach and the ladder are mod sections", async () => {
    const def = await resolve([mod("coach", {
      coach: { override: [{ id: "start", text: "Hello from a mod. Click Start." }] },
      progression: { override: [{ id: "garage", goal: { text: "Ship two models", metric: "models", target: 2 } }] },
    })]);
    const s = createInitialState(1, "garage", def);
    expect(withDefs(def, () => coachOf(s))?.text).toBe("Hello from a mod. Click Start.");
    expect(coachOf(s)?.text).not.toBe("Hello from a mod. Click Start.");
  });

  it("names and conditional headlines come from the definition", async () => {
    const def = await resolve([mod("names", {
      names: { override: [{ id: "LAB_NAMES", values: ["Steve's Garage"] }, { id: "FIRST_NAMES", values: ["Steve"] }] },
      headlines: { add: [
        { id: "steve-later", trigger: "filler", tone: "joke", text: "Every Steve agrees", when: { "day.after": 10 } },
        { id: "never", trigger: "filler", tone: "joke", text: "This line never runs", when: { "flag.is": ["neverSet", true] } },
      ] },
    })]);
    const s = createInitialState(5, "garage", def);
    expect(s.labName).toBe("Steve's Garage");
    expect(s.walkers.filter((w) => w.kind === "researcher").every((w) => w.name.includes("Steve "))).toBe(true);
    const pool = () => withDefs(def, () => headlinePool(s, createRng(1), "filler")).map((h) => h.text);
    expect(pool()).not.toContain("Every Steve agrees");
    s.day = 11;
    expect(pool()).toContain("Every Steve agrees");
    expect(pool()).not.toContain("This line never runs");
    expect(play(2, 60, def).news.some((n) => n.text === "This line never runs")).toBe(false);
  });

  it("the session definition is what code outside a tick sees", async () => {
    const def = await resolve([steve]);
    try {
      setSessionDefinition(def);
      expect(defs().rivalById.anthro.name).toBe("Steve (Safety-Flavoured)");
      expect(boardView(createInitialState(1)).some((r) => r.short === "Steve")).toBe(true);
    } finally {
      setSessionDefinition(null);
    }
    expect(defs()).toBe(BASE_DEFS);
  });
});
