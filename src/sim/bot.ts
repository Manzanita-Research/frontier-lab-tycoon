// The scripted "reasonable player" the playthrough tests share (moved out of playthrough.test.ts for FLT-11, whose
// ending tests play the same bot on into Era 4). Builds gateways first, then compute and halls as cash allows, powers the
// Datacenters the auctions hand out, and answers every card sensibly. Not game code.
import { BUILDINGS, type PlaceableKind } from "../content/buildings";
import { type Command } from "./commands";
import { openEventOf } from "./events";
import { outcomeOf } from "./goals";
import { eraOfState } from "./race/race";
import { slopStats } from "./slop";
import { staffOf } from "./staff";
import { createTestCampus as createInitialState } from "./testkit";
import { countOf, findSpot, layPaths } from "./testkit";
import { TICKS_PER_DAY, tick } from "./tick";
import type { GameState } from "./types";
import { pendingConfirmOf } from "./guardrails";
import { people } from "./ecs/protesters";

const RESERVE = 400_000;

export interface Report {
  seed: number;
  outcome: string;
  /** The day the scenario was won (or the last day played). */
  endDay: number;
  /** First days at each era, or null. */
  eraDays: (number | null)[];
  /** First day at #1 on the Arena, and the worst rank seen after that. */
  firstTop: number | null;
  worstAfterTop: number;
  /** Cards seen, by id. */
  cards: Record<string, number>;
  /** Auctions won: Datacenters standing at the end. */
  datacenters: number;
  minCash: number;
}

/** What the bot answers, by card: mid bid at auctions, a price cut for open weights, the fountain for water. */
function choice(s: GameState, id: string): number {
  if (id === "computeAuction") return 1;
  if (id === "waterDiscourse") return s.cash > 900_000 ? 1 : 0;
  return 0;
}

export interface BotOptions {
  halls?: number;
  days?: number;
  keepPlaying?: boolean;
  /** Runs once on the fresh campus (FLT-11 switches the endings on here). */
  setup?: (s: GameState) => void;
  /** A card answer of your own; undefined falls back to the bot's. */
  pick?: (s: GameState, id: string) => number | undefined;
  /** Stop as soon as this holds. */
  until?: (s: GameState) => boolean;
  /** The World at the end, for tests that want more than the report. */
  out?: { state?: GameState };
}

export function playBot(seed: number, opts: BotOptions = {}): Report {
  const s = createInitialState(seed);
  layPaths(s);
  opts.setup?.(s);
  if (opts.out) opts.out.state = s;
  const maxHalls = opts.halls ?? 7;
  const cards: Record<string, number> = {};
  const eraDays: (number | null)[] = [0, null, null, null];
  let firstTop: number | null = null;
  let worstAfterTop = 0;
  let wonDay: number | null = null;
  let minCash = Infinity;
  const maxTicks = (opts.days ?? 1100) * TICKS_PER_DAY;
  for (let i = 0; i < maxTicks && outcomeOf(s) !== "lost"; i++) {
    const cmds: Command[] = [];
    const open = openEventOf(s);
    // This established growth bot approves its planned spending while preserving the cash reserve.
    // The separate first-run pacing bot declines confirmations rather than playing this aggressively.
    if (pendingConfirmOf(s)) {
      const pending = pendingConfirmOf(s)!;
      cmds.push(s.cash >= pending.cost + RESERVE ? { ...pending.command, confirmed: true } : { type: "cancelConfirm" });
    }
    else if (open) {
      cards[open.id] = (cards[open.id] ?? 0) + 1;
      cmds.push({ type: "chooseEvent", eventId: open.id, choiceIndex: opts.pick?.(s, open.id) ?? choice(s, open.id) });
    } else if (i % (TICKS_PER_DAY * 4) === 2) {
      // Operations: an SRE per handful of buildings, a Janitor Bot per handful of agents once the paths get grubby,
      // a Comms Rep when the gate fills up. Salaries are a few percent of a day's income, and a lab without them slides.
      const agents = s.walkers.filter((w) => w.kind === "agent").length;
      const protesters = people(s).filter((w) => w.kind === "protester").length;
      if (s.day > 15 && staffOf(s, "sre").length < 1 + Math.floor(s.buildings.length / 6)) cmds.push({ type: "hire", job: "sre" });
      else if (slopStats(s).share > 0.1 && staffOf(s, "janitor").length < Math.min(10, 1 + Math.floor(agents / 4))) cmds.push({ type: "hire", job: "janitor" });
      else if (protesters >= 10 && staffOf(s, "comms").length < 1 + Math.floor(protesters / 20)) cmds.push({ type: "hire", job: "comms" });
    } else if (i % (TICKS_PER_DAY * 4) === 0) {
      const halls = countOf(s, "hall");
      const clusters = countOf(s, "cluster");
      const gateways = countOf(s, "gateway");
      const datacenters = countOf(s, "datacenter");
      let kind: PlaceableKind | null = null;
      // Keep the researchers fed and rested, or they hand in their boxes: a bar, a snack wall and pods per few halls.
      if (datacenters > countOf(s, "gas") && s.flags["unlocked:gas"] !== undefined) kind = "gas";
      else if (s.day > 20 && countOf(s, "kombucha") < 1 + Math.floor(halls / 2)) kind = "kombucha";
      else if (s.day > 40 && countOf(s, "nap") < Math.ceil(halls / 2)) kind = "nap";
      else if (s.day > 60 && countOf(s, "snack") < 1 + Math.floor(halls / 3)) kind = "snack";
      else if (gateways < Math.min(5, 1 + Math.floor(s.day / 50))) kind = "gateway";
      else if (clusters + 6 * datacenters < 3 * halls) kind = "cluster";
      else if (halls < Math.min(maxHalls, 3 + Math.floor(s.day / 90))) kind = "hall";
      else if (clusters < 12) kind = "cluster";
      if (kind && s.cash >= BUILDINGS[kind].price + RESERVE) {
        const spot = findSpot(s, kind);
        if (spot) cmds.push({ type: "placeBuilding", kind, x: spot[0], z: spot[1] });
      }
    }
    tick(s, cmds);
    minCash = Math.min(minCash, s.cash);
    const era = eraOfState(s);
    for (let e = 2; e <= era; e++) eraDays[e - 1] ??= s.day;
    if (s.race.rank === 1) firstTop ??= s.day;
    if (firstTop !== null) worstAfterTop = Math.max(worstAfterTop, s.race.rank);
    if (outcomeOf(s) === "won") {
      wonDay ??= s.day;
      if (!opts.keepPlaying) break;
    }
    if (opts.until?.(s) || outcomeOf(s) === "ended") break;
  }
  return { seed, outcome: outcomeOf(s), endDay: wonDay ?? s.day, eraDays, firstTop, worstAfterTop, cards, datacenters: countOf(s, "datacenter"), minCash };
}
