// FLT-84: the hunt for the app-actor error behind the FLT-64 freezes. A prod-like lab (a played lab with the ladder on,
// or HUNT_MODE=nogw for run 2's no-gateway lab), every Training Hall and its neighbours broken, then the real actor fed
// a storm of the player's input, paused and running. Any `[app] ... action failed` or an actor that isn't active fails.
// Off in CI (minutes per lab): HUNT=1 [HUNT_SEEDS=1,2,3] [HUNT_DAYS=60,140] [HUNT_STEPS=600] pnpm vitest run freeze.hunt
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { createEffectActor, send } from "@xstate/effect";
import type { EventFromLogic } from "xstate";
import { makeSaveStore, memoryStorage } from "../save";
import { canPlace, type Command } from "../sim/commands";
import { playBot } from "../sim/bot";
import { createInitialState } from "../sim/state";
import { applyNow } from "../sim/tick";
import { findSpot, layPaths, runDays } from "../sim/testkit";
import { DEFAULT_RISK } from "../sim/disasters/driver";
import { enableEndings } from "../sim/endings/state";
import { setRisk } from "../sim/disasters/driver";
import { createRng } from "../sim/rng";
import type { GameState } from "../sim/types";
import { appMachine } from "./machine";
import { framesManual, ManualFrames } from "./frames";
import { TOOLS, type Speed } from "./hud";
import { makeSaveDesk, Saves } from "./saves";
import { Sim, simLayer, SimHandle } from "./sim";

const SEEDS = (import.meta.env.HUNT_SEEDS ?? "1,2,3").split(",").map(Number);
const DAYS = (import.meta.env.HUNT_DAYS ?? "60,140").split(",").map(Number);
const STEPS = Number(import.meta.env.HUNT_STEPS ?? 600);

function labAt(seed: number, day: number): GameState {
  if (import.meta.env.HUNT_MODE === "nogw") {
    // Run 2 of FLT-64: Today's lab, the tutorial skipped, four clusters and two halls, no gateway, burning cash.
    const s = createInitialState(seed);
    enableEndings(s, "2026-09-30");
    setRisk(s, DEFAULT_RISK);
    applyNow(s, [{ type: "skipTutorial" }]);
    layPaths(s);
    for (const kind of ["cluster", "cluster", "cluster", "cluster", "hall", "hall"] as const) {
      const spot = findSpot(s, kind);
      if (spot) applyNow(s, [{ type: "placeBuilding", kind, x: spot[0], z: spot[1], confirmed: true }]);
    }
    runDays(s, day);
    return s;
  }
  const out: { state?: GameState } = {};
  playBot(seed, { days: day, keepPlaying: true, out, setup: (s) => { enableEndings(s); setRisk(s, "chaos"); }, until: (s) => s.day >= day });
  return out.state!;
}

function breakHalls(s: GameState) {
  for (const b of s.buildings) {
    if (b.kind === "hall" || s.buildings.some((h) => h.kind === "hall" && Math.abs(h.x - b.x) <= 3 && Math.abs(h.z - b.z) <= 3)) {
      b.broken = true;
      b.brokenTick = s.tick;
      b.reliability = 0.1;
    }
  }
  s.version++;
}

type AppEvent = EventFromLogic<typeof appMachine>;

const OVERLAYS = ["start", "run", "finance", "saves", "staff", "arena", "help", "settings", "newsroom", "disasters", "factions", "birdapp"];

describe.skipIf(!import.meta.env.HUNT)("FLT-84 hunt", () => {
  for (const seed of SEEDS) for (const day of DAYS) {
    it.live(`seed ${seed}, day ${day}: broken halls, pause and input storm`, () => {
      const world = labAt(seed, day);
      breakHalls(world);
      const handle = new SimHandle(world, world.leapfrog.enabled, undefined, null);
      const desk = makeSaveDesk(makeSaveStore(memoryStorage()), true);
      const layer = Layer.mergeAll(simLayer(handle), framesManual, Layer.succeed(Saves, desk));
      const errors: string[] = [];
      const spy = vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args.map(String).join(" ")));
      const rng = createRng(seed * 7919 + day);
      const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng.next() * xs.length)]!;
      return Effect.gen(function* () {
        const sim = yield* Sim;
        const frames = yield* ManualFrames;
        const actor = yield* createEffectActor(appMachine, { input: { speed: 1, first: sim.report(true, true)! } });
        const pump = (n: number) => Effect.gen(function* () {
          for (let i = 0; i < n; i++) { frames.emit(0.05 + rng.next() * 0.1); yield* Effect.sleep("1 millis"); }
        });
        const tile = () => ({ x: Math.floor(rng.next() * sim.world.grid.w), z: Math.floor(rng.next() * sim.world.grid.h) });
        const near = () => {
          const h = sim.world.buildings.find((b) => b.broken) ?? sim.world.buildings[0];
          return h ? { x: h.x - 1 + Math.floor(rng.next() * (h.w + 2)), z: h.z - 1 + Math.floor(rng.next() * (h.d + 2)) } : tile();
        };
        const log: string[] = [];
        for (let step = 0; step < STEPS; step++) {
          const c = actor.getSnapshot().context;
          const r = rng.next();
          let ev: AppEvent | null = null;
          if (c.event && r < 0.15) ev = { type: "CHOOSE", choiceIndex: Math.floor(rng.next() * 3) };
          else if (r < 0.2) ev = { type: "TOGGLE_PAUSE" };
          else if (r < 0.26) ev = { type: "SET_SPEED", speed: pick([0, 1, 2, 3] as Speed[]) };
          else if (r < 0.36) ev = { type: "SET_OVERLAY", id: pick(OVERLAYS), open: rng.next() < 0.6 };
          else if (r < 0.42) ev = { type: "COMMAND", command: pick<Command>([{ type: "coachClick" }, { type: "buildPanelOpened" }, { type: "dismissUnlock" }, { type: "startTraining" }, { type: "cancelConfirm" }, { type: "hire", job: "sre" }, { type: "hire", job: "janitor" }]) };
          else if (r < 0.5) ev = { type: "SET_TOOL", tool: pick([...TOOLS, null]) as never };
          else if (r < 0.58) ev = { type: "SET_HOVER", hover: rng.next() < 0.8 ? near() : null };
          else if (r < 0.7) {
            const t = rng.next() < 0.7 ? near() : tile();
            const kind = pick(["path", "path", "path", "bulldoze", ...TOOLS]) as string;
            if (kind === "bulldoze") ev = { type: "COMMAND", command: { type: "bulldoze", ...t } };
            else if (kind === "path") { if (canPlace(sim.world, "path", t.x, t.z).ok) ev = { type: "COMMAND", command: { type: "placePath", ...t } }; }
            else if (canPlace(sim.world, kind as never, t.x, t.z).ok) ev = { type: "PLACE", command: { type: "placeBuilding", kind: kind as never, ...t }, keep: rng.next() < 0.3 };
          }
          else if (r < 0.78) {
            const ids = [...sim.world.walkers.map((w) => w.id), ...sim.world.staff.map((w) => w.id), ...sim.world.buildings.map((b) => b.id)];
            ev = { type: "SELECT", id: ids.length && rng.next() < 0.85 ? pick(ids) : null };
          }
          else if (r < 0.81) ev = { type: "SET_FOLLOW", follow: rng.next() < 0.5 };
          else if (r < 0.84) ev = { type: "HIGHLIGHT", key: rng.next() < 0.7 ? (sim.world.thoughts[0] ? `${sim.world.thoughts[0].kind}|${sim.world.thoughts[0].text}` : null) : null };
          else if (r < 0.88) ev = { type: "HOLD_TOASTS", on: rng.next() < 0.5 };
          else if (r < 0.9 && c.toasts[0]) ev = { type: "DISMISS_TOAST", id: c.toasts[0].id };
          else if (r < 0.92) ev = { type: "SAVE", slot: pick(["auto", "1", "2"]) as never, why: "manual" };
          else if (r < 0.93) ev = { type: "SET_ZONE", id: sim.world.staff[0]?.id ?? null };
          else if (r < 0.935) ev = { type: "KEEP_PLAYING" };
          if (ev) { log.push(JSON.stringify(ev)); yield* send(actor, ev); }
          yield* pump(1 + Math.floor(rng.next() * 3));
          const st = actor.getSnapshot();
          if (st.status !== "active" || errors.length > 0) {
            throw new Error(`step ${step} day ${sim.world.day}: status ${st.status} ${String((st as { error?: unknown }).error)}\n${errors.join("\n")}\nlast events:\n${log.slice(-15).join("\n")}`);
          }
        }
        console.log(`seed ${seed} day ${day}: ran to day ${sim.world.day}, ${log.length} events, broken ${sim.world.buildings.filter((b) => b.broken).length}`);
      }).pipe(Effect.ensuring(Effect.sync(() => spy.mockRestore())), Effect.provide(layer));
    }, 600_000);
  }
});
