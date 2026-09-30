// A headless Release Leapfrog run: a scripted, sensible player plays a lab for N days with the pack on and the report says
// what happened (the launch rhythm, the cards, the records, the saturations, the news cycle). Used by the tests and,
// with LEAPFROG_REPORT=1, to write the sim report that goes in the PR. Not game code.
import type { PlaceableKind } from "../../../content/buildings";
import { openEventOf } from "../../events";
import { pendingConfirmOf } from "../../guardrails";
import { outcomeOf } from "../../goals";
import type { Command } from "../../commands";
import { slopStats } from "../../slop";
import { staffOf } from "../../staff";
import { createTestCampus as createInitialState } from "../../testkit";
import { countOf, findSpot, layPaths } from "../../testkit";
import { TICKS_PER_DAY, tick } from "../../tick";
import type { GameState } from "../../types";
import { eraOfState } from "../race";
import { enableLeapfrog } from "./driver";
import { leapfrogView, type LeapfrogView } from "./view";
import { defs } from "../../defs";

const RESERVE = 400_000;

export interface HeadlessDrop {
  day: number;
  slot: "lead" | "answer";
  lab: string;
  model: string;
  claims: string[];
}

export interface HeadlessReport {
  seed: number;
  days: number;
  outcome: string;
  drops: HeadlessDrop[];
  /** Days between one lead drop and the next. */
  leadGaps: number[];
  /** Answers that came the day after their lead. */
  pairs: number;
  leads: number;
  /** Cards opened, by id. */
  cards: Record<string, number>;
  solved: { id: string; day: number }[];
  sota: number;
  maxxed: number;
  owned: number;
  eras: (number | null)[];
  finalCapability: number;
  models: number;
  view: LeapfrogView;
  world: GameState;
}

export interface HeadlessOptions {
  days?: number;
  /** How to answer a card: by id, given the World. The default answers the forced response by readiness. */
  choose?: (s: GameState, id: string) => number;
  /** Turn the pack off to get the baseline. */
  off?: boolean;
  /** Hire staff and build like the playthrough bot does; false leaves the lab as it starts. */
  build?: boolean;
  /** Stage the World before the first tick (FLT-33 turns the factions on and picks a stance here). */
  setup?: (s: GameState) => void;
  /** Extra commands for a tick, sent with the bot's own (FLT-33's safety budget and publication policy). */
  also?: (s: GameState, tick: number) => Command[];
}

/** Ship when the run is nearly done, hold when it is not, leak never; the auction gets a mid bid, the fountain is built. */
function defaultChoice(s: GameState, id: string): number {
  if (id === "shipNow") return s.training.context.progress / s.training.context.cost >= 0.85 ? 0 : 1;
  if (id === "computeAuction") return 1;
  if (id === "waterDiscourse") return s.cash > 900_000 ? 1 : 0;
  return 0;
}

export function runHeadless(seed: number, opts: HeadlessOptions = {}): HeadlessReport {
  const days = opts.days ?? 365;
  const choose = opts.choose ?? defaultChoice;
  const s = createInitialState(seed);
  if (!opts.off) enableLeapfrog(s);
  layPaths(s);
  opts.setup?.(s);
  const cards: Record<string, number> = {};
  const drops: HeadlessDrop[] = [];
  const eras: (number | null)[] = [0, null, null, null];
  let last = s.leapfrog.last;
  for (let i = 0; i < days * TICKS_PER_DAY && outcomeOf(s) !== "lost"; i++) {
    const cmds: Command[] = [];
    const open = openEventOf(s);
    // The spending check (FLT-16): like the playthrough bot, approve a planned spend while the reserve holds, else decline.
    const pending = pendingConfirmOf(s);
    if (pending) cmds.push(s.cash >= pending.cost + RESERVE ? { ...pending.command, confirmed: true } : { type: "cancelConfirm" });
    else if (open) {
      cards[open.id] = (cards[open.id] ?? 0) + 1;
      cmds.push({ type: "chooseEvent", eventId: open.id, choiceIndex: choose(s, open.id) });
    } else if (opts.build !== false && i % (TICKS_PER_DAY * 4) === 2) {
      // Operations, as the playthrough bot does it: an SRE per handful of buildings, a Janitor Bot when the paths get grubby, a Comms Rep at a full gate.
      const agents = s.walkers.filter((w) => w.kind === "agent").length;
      const protesters = s.walkers.filter((w) => w.kind === "protester").length;
      if (s.day > 15 && staffOf(s, "sre").length < 1 + Math.floor(s.buildings.length / 6)) cmds.push({ type: "hire", job: "sre" });
      else if (slopStats(s).share > 0.1 && staffOf(s, "janitor").length < Math.min(10, 1 + Math.floor(agents / 4))) cmds.push({ type: "hire", job: "janitor" });
      else if (protesters >= 10 && staffOf(s, "comms").length < 1 + Math.floor(protesters / 20)) cmds.push({ type: "hire", job: "comms" });
    } else if (opts.build !== false && i % (TICKS_PER_DAY * 4) === 0) {
      const halls = countOf(s, "hall");
      const clusters = countOf(s, "cluster");
      const gateways = countOf(s, "gateway");
      const datacenters = countOf(s, "datacenter");
      let kind: PlaceableKind | null = null;
      if (datacenters > countOf(s, "gas") && s.flags["unlocked:gas"] !== undefined) kind = "gas";
      else if (s.day > 20 && countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 40 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (s.day > 60 && countOf(s, "snack") < 1 + Math.floor(halls / 3)) kind = "snack";
      else if (gateways < Math.min(5, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (clusters + 6 * datacenters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(7, 3 + Math.floor(s.day / 90))) kind = "hall";
      else if (clusters < 12) kind = "cluster";
      if (kind && s.cash >= defs().buildings[kind].price + RESERVE) {
        const spot = findSpot(s, kind);
        if (spot) cmds.push({ type: "placeBuilding", kind, x: spot[0], z: spot[1] });
      }
    }
    if (opts.also) cmds.push(...opts.also(s, i));
    tick(s, cmds);
    const era = eraOfState(s);
    for (let e = 2; e <= era; e++) eras[e - 1] ??= s.day;
    const lf = s.leapfrog;
    if (lf.last !== last && lf.last) {
      last = lf.last;
      drops.push({ day: lf.last.day, slot: lf.last.slot, lab: lf.last.lab, model: lf.last.model, claims: lf.last.claims.map((c) => `${defs().benchById[c.bench]?.short ?? c.bench}${c.maxx ? "*" : ""}`) });
    }
  }
  const leads = drops.filter((d) => d.slot === "lead");
  const leadGaps = leads.slice(1).map((d, i) => d.day - leads[i]!.day);
  const pairs = drops.filter((d, i) => d.slot === "answer" && i > 0 && drops[i - 1]!.slot === "lead" && d.day - drops[i - 1]!.day === 1).length;
  return {
    seed,
    days: s.day,
    outcome: outcomeOf(s),
    drops,
    leadGaps,
    pairs,
    leads: leads.length,
    cards,
    solved: s.leapfrog.stats.solved.slice(),
    sota: s.leapfrog.stats.sota,
    maxxed: s.leapfrog.stats.maxxed,
    owned: s.leapfrog.stats.owned,
    eras,
    finalCapability: s.capability,
    models: s.models.length,
    view: leapfrogView(s),
    world: s,
  };
}
