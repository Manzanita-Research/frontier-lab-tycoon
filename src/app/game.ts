// The game as React sees it: one registry, the app actor's atoms, and a few imperative helpers for event handlers and
// useFrame. Effect owns the runtime (the Sim and Frames services live in an Atom runtime, the actor lives in an atom,
// and both go away when the registry is disposed); React only reads atoms and sends events.
import { Layer } from "effect";
import type { EventFromLogic } from "xstate";
import { createActorAtoms } from "@xstate/effect/atom";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { readDebugParams } from "../debug";
import { buildingAt } from "../sim/pathfind";
import { canPlace } from "../sim/commands";
import { tick } from "../sim/tick";
import type { Tone } from "../sim/types";
import { framesBrowser } from "./frames";
import { SPEEDS, type Speed, type Tool } from "./hud";
import { appMachine, type AppContext } from "./machine";
import { createSimHandle, simLayer } from "./sim";

export const debugParams = readDebugParams();

/** The one live World. The renderer reads `sim.world` and `sim.alpha` straight from useFrame. */
export const sim = createSimHandle(debugParams);

const initialSpeed: Speed = (SPEEDS as readonly number[]).includes(debugParams.speed ?? 1) ? ((debugParams.speed ?? 1) as Speed) : 1;

const runtime = Atom.runtime(Layer.mergeAll(simLayer(sim), framesBrowser));

/** The app actor's atoms: `snapshot`, `send`, and `select` for derived values. */
export const app = createActorAtoms(runtime, appMachine, { input: { speed: initialSpeed, first: sim.report(true, true)! } });

/** Owns the atoms' lifetimes. Mount `app.actor` to start the loop; dispose it to stop everything. */
export const registry = AtomRegistry.make();

const pick = <T>(select: (c: AppContext) => T) => app.select((s) => select(s.context));

/** Selector atoms for the HUD and the scene. Values keep their identity until they change. */
export const atoms = {
  snap: pick((c) => c.snap),
  news: pick((c) => c.news),
  speed: pick((c) => c.speed),
  tool: pick((c) => c.tool),
  hover: pick((c) => c.hover),
  toasts: pick((c) => c.toasts),
  outcomeDismissed: pick((c) => c.outcomeDismissed),
  version: pick((c) => c.snap.version),
  cash: pick((c) => c.snap.cash),
  cashBucket: pick((c) => Math.floor(c.snap.cash / 10_000)),
  labName: pick((c) => c.snap.labName),
  event: pick((c) => c.snap.event),
  goals: pick((c) => c.snap.goals),
  day: pick((c) => c.snap.day),
  hasGateway: pick((c) => c.snap.hasGateway),
  buildings: pick((c) => c.snap.buildings),
  thoughts: pick((c) => c.snap.thoughts),
  pops: pick((c) => c.snap.pops),
};

/** The app's context right now, for handlers and frame callbacks that must not subscribe. Null until it has started. */
export function appNow(): AppContext | null {
  const result = registry.get(app.snapshot);
  return AsyncResult.isSuccess(result) ? result.value.context : null;
}

type AppEvent = EventFromLogic<typeof appMachine>;

/** Send the app actor an event. */
export const send = (event: AppEvent) => registry.set(app.send, event);

export const toast = (text: string, tone: Tone = "neutral") => send({ type: "TOAST", text, tone });

/**
 * A player action at tile (x, z): validate against the World, then queue the command or toast why not.
 * `quiet` (painting a path by dragging) suppresses everything except "Not enough cash".
 */
export function use(tool: Tool, x: number, z: number, quiet = false) {
  const world = sim.world;
  if (tool === "bulldoze") {
    if (buildingAt(world, x, z) || world.grid.paths[z * world.grid.w + x]) send({ type: "COMMAND", command: { type: "bulldoze", x, z } });
    return;
  }
  const res = tool === "path" ? canPlace(world, "path", x, z) : canPlace(world, tool, x, z);
  if (!res.ok) {
    if (!quiet || res.reason === "Not enough cash") if (res.reason !== "Already a path") toast(res.reason, "bad");
    return;
  }
  send({ type: "COMMAND", command: tool === "path" ? { type: "placePath", x, z } : { type: "placeBuilding", kind: tool, x, z } });
}

// `?debug=1` exposes the game for probes and screenshot scripts.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) {
  (window as unknown as { __flt: unknown }).__flt = { sim, send, registry, app, tick };
}
