// The Sim service: the one live World, plus what the app needs to drive it. Everything here is synchronous and
// deterministic; the app machine calls it from Effect actions, the renderer reads `world` and `alpha` in useFrame.
import { Context, Layer } from "effect";
import type { DebugParams } from "../debug";
import type { Command } from "../sim/commands";
import { openEventOf } from "../sim/events";
import { outcomeOf } from "../sim/goals";
import { createRng } from "../sim/rng";
import { createInitialState } from "../sim/state";
import { applyNow, tick, TICKS_PER_DAY } from "../sim/tick";
import { syncProtesters } from "../sim/protest";
import { setRisk } from "../sim/disasters/driver";
import { stageDisaster } from "../sim/disasters/demo";
import { RISKS, type Risk } from "../sim/disasters/types";
import type { GameState, NewsItem, OpenEvent, Outcome, Thought } from "../sim/types";
import { fillAgents, seedWalkers } from "../sim/walkers";
import { isMoment, stageMoment } from "../sim/race/demo";
import { isOpsMoment, stageOps } from "../sim/opsDemo";
import { isPaperMoment, stagePapers } from "../sim/race/papers/demo";
import { enablePapers } from "../sim/race/papers/driver";
import { enableLeapfrog } from "../sim/race/leapfrog/driver";
import { parseLeapMoment, stageLeapfrog } from "../sim/race/leapfrog/demo";
import { isCollusionMoment, stageCollusion } from "../sim/collusion/demo";
import { enableCollusion } from "../sim/collusion/driver";
import { walkersThinking } from "../sim/mind";
import { makeSnapshot, NO_SELECTION, type Snapshot, type UiSelection, type UiToast } from "./hud";
import { continueTutorial } from "../sim/tutorial";
import { stageFirstRun } from "../sim/firstRunDemo";

/** What the loop tells the app after touching the World. `snap`, `news` and `toasts` come with a publish. */
export interface SyncReport {
  event: OpenEvent | null;
  outcome: Outcome;
  snap?: Snapshot;
  news?: NewsItem[];
  toasts: UiToast[];
}

const NO_IDS: ReadonlySet<number> = new Set();

export class SimHandle {
  /** The live, mutable sim. Read it in useFrame; never subscribe to it. */
  world: GameState;
  /** How far between the previous tick and the current one the renderer should draw (0..1). */
  alpha = 1;
  private lastVersion = -1;
  private lastSnap: Snapshot | undefined;
  private lastEvent: OpenEvent | null = null;
  private lastOutcome: Outcome = "playing";
  /** What the player has selected; the app machine hands it over on every frame. Read by the renderer and the snapshot. */
  ui: UiSelection = NO_SELECTION;
  /** Walkers behind the lit-up Thoughts row, refreshed with each publish (about 5 Hz). */
  highlightIds: ReadonlySet<number> = new Set();
  /** Release Leapfrog's pack is loaded (a new lab gets it too). */
  leapfrog: boolean;
  /** A scripted opening can start the news tape on an existing headline, without rewriting World history. */
  newsStartId = 0;
  /** A paused scenario's curated bubbles. Ordinary sim bubbles return on the first resumed tick. */
  openingThoughts?: { tick: number; thoughts: Thought[] };

  constructor(world: GameState, leapfrog = false, public papers = world.papers?.enabled ?? false) {
    this.world = world;
    this.leapfrog = leapfrog;
  }

  /** Advance `n` ticks; queued commands apply on the first one. */
  step(n: number, commands: readonly Command[]) {
    for (let i = 0; i < n; i++) tick(this.world, i === 0 && commands.length > 0 ? commands : undefined);
  }

  /** Apply commands without advancing time (building while paused or with a card open). */
  applyNow(commands: readonly Command[]) {
    if (commands.length > 0) applyNow(this.world, commands);
  }

  /** Start over with a fresh seed (the random-disaster setting carries over to the new lab). */
  reset(seed: number) {
    this.newsStartId = 0;
    this.openingThoughts = undefined;
    const risk = this.world.disasters.risk;
    const collusion = this.world.collusion?.enabled;
    const leapfrogOff = this.world.flags.leapfrogOff;
    const papersOff = this.world.flags.papersOff;
    this.world = createInitialState(seed);
    setRisk(this.world, risk);
    if (leapfrogOff) this.world.flags.leapfrogOff = leapfrogOff;
    if (collusion) enableCollusion(this.world);
    if (papersOff) this.world.flags.papersOff = papersOff;
    this.alpha = 1;
  }

  /**
   * Anything for the app to hear about? A publish is due on a timer, or right away when the grid or buildings
   * changed; a change of card or outcome is always reported. Returns null when there is nothing new.
   */
  report(publishDue: boolean, force = false): SyncReport | null {
    const w = this.world;
    const event = openEventOf(w);
    const outcome = outcomeOf(w);
    const publish = force || publishDue || w.version !== this.lastVersion;
    const changed = event?.id !== this.lastEvent?.id || outcome !== this.lastOutcome;
    if (!publish && !changed) return null;
    this.lastEvent = event;
    this.lastOutcome = outcome;
    if (!publish) return { event, outcome, toasts: [] };
    this.lastVersion = w.version;
    const presented = this.openingThoughts?.tick === w.tick ? { ...w, thoughts: this.openingThoughts.thoughts } : w;
    this.lastSnap = makeSnapshot(presented, this.lastSnap, this.ui);
    this.highlightIds = this.ui.highlight ? walkersThinking(w, this.ui.highlight) : NO_IDS;
    return { event, outcome, snap: this.lastSnap, news: w.news.filter((n) => n.id >= this.newsStartId), toasts: w.toasts.splice(0).map((t) => ({ ...t })) };
  }
}

/** A living campus, warped forward and dressed up per the `?seed=&warp=&agents=&discourse=` debug knobs. */
export function createSimHandle(
  dbg: Pick<DebugParams, "seed" | "warp" | "agents" | "discourse" | "researchers"> & Partial<Pick<DebugParams, "disaster" | "dz" | "dzPick" | "risk">> & { moment?: string | null; leapfrog?: boolean; papers?: boolean },
): SimHandle {
  const sim = createInitialState(dbg.seed);
  if (dbg.leapfrog === false) sim.flags.leapfrogOff = 1;
  if (dbg.papers === false) sim.flags.papersOff = 1;
  const leap = parseLeapMoment(dbg.moment);
  if (dbg.warp > 0 || dbg.agents > 0 || dbg.discourse > 0 || dbg.researchers > 0 || dbg.moment || dbg.disaster) { continueTutorial(sim, true); delete sim.progression; }
  if (!sim.progression && dbg.leapfrog) enableLeapfrog(sim);
  if (!sim.progression && dbg.papers) enablePapers(sim);
  for (let i = 0; i < dbg.warp * TICKS_PER_DAY; i++) tick(sim);
  if (dbg.moment === "jem-opening" || dbg.moment === "jem-confirm") stageFirstRun(sim, dbg.moment);
  else if (isMoment(dbg.moment)) stageMoment(sim, dbg.moment);
  else if (isOpsMoment(dbg.moment)) stageOps(sim, dbg.moment);
  else if (leap) stageLeapfrog(sim, leap.moment, leap.arg);
  else if (isCollusionMoment(dbg.moment)) stageCollusion(sim, dbg.moment);
  else if (isPaperMoment(dbg.moment)) stagePapers(sim, dbg.moment);
  if (dbg.agents > 0 || dbg.discourse > 0 || dbg.researchers > 0) {
    const rng = createRng(sim.rngState);
    if (dbg.researchers > 0) seedWalkers(sim, "researcher", dbg.researchers, rng);
    if (dbg.agents > 0) {
      sim.agentBonus = dbg.agents;
      fillAgents(sim, rng);
    }
    if (dbg.discourse > 0) {
      sim.waterDiscourse = dbg.discourse;
      syncProtesters(sim, rng, true);
    }
    sim.rngState = rng.state();
  }
  // Disasters (FLT-17): `?risk=` sets the random-disaster setting once the warp is done (the warp itself runs with them off, so a
  // `?warp=` link is the same lab it always was), and `?disaster=<id>` starts one a moment before the shot.
  if ((RISKS as readonly string[]).includes(dbg.risk ?? "")) setRisk(sim, dbg.risk as Risk);
  if (dbg.disaster) stageDisaster(sim, dbg.disaster, dbg.dz ?? 0, dbg.dzPick ?? null);
  return new SimHandle(sim, sim.leapfrog.enabled);
}

export class Sim extends Context.Service<Sim, SimHandle>()("@flt/Sim") {}

/** Provide an existing handle (the renderer holds the same one). */
export const simLayer = (handle: SimHandle) => Layer.succeed(Sim, handle);
