// Owns the sim state, runs the fixed-step loop, and hands the UI a throttled snapshot.
import { create } from "zustand";
import type { BuildingKind } from "./content/buildings";
import { readDebugParams } from "./debug";
import { applyNow, tick, TICKS_PER_DAY } from "./sim/tick";
import { canPlace, type Command } from "./sim/commands";
import { computePerDay } from "./sim/training";
import { runwayMonths } from "./sim/format";
import { createRng } from "./sim/rng";
import { createInitialState } from "./sim/state";
import { buildingAt } from "./sim/pathfind";
import { fillAgents } from "./sim/walkers";
import type { Building, GameState, NewsItem, Pop, Thought, Tone } from "./sim/types";

export type Tool = "path" | BuildingKind | "bulldoze";
/** Hotkeys 1-6 pick these in order. */
export const TOOLS: Tool[] = ["path", "cluster", "hall", "gateway", "kombucha", "bulldoze"];
export const SPEEDS = [0, 1, 3, 10] as const;
export type Speed = (typeof SPEEDS)[number];

const TICKS_PER_SECOND = 10;
const MAX_CATCHUP_TICKS = 40;
const SNAPSHOT_MS = 200;

export interface Snapshot {
  tick: number;
  day: number;
  cash: number;
  net: number;
  income: number;
  expenses: number;
  runway: number | null;
  capability: number;
  hype: number;
  labName: string;
  hasHall: boolean;
  computePerDay: number;
  training: { name: string; run: number; pct: number };
  thoughts: Thought[];
  pops: Pop[];
  version: number;
  /** Same array identity until the grid or buildings change. */
  buildings: Building[];
  models: number;
  walkers: number;
}

export interface UiToast {
  id: number;
  text: string;
  tone: Tone;
}

function makeSnapshot(s: GameState, prev?: Snapshot): Snapshot {
  return {
    tick: s.tick,
    day: s.day,
    cash: s.cash,
    net: s.ledger.net,
    income: s.ledger.income,
    expenses: s.ledger.expenses,
    runway: runwayMonths(s.cash, s.ledger.net),
    capability: s.capability,
    hype: s.hype,
    labName: s.labName,
    hasHall: s.buildings.some((b) => b.kind === "hall"),
    computePerDay: computePerDay(s),
    training: { name: s.training.name, run: s.training.run, pct: Math.min(1, s.training.progress / s.training.cost) },
    thoughts: s.thoughts.slice(),
    pops: s.pops.slice(),
    version: s.version,
    buildings: prev && prev.version === s.version ? prev.buildings : s.buildings.slice(),
    models: s.models.length,
    walkers: s.walkers.length,
  };
}

interface Store {
  /** The live, mutable sim. Read it in useFrame; never subscribe to it. */
  sim: GameState;
  snap: Snapshot;
  news: NewsItem[];
  speed: Speed;
  tool: Tool | null;
  hover: { x: number; z: number } | null;
  toasts: UiToast[];
  setSpeed(s: Speed): void;
  togglePause(): void;
  setTool(t: Tool | null): void;
  setHover(h: { x: number; z: number } | null): void;
  dispatch(c: Command): void;
  /** Validate, then queue. Toasts the reason when placement fails. */
  use(tool: Tool, x: number, z: number, quiet?: boolean): void;
  toast(text: string, tone?: Tone): void;
  dismissToast(id: number): void;
}

function createGame() {
  const dbg = readDebugParams();
  const sim = createInitialState(dbg.seed);
  for (let i = 0; i < dbg.warp * TICKS_PER_DAY; i++) tick(sim);
  if (dbg.agents > 0) {
    sim.agentBonus = dbg.agents;
    const rng = createRng(sim.rngState);
    fillAgents(sim, rng);
    sim.rngState = rng.state();
  }
  return { sim, dbg };
}

const { sim: initialSim, dbg } = createGame();
const queue: Command[] = [];
let alpha = 1;
/** How far between the previous tick and the current one the renderer should draw (0..1). */
export const getAlpha = () => alpha;

let toastSeq = 1;

export const useStore = create<Store>((set, get) => ({
  sim: initialSim,
  snap: makeSnapshot(initialSim),
  news: initialSim.news.slice(),
  speed: (SPEEDS as readonly number[]).includes(dbg.speed ?? 1) ? ((dbg.speed ?? 1) as Speed) : 1,
  tool: null,
  hover: null,
  toasts: initialSim.toasts.splice(0).map((t) => ({ ...t })),

  setSpeed: (speed) => set({ speed }),
  togglePause: () => set((st) => ({ speed: st.speed === 0 ? 1 : 0 })),
  setTool: (tool) => set((st) => ({ tool: st.tool === tool ? null : tool, hover: null })),
  setHover: (hover) => {
    const cur = get().hover;
    if (cur?.x === hover?.x && cur?.z === hover?.z) return;
    set({ hover });
  },
  dispatch: (c) => {
    queue.push(c);
  },
  use: (tool, x, z, quiet = false) => {
    const { sim, dispatch, toast } = get();
    if (tool === "bulldoze") {
      if (buildingAt(sim, x, z) || sim.grid.paths[z * sim.grid.w + x]) dispatch({ type: "bulldoze", x, z });
      return;
    }
    const res = tool === "path" ? canPlace(sim, "path", x, z) : canPlace(sim, tool, x, z);
    if (!res.ok) {
      if (!quiet || res.reason === "Not enough cash") if (res.reason !== "Already a path") toast(res.reason, "bad");
      return;
    }
    dispatch(tool === "path" ? { type: "placePath", x, z } : { type: "placeBuilding", kind: tool, x, z });
  },
  toast: (text, tone = "neutral") => {
    const id = 1_000_000 + toastSeq++;
    set((st) => ({ toasts: [...st.toasts.filter((t) => t.text !== text).slice(-2), { id, text, tone }] }));
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
}));

/** Starts the requestAnimationFrame loop. Returns a stop function. */
export function startLoop(): () => void {
  let raf = 0;
  let last = performance.now();
  let lastSnap = 0;
  let acc = 0;
  let lastVersion = -1;

  const publish = (now: number) => {
    const st = useStore.getState();
    const s = st.sim;
    const patch: Partial<Store> = { snap: makeSnapshot(s, st.snap), news: s.news.slice() };
    if (s.toasts.length > 0) {
      const fresh = s.toasts.splice(0).map((t) => ({ ...t }));
      patch.toasts = [...st.toasts, ...fresh].slice(-3);
    }
    useStore.setState(patch);
    lastSnap = now;
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const { sim, speed } = useStore.getState();

    if (speed === 0) {
      alpha = 1;
      if (queue.length > 0) applyNow(sim, queue.splice(0));
    } else {
      acc += dt * TICKS_PER_SECOND * speed;
      const n = Math.min(MAX_CATCHUP_TICKS, Math.floor(acc));
      acc = n === MAX_CATCHUP_TICKS ? 0 : acc - n;
      for (let i = 0; i < n; i++) tick(sim, queue.length > 0 ? queue.splice(0) : undefined);
      alpha = acc;
    }
    // Placing or bulldozing shows up immediately; everything else waits for the ~5 Hz snapshot.
    if (now - lastSnap >= SNAPSHOT_MS || sim.version !== lastVersion) {
      lastVersion = sim.version;
      publish(now);
    }
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export const debugParams = dbg;

// `?debug=1` exposes the store for probes and screenshot scripts.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug")) {
  (window as unknown as { __flt: unknown }).__flt = { useStore, tick };
}
