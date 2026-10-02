import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Jar, ORIGIN, startWorker } from "./harness";
import { makeSaveDesk, type SaveDesk } from "../src/app/saves";
import { decodeSave, makeSaveStore, memoryStorage, serialize } from "../src/save";
import { createMidgameScenario } from "../src/sim/scenarios/midgame";
import { createInitialState } from "../src/sim/state";
import type { GameState } from "../src/sim/types";
import type { Slot } from "../src/account/contract";
import { makeCloudApi } from "../src/account/cloud/api";
import { createCloud, markAway, type GamePort, type Timers } from "../src/account/cloud/controller";

// FLT-67's round trip, with everything real but the browser: the prod Worker in workerd with its D1 and R2, Hugging
// Face mocked, FLT-65's save desk and codec, and the cloud client. A player logs on, saves, loses this computer's
// storage, logs on again, and the lab comes back. (e2e/accounts.mjs plays the same story in a browser, box and all.)

let w: Awaited<ReturnType<typeof startWorker>>;
beforeAll(async () => {
  w = await startWorker({ sub: "777", name: "Ada Founder", preferred_username: "ada", picture: "https://example.com/ada.png" });
}, 60_000);
afterAll(async () => {
  await w?.mf.dispose();
});

/** Log on with Hugging Face (the fake one): the OAuth dance, then a jar holding the session cookie. */
async function logOn() {
  const jar = new Jar();
  const start = jar.take(
    await w.fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ provider: "huggingface", callbackURL: "/?logon=ok" }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  jar.take(await w.fetch(`/api/auth/callback/huggingface?code=good-code&state=${state}`, { headers: { cookie: jar.header() }, redirect: "manual" }));
  expect(jar.has("session_token")).toBe(true);
  return makeCloudApi((path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("cookie", jar.header());
    headers.set("origin", ORIGIN);
    return w.fetch(path, { ...init, headers });
  });
}

/** Timers that run as soon as the test lets them: the debounce and gaps are the sync tests' business. */
function soon(): Timers & { settle(until: () => boolean): Promise<void> } {
  let tasks: (() => void)[] = [];
  return {
    later: (f) => {
      tasks.push(f);
      return () => void (tasks = tasks.filter((t) => t !== f));
    },
    /** Run what's scheduled, as it gets scheduled, until `until()` holds (an upload or a load is a real round trip). */
    async settle(until) {
      for (let i = 0; i < 1500 && !(until() && tasks.length === 0); i++) {
        await new Promise((r) => setTimeout(r, 10));
        const run = tasks;
        tasks = [];
        for (const f of run) f();
      }
      expect(until()).toBe(true);
    },
  };
}

/** A computer: its localStorage, FLT-65's desk on it, and the game's "Welcome back" as bootSaves runs it. */
function computer() {
  const storage = memoryStorage();
  const desk: SaveDesk = makeSaveDesk(makeSaveStore(storage));
  const shelf = { booted: false, welcome: false };
  const listeners = new Set<() => void>();
  const loaded: GameState[] = [];
  const holds: boolean[] = [];
  const port: GamePort = {
    ready: Promise.resolve(),
    onSaved: (f) => desk.subscribe((r) => r.meta && r.slot !== "pending" && f(r.slot as Slot, r.why)),
    read: (slot) => Effect.runPromise(desk.store.read(slot).pipe(Effect.map(serialize), Effect.orElseSucceed(() => null))),
    local: () => desk.store.list().flatMap((l) => (l.meta ? [{ slot: l.slot, savedAt: l.meta.savedAt, seed: l.meta.seed, lab: l.meta.lab, day: l.meta.day }] : [])),
    shelf: () => ({ ...shelf }),
    onShelf: (f) => (listeners.add(f), () => void listeners.delete(f)),
    hold: (on) => {
      holds.push(on);
      desk.held = on;
    },
    load: async (text) => {
      const { world } = await Effect.runPromise(decodeSave(text));
      loaded.push(world);
      desk.held = false;
      shelf.welcome = false;
      for (const l of listeners) l();
      return null;
    },
    greets: () => true,
    now: () => Date.now(),
    date: (day) => `day ${day}`,
    ago: () => "just now",
    size: (n) => `${Math.round(n / 1000)}K`,
  };
  return {
    storage,
    desk,
    port,
    loaded,
    holds,
    /** The game boots: it reads the shelf and says "Welcome back" when there is something on it. */
    boot() {
      shelf.booted = true;
      shelf.welcome = desk.store.list().some((l) => l.meta);
      desk.held = shelf.welcome;
      for (const l of listeners) l();
    },
    /** The player answers "Welcome back" with this computer's lab (or New lab). */
    answer() {
      shelf.welcome = false;
      desk.held = false;
      for (const l of listeners) l();
    },
    save: (world: GameState, slot: "auto" | "1", why: "month" | "manual" | "hide") => Effect.runPromise(desk.save(world, slot, why)),
  };
}

describe("cloud saves, round trip (real Worker, mocked Hugging Face)", () => {
  it("logs on, saves, loses the local saves, logs on again, and the lab comes back byte for byte", async () => {
    const lab = createMidgameScenario();
    lab.labName = "Gradient Descent Labs";

    // The first computer: log on, play, autosave and save to slot 1.
    const api = await logOn();
    const a = computer();
    const ta = soon();
    const cloudA = createCloud(a.port, api, ta);
    a.boot();
    await cloudA.start();
    expect(cloudA.get().offer).toBeNull();
    await a.save(lab, "auto", "month");
    await a.save(lab, "1", "manual");
    await ta.settle(() => cloudA.pending.length === 0);
    expect(cloudA.get().slots.map((s) => [s.slot, s.lab])).toEqual([["auto", "Gradient Descent Labs"], ["1", "Gradient Descent Labs"]]);
    expect(cloudA.get().status?.text).toMatch(/Up to date/);
    cloudA.stop();

    // Local storage cleared (a new computer, or a cleaned browser): nothing here. Log on again.
    const b = computer();
    expect(b.storage.map.size).toBe(0);
    const tb = soon();
    const cloudB = createCloud(b.port, await logOn(), tb);
    b.boot();
    await cloudB.start();
    // Nothing on this computer, so the offer is a window of its own, and the fresh garage behind it holds its autosave.
    expect(cloudB.get()).toMatchObject({ offerIn: "alone", offer: { lab: "Gradient Descent Labs" } });
    expect(b.desk.held).toBe(true);
    await b.save(createInitialState(), "auto", "month");
    expect(b.storage.map.size).toBe(0);

    cloudB.actions.load(cloudB.get().offer!.slot);
    await tb.settle(() => b.loaded.length > 0 && !cloudB.get().busy);
    expect(b.loaded).toHaveLength(1);
    expect(JSON.stringify(b.loaded[0])).toBe(JSON.stringify(lab));
    expect(cloudB.get().offer).toBeNull();
    expect(b.desk.held).toBe(false);

    // Playing on: the next autosave goes up as before. (The first computer wrote that slot a moment ago, so the
    // Worker says 429 at first, and the client retries quietly until it takes.)
    const later = structuredClone(lab);
    later.day += 31;
    await b.save(later, "auto", "month");
    await tb.settle(() => cloudB.pending.length === 0);
    expect(cloudB.get().slots.find((s) => s.slot === "auto")?.date).toBe(`day ${later.day}`);
    cloudB.stop();
  }, 60_000);

  it("on a computer where the trip to Hugging Face autosaved a fresh garage, the cloud lab is offered in Welcome back", async () => {
    const sessions = new Map<string, string>();
    (globalThis as { sessionStorage?: unknown }).sessionStorage = {
      getItem: (k: string) => sessions.get(k) ?? null,
      setItem: (k: string, v: string) => void sessions.set(k, v),
      removeItem: (k: string) => void sessions.delete(k),
    };
    try {
      const api = await logOn();
      const c = computer();
      // A garage, on screen; the player clicks Log On, and leaving the page autosaves it.
      markAway(Date.now() - 1);
      await c.save(createInitialState(), "auto", "hide");
      const tc = soon();
      const cloud = createCloud(c.port, api, tc);
      c.boot();
      await cloud.start();
      expect(cloud.get()).toMatchObject({ offerIn: "welcome", offer: { lab: "Gradient Descent Labs" } });
      // "New lab" (or Continue with the garage) is an answer too: uploads start, but the garage can't take the
      // cloud's autosave from the lab that is further along.
      c.answer();
      await tc.settle(() => cloud.pending.length === 0);
      expect(cloud.get().offer).toBeNull();
      expect(cloud.get().slots.find((s) => s.slot === "auto")?.lab).toBe("Gradient Descent Labs");
      expect(cloud.get().status?.text).toMatch(/further along/);
      cloud.stop();
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  }, 60_000);
});
