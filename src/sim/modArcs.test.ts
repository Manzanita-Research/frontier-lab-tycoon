// FLT-37: a mod's JSON arcs run in the sim, stepped purely at midnight and on every answered card.
import { Effect } from "effect";
import { composeMods } from "../mods/loader";
import { resolveGameDefinition, type GameDefinition } from "../mods/game-definition";
import { decodeManifest, type ArcData, type ModManifest } from "../mods/schema";
import starter from "../../templates/create-flt-mod/mod.json";
import { defs, withDefs } from "./defs";
import { disasterMenu, triggerDisaster } from "./disasters/driver";
import { enableLeapfrog } from "./race/leapfrog/driver";
import { openEventOf } from "./events";
import { createInitialState } from "./state";
import { answer } from "./testkit";
import { applyNow, tick } from "./tick";
import type { GameState } from "./types";
import { GUARD_NAMES, VERB_NAMES } from "./verbs";
import { ACTION_NAMES as SDK_ACTIONS, GUARD_NAMES as SDK_GUARDS } from "../../packages/flt-mod-sdk/src/index";
import { BASE_ARCS } from "../content/factions";

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
  it("an unmodded run only carries the base game's own arcs (FLT-25's water escalation, the factions')", () => {
    const s = createInitialState(1, "campus");
    for (let i = 0; i < 200; i++) tick(s);
    const base = new Set(BASE_ARCS.map((a) => a.id));
    for (const id of Object.keys(s.modArcs ?? {})) expect(base.has(id)).toBe(true);
    // A campus has earned Level 4, so its factions wake with it; a garage's sleep (their arcs store nothing) until then.
    expect(s.factions).toBeDefined();
    const garage = createInitialState(1, "garage");
    for (let i = 0; i < 200; i++) tick(garage);
    expect(garage.factions).toBeUndefined();
    expect(Object.keys(garage.modArcs ?? {}).some((id) => id.startsWith("fx:"))).toBe(false);
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

  it("counts after/every in midnights, and can pull staff off their posts and send them back", async () => {
    const drip: ArcData = {
      id: "drip", initial: "idle",
      states: {
        idle: { on: { DAY: { target: "drill", guard: [{ type: "day.after", params: { day: 1 } }, { type: "stat.gte", params: { stat: "janitor", value: 1 } }], actions: [{ type: "staff.divert", params: { job: "janitor", to: "gate" } }] } } },
        drill: { on: { DAY: [
          { target: "over", guard: { type: "after", params: { days: 3 } }, actions: [{ type: "staff.release" }] },
          { guard: { type: "every", params: { days: 1 } }, actions: [{ type: "news", params: { text: "Steve drill, day {cash}" } }] },
        ] } },
        over: { type: "final" },
      },
    };
    const def = await resolve([mod("drip", { arcs: { add: [drip] } })]);
    const s = createInitialState(5, "campus", def);
    applyNow(s, [{ type: "hire", job: "janitor" }, { type: "hire", job: "janitor" }], def);
    playTo(s, 2, def);
    expect(s.modArcs?.drip?.value).toBe("drill");
    expect(s.staff.filter((o) => o.job === "janitor").every((o) => o.divert?.owner === "drip")).toBe(true);
    playTo(s, 5, def);
    expect(s.modArcs?.drip?.value).toBe("over");
    expect(s.news.filter((n) => n.text.startsWith("Steve drill"))).toHaveLength(2);
    expect(s.staff.some((o) => o.divert?.owner === "drip")).toBe(false);
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

  it("disasters are a mod section: a new one runs, a shipped one can be renamed", async () => {
    const outage = {
      id: "steveOutage", name: "Steve Is Out Sick", blurb: "Every lab's Steve calls in sick at once.", tags: ["staff"],
      odds: { weight: 0.5, minDay: 30, gapDays: 30 }, initial: "warning",
      states: {
        warning: { entry: [{ type: "news", params: { text: "All the Steves are out today", tone: "joke" } }], on: { TICK: [{ guard: { type: "after", params: { hours: 2 } }, target: "active" }] } },
        active: { entry: [{ type: "card", params: { id: "soup" } }], on: { CHOSE: [{ guard: { type: "choice", params: { is: "soup" } }, target: "done", actions: [{ type: "hype.delta", params: { amount: 5 } }] }] } },
        done: { type: "final" },
      },
      cards: [{ id: "soup", title: "Steve Is Sick", body: "Send soup?", tone: "joke", choices: [{ key: "soup", label: "Send soup", hint: "Steve appreciates it.", effects: [] }] }],
    };
    const def = await resolve([mod("steve-outage", { disasters: { add: [outage], override: [{ id: "gpuFire", name: "Steve's GPU Fire" }] } })]);
    const s = createInitialState(3, "campus", def);
    withDefs(def, () => {
      expect(disasterMenu(s).map((r) => r.name)).toEqual(expect.arrayContaining(["Steve Is Out Sick", "Steve's GPU Fire"]));
      expect(defs().eventById("dz:steveOutage:soup")?.title).toBe("Steve Is Sick");
      expect(triggerDisaster(s, "steveOutage", { forced: true }).ok).toBe(true);
    });
    for (let i = 0; i < 200 && !openEventOf(s); i++) tick(s, [], def);
    expect(s.news.some((n) => n.text === "All the Steves are out today")).toBe(true);
    expect(openEventOf(s)?.id).toBe("dz:steveOutage:soup");
    for (let i = 0; i < 100 && s.disasters.runs.length > 0; i++) tick(s, withDefs(def, () => answer(s, () => 0)), def);
    expect(s.disasters.runs).toHaveLength(0);
    expect(s.disasters.history.at(-1)).toMatchObject({ id: "steveOutage" });
    // Unmodded, nobody has heard of it.
    expect(disasterMenu(createInitialState(3, "campus")).map((r) => r.name)).not.toContain("Steve Is Out Sick");
    await expect(resolve([mod("bad", { disasters: { add: [{ ...outage, states: { ...outage.states, warning: { on: { TICK: [{ guard: { type: "aftr" }, target: "active" }] } } } }] } })])).rejects.toThrow('did you mean "after"');
  });

  it("Release Leapfrog's benchmarks and mishaps are mod sections", async () => {
    const def = await resolve([mod("steve-bench", {
      benchmarks: { override: [{ id: "mmlu", name: "Steve's Last Exam", short: "SLE" }], add: [{ id: "steve2", name: "Steve's Last Exam 2", short: "SLE 2", kind: "score", difficulty: 150, replaces: "mmlu" }] },
      mishaps: { add: [{ id: "steveMic", weight: 1, voice: -2, headline: "{lab}'s livestream mic picks up Steve eating crisps" }] },
    })]);
    const s = createInitialState(2, "campus", def);
    withDefs(def, () => enableLeapfrog(s));
    expect(s.leapfrog.benchmarks.map((b) => b.def.name)).toContain("Steve's Last Exam");
    withDefs(def, () => {
      expect(defs().successorOf("mmlu")?.name).toBe("MMLU-Pro-Max-Ultra 2: Now With Reasoning");
      expect(defs().mishapById("steveMic")?.voice).toBe(-2);
    });
    await expect(resolve([mod("bad", { benchmarks: { add: [{ id: "x", name: "X", short: "X", kind: "score", difficulty: 1, replaces: "mmlo" }] } })])).rejects.toThrow('did you mean "mmlu"');
  });
});
