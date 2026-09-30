// The game as React sees it: one registry, the app actor's atoms, and a few imperative helpers for event handlers and
// useFrame. Effect owns the runtime (the Sim and Frames services live in an Atom runtime, the actor lives in an atom,
// and both go away when the registry is disposed); React only reads atoms and sends events.
import { Layer } from "effect";
import type { EventFromLogic } from "xstate";
import { createActorAtoms } from "@xstate/effect/atom";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { readDebugParams } from "../debug";
import { DEFAULT_RISK, setRisk } from "../sim/disasters/driver";
import { buildingAt } from "../sim/pathfind";
import { canPlace } from "../sim/commands";
import { TICKS_PER_DAY } from "../sim/constants";
import { withDefs } from "../sim/defs";
import { tick } from "../sim/tick";
import { isAuditMoment, stageAudit } from "../sim/auditors/demo";
import { createMidgameScenario, MIDGAME_CAMERA, midgameOpeningNews, midgameOpeningThoughts } from "../sim/scenarios/midgame";
import type { Tone } from "../sim/types";
import { framesBrowser } from "./frames";
import { SPEEDS, type Speed, type Tool } from "./hud";
import { appMachine, autoPaused, type AppContext } from "./machine";
import { createSimHandle, SimHandle, simLayer } from "./sim";
import { modSession } from "./mods";

const midgame = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("scenario") === "midgame";
const params = readDebugParams();
export const debugParams = midgame ? { ...params, focus: params.focus ?? MIDGAME_CAMERA.focus, zoom: params.zoom ?? MIDGAME_CAMERA.zoom } : params;

/** The one live World. The renderer reads `sim.world` and `sim.alpha` straight from useFrame. */
/** `?mod=` was resolved before this module loaded (main.tsx); the World is created from that definition. */
const mods = modSession();
export const sim = midgame ? new SimHandle(withDefs(mods.def, createMidgameScenario), true, undefined, mods.def) : createSimHandle(debugParams, mods.def, mods.run);
if (midgame && mods.run) sim.world.mods = mods.run;
if (midgame) {
  sim.newsStartId = midgameOpeningNews(sim.world)[0]!.id;
  sim.openingThoughts = { tick: sim.world.tick, thoughts: midgameOpeningThoughts(sim.world) };
  // FLT-19: the auditors on the mid-game campus (the busiest one there is).
  if (isAuditMoment(params.moment)) stageAudit(sim.world, params.moment);
}
// A new lab plays on "rare" (the sim itself starts with random disasters off, so tests are unaffected); `?risk=` overrides.
if (!midgame && !debugParams.risk) setRisk(sim.world, DEFAULT_RISK);

const initialSpeed: Speed = midgame ? 0 : (SPEEDS as readonly number[]).includes(debugParams.speed ?? 1) ? ((debugParams.speed ?? 1) as Speed) : 1;

const runtime = Atom.runtime(Layer.mergeAll(simLayer(sim), framesBrowser));

/** The app actor's atoms: `snapshot`, `send`, and `select` for derived values. */
const first = sim.report(true, true)!;
if (midgame) {
  // Presentation only: open the ticker on the selected real headline, and skip historical construction toasts.
  first.toasts = [];
}
// Say which mods are running, and whether any failed (the details are in Start ▸ Settings ▸ Mods…). Ids below zero never meet the World's.
if (mods.mods.length > 0) first.toasts.push({ id: -1, text: `Mods on: ${mods.mods.map((m) => m.name).join(", ")}`, tone: "good", source: "mods", importance: "you" });
if (mods.errors.length > 0) first.toasts.push({ id: -2, text: `${mods.errors.length === 1 ? "A mod" : `${mods.errors.length} mods`} didn't load. See Start, Settings, Mods…`, tone: "bad", source: "mods", importance: "you" });
export const app = createActorAtoms(runtime, appMachine, { input: { speed: initialSpeed, first } });

/** Owns the atoms' lifetimes. Mount `app.actor` to start the loop; dispose it to stop everything. */
export const registry = AtomRegistry.make();

const pick = <T>(select: (c: AppContext) => T) => app.select((s) => select(s.context));

/** Selector atoms for the HUD and the scene. Values keep their identity until they change. */
export const atoms = {
  snap: pick((c) => c.snap),
  coach: pick((c) => c.snap.coach),
  progress: pick((c) => c.snap.progress),
  news: pick((c) => c.news),
  speed: pick((c) => c.speed),
  paused: pick((c) => c.speed === 0 || autoPaused(c) || !!c.event || (c.outcome !== "playing" && !c.outcomeDismissed)),
  assistant: pick((c) => c.snap.assistant),
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
  vibes: pick((c) => c.snap.vibes),
  board: pick((c) => c.snap.board),
  inspect: pick((c) => c.snap.inspect),
  selected: pick((c) => c.selected),
  follow: pick((c) => c.follow),
  highlight: pick((c) => c.highlight),
  race: pick((c) => c.snap.race),
  ops: pick((c) => c.snap.ops),
  /** Agent collusion's signs for the world overlay (packets, the night gathering, the inquiry). */
  collusion: pick((c) => c.snap.collusion),
  staffCount: pick((c) => c.snap.ops.staff.length),
  payroll: pick((c) => c.snap.ops.payroll),
  disasters: pick((c) => c.snap.disasters),
  /** The staffer whose patrol zone is being painted, or null. */
  zone: pick((c) => c.zone),
  /** Template variables for the open card ({valuation}, {bidLow}, {dropRival}, ...). */
  cardVars: pick((c) => c.snap.race.vars),
  /** The Takeover's manager ("Frontier-9") while the autopilot builds, and how many buildings it has put down. */
  managedBy: pick((c) => c.snap.endings?.managedBy ?? null),
  autopilotPlaced: pick((c) => c.snap.endings?.placed ?? 0),
  /** The endings' presentation cues (the Look), for the scene. */
  endingLook: pick((c) => c.snap.endings?.look ?? null),
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
 * `quiet` (painting a path by dragging) suppresses everything except "Not enough cash". A building drops the tool once it
 * is down, unless `keep` (Shift held: place another, RCT-style).
 */
export function use(tool: Tool, x: number, z: number, quiet = false, keep = false) {
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
  send(tool === "path" ? { type: "COMMAND", command: { type: "placePath", x, z } } : { type: "PLACE", command: { type: "placeBuilding", kind: tool, x, z }, keep });
}

/**
 * What the camera shows, for the probe: the view-projection matrix (column-major) and the canvas rect in CSS pixels.
 * The scene lends it (`render/ProbeView`), so an e2e player can find a tile wherever the director has moved the camera.
 */
export const probeView: { view: (() => { matrix: number[]; rect: { left: number; top: number; width: number; height: number } }) | null } = { view: null };

// Always-on read-only contract: copied values, no URL switches or mutation handles.
if (typeof window !== "undefined") {
  (window as unknown as { __fltProbe: () => unknown }).__fltProbe = () => {
    const w = sim.world;
    const c = appNow();
    const snap = c?.snap;
    return { date: w.day, day: w.day, tick: w.tick, ticksPerDay: TICKS_PER_DAY, paused: c ? c.speed === 0 || autoPaused(c) || !!c.event : true, speed: c?.speed ?? initialSpeed,
      walkers: [...w.walkers.map((p) => ({ id: p.id, kind: p.kind, x: p.x, z: p.z, mode: p.machine.value })), ...w.staff.map((p) => ({ id: p.id, kind: p.job, x: p.x, z: p.z, mode: p.machine.value }))],
      gate: { x: w.gate.x, z: w.gate.z }, coachId: c?.snap.coach?.id ?? null,
      // FLT-53, the journey test: what the HUD shows, and the map a player sees, as plain copies.
      progress: snap ? { level: snap.progress.level, name: snap.progress.levelName, goal: { ...snap.progress.goal }, unlocked: { buildings: [...snap.progress.unlocked.buildings], staff: [...snap.progress.unlocked.staff] } } : null,
      cash: w.cash, runway: snap?.runway ?? null, income: snap?.income ?? 0, net: snap?.net ?? 0, vibes: w.vibes.value, models: w.models.length, rank: w.race.rank,
      researchers: w.walkers.filter((p) => p.kind === "researcher" && p.machine.value !== "quitting").length,
      staff: w.staff.filter((p) => p.machine.value !== "leaving" && p.machine.value !== "gone").map((p) => p.job),
      training: snap ? { name: snap.training.name, pct: snap.training.pct, etaDays: snap.training.etaDays } : null,
      event: snap?.event?.id ?? null, unlockCard: snap?.unlockCard?.title ?? null,
      pendingConfirm: snap?.pendingConfirm ? { kind: snap.pendingConfirm.kind, message: snap.pendingConfirm.message } : null,
      outcome: c ? { outcome: c.outcome, dismissed: c.outcomeDismissed } : null, overlays: c ? [...c.overlays] : [], warnings: snap ? [...snap.warnings] : [],
      toasts: c ? c.toasts.map((t) => ({ id: t.id, text: t.text, tone: t.tone })) : [],
      map: { w: w.grid.w, h: w.grid.h, paths: w.grid.paths.flatMap((p, i) => (p ? [i] : [])), gate: { ...w.gate }, buildings: w.buildings.map((b) => ({ id: b.id, kind: b.kind, x: b.x, z: b.z, w: b.w, d: b.d, broken: b.broken })) },
      view: probeView.view?.() ?? null };
  };
  window.addEventListener("click", () => send({ type: "COMMAND", command: { type: "coachClick" } }));
}

// `?debug=1` exposes the game for probes and screenshot scripts.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) {
  // `disaster(id)` and `risk(setting)` are the dev hooks for FLT-17: the same commands the Disasters menu will send.
  const disaster = (id: string) => send({ type: "COMMAND", command: { type: "disaster", id } });
  const risk = (setting: "off" | "rare" | "normal" | "chaos") => send({ type: "COMMAND", command: { type: "setRisk", risk: setting } });
  (window as unknown as { __flt: unknown }).__flt = { sim, send, registry, app, tick, disaster, risk, mods };
}
