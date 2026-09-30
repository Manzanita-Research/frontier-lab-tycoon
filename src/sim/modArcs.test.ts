// FLT-37: a mod's JSON arcs run in the sim, stepped purely at midnight and on every answered card.
import { Effect } from "effect";
import { composeMods } from "../mods/loader";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { decodeManifest, type ArcData, type ModManifest } from "../mods/schema";
import starter from "../../templates/create-flt-mod/mod.json";
import { withDefs } from "./defs";
import { openEventOf } from "./events";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { tick } from "./tick";
import type { GameState } from "./types";
import { GUARD_NAMES, VERB_NAMES } from "./verbs";
import { ACTION_NAMES as SDK_ACTIONS, GUARD_NAMES as SDK_GUARDS } from "../../packages/flt-mod-sdk/src/index";

const mod = (id: string, content: ModManifest["content"] = {}): ModManifest => ({ apiVersion: 1, id, name: id, version: "1.0.0", content });
const resolve = async (mods: readonly unknown[]): Promise<GameDefinition> => {
  const decoded = await Promise.all(mods.map((m) => Effect.runPromise(decodeManifest(m))));
  return Effect.runPromise(resolveGameDefinition(composeMods(decoded).layer));
};

/** Ticks until `day`, answering every card with `pick`. */
function playTo(s: GameState, day: number, def?: GameDefinition, pick = 0) {
  for (let i = 0; i < day * 20 * 3 && s.day < day; i++) tick(s, withDefs(def, () => answer(s, () => pick)), def);
  return s;
}

const card = { id: "steve-card", title: "Steve Calls", body: "Steve would like a word.", tone: "joke" as const, when: { stat: "day" as const, atLeast: 100000 }, choices: [
  { label: "Take the call", hint: "It is Steve.", effects: [] },
  { label: "Let it ring", hint: "It is still Steve.", effects: [] },
] };

/** Pays out after day 3, then (a compound state) opens a card on day 6 and remembers the answer. */
const arc: ArcData = {
  id: "steve-arc",
  initial: "quiet",
  states: {
    quiet: { on: { DAY: { target: "story", guard: { type: "day.after", params: { day: 3 } }, actions: [{ type: "cash.delta", params: { amount: 1234 } }, { type: "news", params: { text: "{lab} hears from Steve", tone: "joke" } }] } } },
    story: {
      initial: "waiting",
      entry: [{ type: "flag.set", params: { name: "steveStory" } }],
      exit: [{ type: "toast", params: { text: "Steve hangs up" } }],
      states: {
        waiting: { on: { DAY: { target: "ringing", guard: { type: "day.after", params: { day: 5 } }, actions: [{ type: "card", params: { id: "steve-card" } }] } } },
        ringing: {},
      },
      on: {
        CHOSE: [
          { target: "answered", guard: { type: "choice", params: { card: "steve-card", is: "0" } } },
          { target: "ignored", guard: { type: "choice", params: { card: "steve-card", is: "1" } } },
        ],
      },
    },
    answered: { type: "final" as const, entry: [{ type: "hype.delta", params: { amount: 7 } }] },
    ignored: { type: "final" as const },
  },
};

describe("mod arcs (FLT-37)", () => {
  it("an unmodded run has no arc state at all", () => {
    const s = createInitialState(1, "campus");
    for (let i = 0; i < 200; i++) tick(s);
    expect(s.modArcs).toBeUndefined();
  });

  it("step at midnight, run their actions in order, open cards and hear the answer", async () => {
    const def = await resolve([mod("steve-arc", { events: { add: [card] }, arcs: { add: [arc] } })]);
    const s = createInitialState(1, "campus", def);
    playTo(s, 3, def);
    expect(s.modArcs?.["steve-arc"]?.value).toBe("quiet");
    const cash = s.cash;
    playTo(s, 4, def);
    expect(s.modArcs?.["steve-arc"]?.value).toBe("story/waiting");
    expect(s.flags.steveStory).toBe(4);
    expect(s.news.some((n) => n.text === `${s.labName} hears from Steve`)).toBe(true);
    // The payout lands on day 4, alongside the day's own income and upkeep.
    expect(Math.abs(s.cash - cash - 1234)).toBeLessThan(Math.abs(s.ledger.net) + 1e-6);
    // Day 6: the card opens (its own `when` never holds: only the arc can open it).
    for (let i = 0; i < 400 && s.day < 6; i++) tick(s, [], def);
    expect(s.modArcs?.["steve-arc"]?.value).toBe("story/ringing");
    expect(openEventOf(s)?.id).toBe("steve-card");
    const hype = s.hype;
    tick(s, withDefs(def, () => answer(s, () => 0)), def);
    expect(s.modArcs?.["steve-arc"]?.value).toBe("answered");
    expect(s.hype).toBeGreaterThanOrEqual(Math.min(100, hype + 7) - 1);
    expect(s.toasts.some((t) => t.text === "Steve hangs up")).toBe(true);
    expect(s.flags["ask:steve-card"]).toBeUndefined();
  });

  it("the other choice takes the other branch, and modded runs replay exactly", async () => {
    const def = await resolve([mod("steve-arc", { events: { add: [card] }, arcs: { add: [arc] } })]);
    const a = playTo(createInitialState(9, "campus", def), 12, def, 1);
    expect(a.modArcs?.["steve-arc"]?.value).toBe("ignored");
    expect(JSON.stringify(playTo(createInitialState(9, "campus", def), 12, def, 1))).toBe(JSON.stringify(a));
  });

  it("chance draws a die only for arcs that roll one", async () => {
    const coin = { id: "coin", initial: "flip", states: { flip: { on: { DAY: [{ target: "heads", guard: { type: "chance", params: { p: 0.5 } } }] } }, heads: { type: "final" as const } } };
    const def = await resolve([mod("coin", { arcs: { add: [coin] } })]);
    const heads = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => playTo(createInitialState(seed, "campus", def), 1, def).modArcs?.coin?.value);
    expect(heads).toContain("heads");
    expect(heads).toContain("flip");
    // A deterministic arc leaves the random stream alone: the lab's own dice fall where they did.
    const calm = await resolve([mod("calm", { arcs: { add: [{ id: "calm", initial: "on", states: { on: { on: { DAY: { actions: [{ type: "flag.set", params: { name: "calm" } }] } } } } }] } })]);
    expect(playTo(createInitialState(4, "campus", calm), 20, calm).rngState).toBe(playTo(createInitialState(4, "campus"), 20).rngState);
  });

  it("the starter template's arc opens its card after day 20", async () => {
    const def = await resolve([starter]);
    const s = playTo(createInitialState(1, "campus", def), 25, def);
    expect(s.modArcs?.["fetch-arc"]?.value).toBe("resolved");
    expect(s.flags["ball-thrown"]).toBeDefined();
  });

  it("the SDK's names are the sim's Vocabulary", () => {
    expect([...SDK_GUARDS].sort()).toEqual([...GUARD_NAMES].sort());
    expect([...SDK_ACTIONS].sort()).toEqual([...VERB_NAMES].sort());
  });

  it("the loader checks arc parameters, card ids and event names", async () => {
    const one = (states: object) => resolve([mod("bad", { events: { add: [card] }, arcs: { add: [{ id: "bad", initial: "a", states: { a: states, b: { type: "final" } } }] } })]);
    await expect(one({ on: { DAY: { target: "b", actions: [{ type: "cash.delta", params: { amout: 5 } }] } } })).rejects.toThrow('did you mean "amount"');
    await expect(one({ on: { DAY: { target: "b", actions: [{ type: "card", params: { id: "stev-card" } }] } } })).rejects.toThrow('did you mean "steve-card"');
    await expect(one({ on: { DAYS: "b" } })).rejects.toThrow('did you mean "DAY"');
    await expect(one({ on: { DAY: { target: "b", guard: { type: "stat.gte", params: { stat: "hipe", value: 1 } } } } })).rejects.toThrow('did you mean "hype"');
  });
});
