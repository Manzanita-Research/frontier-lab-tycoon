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
import type { GameState, NewsItem, OpenEvent, Outcome, RunMods, Thought } from "../sim/types";
import { fillAgents, seedWalkers } from "../sim/walkers";
import { isMoment, stageMoment } from "../sim/race/demo";
import { isOpsMoment, stageOps } from "../sim/opsDemo";
import { isPaperMoment, stagePapers } from "../sim/race/papers/demo";
import { isFactionMoment, stageFactions } from "../sim/factions/demo";
import { parseLeapMoment, stageLeapfrog } from "../sim/race/leapfrog/demo";
import { isCollusionMoment, stageCollusion } from "../sim/collusion/demo";
import { isCircusMoment, stageCircus } from "../sim/circus/demo";
import { isDramaMoment, stageDrama } from "../sim/defection/demo";
import { isAuditMoment, stageAudit } from "../sim/auditors/demo";
import { isSenateMoment, stageSenate } from "../sim/capture/demo";
import { walkersThinking } from "../sim/mind";
import { makeSnapshot, NO_SELECTION, type Snapshot, type UiSelection, type UiToast } from "./hud";
import { continueTutorial } from "../sim/tutorial";
import { stageFirstRun } from "../sim/firstRunDemo";
import { withDefs } from "../sim/defs";
import { enableEarnedPacks, PACK_OFF_FLAGS } from "../sim/progression";
import type { GameDefinition } from "../mods/game-definition";
import { enableEndings } from "../sim/endings/state";
import { isEndingMoment, stageEndingMoment } from "../sim/endings/demo";

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

  /** The endings (FLT-11) are on: a new lab gets them too. */
  endings: boolean;
  /** The World a save put here (FLT-65), so the News Room reopens its archive instead of wiping it. */
  loaded: GameState | null = null;

  constructor(world: GameState, leapfrog = false, public papers = world.papers?.enabled ?? false, public readonly def: GameDefinition | null = null) {
    this.world = world;
    this.leapfrog = leapfrog;
    this.endings = !!world.endings;
  }

  /** Advance `n` ticks; queued commands apply on the first one. */
  step(n: number, commands: readonly Command[]) {
    for (let i = 0; i < n; i++) tick(this.world, i === 0 && commands.length > 0 ? commands : undefined, this.def);
  }

  /** Apply commands without advancing time (building while paused or with a card open). */
  applyNow(commands: readonly Command[]) {
    if (commands.length > 0) applyNow(this.world, commands, this.def);
  }

  /** Start over with a fresh seed (the random-disaster setting carries over to the new lab). `daily` is Today's lab. */
  reset(seed: number, daily: string | null = null) {
    this.newsStartId = 0;
    this.openingThoughts = undefined;
    const risk = this.world.disasters.risk;
    // The `?<pack>=off` switches carry over, and so do arcs switched off by name (`?water=off` is
    // `arcOff:water-escalation`); the packs themselves wake again as the new lab earns them.
    const off = Object.keys(this.world.flags).filter((f) => PACK_OFF_FLAGS.includes(f) || f.startsWith("arcOff:"));
    const mods = this.world.mods;
    this.world = createInitialState(seed, "garage", this.def);
    if (mods) this.world.mods = mods;
    setRisk(this.world, risk);
    for (const f of off) this.world.flags[f] = 1;
    if (this.endings) enableEndings(this.world, daily);
    this.alpha = 1;
  }

  /**
   * Carry on from a save (FLT-65): the World replaces the live one as it is, so the next tick is the tick it would
   * have been. The handle's own switches follow the World (a save knows whether its packs are on).
   */
  load(world: GameState) {
    this.newsStartId = 0;
    this.openingThoughts = undefined;
    this.world = world;
    this.loaded = world;
    this.leapfrog = world.leapfrog.enabled;
    this.papers = world.papers?.enabled ?? false;
    this.endings = !!world.endings;
    this.lastSnap = undefined;
    this.lastVersion = -1;
    this.alpha = 1;
  }

  /**
   * Anything for the app to hear about? A publish is due on a timer, or right away when the grid or buildings
   * changed; a change of card or outcome is always reported. Returns null when there is nothing new.
   */
  report(publishDue: boolean, force = false): SyncReport | null {
    return withDefs(this.def, () => this.sync(publishDue, force));
  }

  private sync(publishDue: boolean, force: boolean): SyncReport | null {
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

type SimDebug = Pick<DebugParams, "seed" | "warp" | "agents" | "discourse" | "researchers"> & Partial<Pick<DebugParams, "disaster" | "dz" | "dzPick" | "risk" | "daily" | "endings">> & { moment?: string | null; leapfrog?: boolean; papers?: boolean; collusion?: boolean; hearing?: boolean; yacht?: boolean; defection?: boolean; poaching?: boolean; auditors?: boolean; capture?: boolean; promises?: boolean; factions?: boolean; water?: boolean };

/**
 * A living campus, warped forward and dressed up per the `?seed=&warp=&agents=&discourse=` debug knobs.
 * `def` is the session's resolved mod definition (FLT-37) and `mods` its identity, kept in the World with the run.
 */
export function createSimHandle(dbg: SimDebug, def: GameDefinition | null = null, mods: RunMods | null = null): SimHandle {
  const sim = withDefs(def, () => stage(dbg));
  if (mods) sim.mods = mods;
  return new SimHandle(sim, sim.leapfrog.enabled, undefined, def);
}

function stage(dbg: SimDebug): GameState {
  // An ending's scene (`?moment=memo|takeover|thanks|front-<id>`) starts from the curated mid-game campus.
  const sim = isEndingMoment(dbg.moment) ? stageEndingMoment(dbg.moment) : createInitialState(dbg.seed);
  if (dbg.endings !== false) enableEndings(sim, dbg.daily ?? null);
  if (dbg.leapfrog === false) sim.flags.leapfrogOff = 1;
  if (dbg.papers === false) sim.flags.papersOff = 1;
  if (dbg.collusion === false) sim.flags.collusionOff = 1;
  if (dbg.hearing === false) sim.flags.hearingOff = 1;
  if (dbg.yacht === false) sim.flags.yachtOff = 1;
  if (dbg.defection === false) sim.flags.defectionOff = 1;
  if (dbg.poaching === false) sim.flags.poachingOff = 1;
  if (dbg.auditors === false) sim.flags.auditorsOff = 1;
  if (dbg.capture === false) sim.flags.captureOff = 1;
  if (dbg.promises === false) sim.flags.promisesOff = 1;
  if (dbg.factions === false) sim.flags.factionsOff = 1;
  if (dbg.water === false) sim.flags["arcOff:water-escalation"] = 1;
  const leap = parseLeapMoment(dbg.moment);
  if (dbg.warp > 0 || dbg.agents > 0 || dbg.discourse > 0 || dbg.researchers > 0 || dbg.moment || dbg.disaster) { continueTutorial(sim, true); delete sim.progression; }
  // No ladder means every system is earned: wake every pack that isn't switched off.
  if (!sim.progression) enableEarnedPacks(sim);
  for (let i = 0; i < dbg.warp * TICKS_PER_DAY; i++) tick(sim);
  if (dbg.moment === "jem-opening" || dbg.moment === "jem-confirm") stageFirstRun(sim, dbg.moment);
  else if (isMoment(dbg.moment)) stageMoment(sim, dbg.moment);
  else if (isOpsMoment(dbg.moment)) stageOps(sim, dbg.moment);
  else if (leap) stageLeapfrog(sim, leap.moment, leap.arg);
  else if (isCollusionMoment(dbg.moment)) stageCollusion(sim, dbg.moment);
  else if (isPaperMoment(dbg.moment)) stagePapers(sim, dbg.moment);
  else if (isCircusMoment(dbg.moment)) stageCircus(sim, dbg.moment);
  else if (isDramaMoment(dbg.moment)) stageDrama(sim, dbg.moment);
  else if (isAuditMoment(dbg.moment)) stageAudit(sim, dbg.moment);
  else if (isSenateMoment(dbg.moment)) stageSenate(sim, dbg.moment);
  else if (isFactionMoment(dbg.moment)) stageFactions(sim, dbg.moment);
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
  return sim;
}

export class Sim extends Context.Service<Sim, SimHandle>()("@flt/Sim") {}

/** Provide an existing handle (the renderer holds the same one). */
export const simLayer = (handle: SimHandle) => Layer.succeed(Sim, handle);
