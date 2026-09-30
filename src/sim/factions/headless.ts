// A headless year of the discourse (FLT-33/25): the Release Leapfrog bot plays a lab with the factions on, under a
// stance you pick (open + fast, closed + careful, or the default), and the report says how each faction ended up,
// what the relations did and what happened at the gate. Used by the tests and, with FACTIONS_REPORT=1, to write the
// sim report that goes in the PR. Not game code.
import type { Command } from "../commands";
import type { PublicationPolicy } from "../race/papers/policy";
import { runHeadless } from "../race/leapfrog/headless";
import { TICKS_PER_DAY } from "../tick";
import type { GameState } from "../types";
import { defs } from "../defs";
import { enablePapers } from "../race/papers/driver";
import { enableFactions, meterOf, moodOf, relationStateOf, type FactionsState } from "./state";
import { people } from "../ecs/protesters";

export interface Strategy {
  name: string;
  policy?: PublicationPolicy;
  /** The safety budget, 0 to 3. */
  safety?: number;
  /** Card answers by id; anything missing gets the Leapfrog bot's default. */
  cards?: Record<string, number>;
}

/** Ship the moment it is ready, release weights, sign nothing (a pause "over the holidays" is not nothing, it is a holiday). */
export const OPEN_FAST: Strategy = {
  name: "open + fast",
  policy: "Open",
  safety: 0,
  cards: {
    shipNow: 0, openWeights: 1, waterDiscourse: 2, "fx:accel-unfollow": 0, "fx:accel-vibeshift": 2, "fx:safety-letter": 2,
    "fx:doom-pause": 1, "fx:open-torrent": 0, "fx:open-jam": 1, "fx:vc-pivot": 0, "fx:wonk-framework": 1,
  },
};

/** Hold every release for a counter-launch, publish nothing, fund the evals, sign the letter. */
export const CLOSED_CAREFUL: Strategy = {
  name: "closed + careful",
  policy: "Closed",
  safety: 2,
  cards: {
    shipNow: 1, openWeights: 2, waterDiscourse: 0, "fx:accel-unfollow": 2, "fx:safety-letter": 0, "fx:safety-reading": 0,
    "fx:doom-pause": 0, "fx:open-torrent": 2, "fx:vc-pivot": 2, "fx:wonk-framework": 0, "fx:ethics-labels": 0,
  },
};

/** Split every difference: Selective papers, a token safety budget, and the middle answer on every faction card. */
export const COMPROMISE: Strategy = {
  name: "compromise",
  policy: "Selective",
  safety: 1,
  cards: {
    "fx:accel-vibeshift": 1, "fx:accel-unfollow": 1, "fx:safety-reading": 1, "fx:safety-letter": 1, "fx:doom-pause": 1,
    "fx:doom-bakesale": 1, "fx:ethics-labels": 1, "fx:ethics-panel": 1, "fx:open-torrent": 1, "fx:open-jam": 1,
    "fx:vc-dinner": 1, "fx:vc-pivot": 1, "fx:wonk-memo": 1, "fx:wonk-framework": 1, "fx:luddite-carousel": 1,
    "fx:luddite-brand": 1, "fx:normie-toast": 1, "fx:normie-grandma": 1, waterDiscourse: 1,
  },
};

export interface FactionLine {
  id: string;
  meter: number;
  min: number;
  max: number;
  mood: string;
  /** Days spent in each mood. */
  days: Record<string, number>;
}

export interface FactionsReport {
  strategy: string;
  seed: number;
  days: number;
  factions: FactionLine[];
  counts: FactionsState["counts"];
  /** First day each relation went allied / feuding, with the pair. */
  firstAlliance: { day: number; pair: string } | null;
  firstSchism: { day: number; pair: string } | null;
  /** The most protesters at the gate at once, and the most in a second crowd. */
  maxWater: number;
  maxCrowd: number;
  /** Days on which two crowds were at the gate together. */
  twoCrowdDays: number;
  /** The water escalation's states, in the order it first reached them. */
  water: string[];
  cards: Record<string, number>;
  log: string[];
  world: GameState;
}

export function runFactions(seed: number, strategy: Strategy = { name: "default" }, days = 365): FactionsReport {
  const lines = new Map<string, FactionLine>();
  let firstAlliance: FactionsReport["firstAlliance"] = null;
  let firstSchism: FactionsReport["firstSchism"] = null;
  let maxWater = 0;
  let maxCrowd = 0;
  let twoCrowdDays = 0;
  let lastDay = -1;
  let schisms = 0;
  const water: string[] = [];
  const report = runHeadless(seed, {
    days,
    choose: (s, id) => strategy.cards?.[id] ?? (id === "computeAuction" ? 1 : id === "shipNow" ? (s.training.context.progress / s.training.context.cost >= 0.85 ? 0 : 1) : 0),
    setup: (s) => {
      // The test campus has no ladder, so turn on what Level 4 and 5 would have.
      enablePapers(s);
      enableFactions(s);
    },
    also: (s, i) => {
      const cmds: Command[] = [];
      if (i === 1 && strategy.policy) cmds.push({ type: "setPublicationPolicy", policy: strategy.policy });
      if (i === 1 && strategy.safety) cmds.push({ type: "setSafetySpend", level: strategy.safety });
      // Look at the World once a tick for the gate, once a day for the rest.
      const water0 = people(s).filter((w) => w.kind === "protester" && w.crowd === undefined).length;
      const crowds = new Map<string, number>();
      for (const w of people(s)) if (w.crowd !== undefined) crowds.set(w.crowd, (crowds.get(w.crowd) ?? 0) + 1);
      maxWater = Math.max(maxWater, water0);
      for (const n of crowds.values()) maxCrowd = Math.max(maxCrowd, n);
      const arc = s.modArcs?.["water-escalation"]?.value;
      const at = typeof arc === "string" ? arc : JSON.stringify(arc);
      if (arc !== undefined && !water.includes(at)) water.push(at);
      if (s.day !== lastDay && i % TICKS_PER_DAY === 0) {
        lastDay = s.day;
        if ((water0 > 0 ? 1 : 0) + crowds.size >= 2) twoCrowdDays++;
        const f = s.factions;
        if (f) {
          for (const def of defs().factions) {
            const meter = meterOf(s, def.id);
            const line = lines.get(def.id) ?? { id: def.id, meter, min: meter, max: meter, mood: "calm", days: {} };
            line.meter = meter;
            line.min = Math.min(line.min, meter);
            line.max = Math.max(line.max, meter);
            line.mood = moodOf(s, def.id);
            line.days[line.mood] = (line.days[line.mood] ?? 0) + 1;
            lines.set(def.id, line);
          }
          for (const key of Object.keys(f.relations)) {
            const [a = "", b = ""] = key.split("|");
            if (!firstAlliance && relationStateOf(s, a, b) === "allied") firstAlliance = { day: s.day, pair: key };
          }
          if (f.counts.schisms > schisms && !firstSchism) {
            const item = [...f.log].reverse().find((l) => l.text.startsWith("Schism"));
            firstSchism = { day: s.day, pair: item?.factions.join("|") ?? "?" };
          }
          schisms = f.counts.schisms;
        }
      }
      return cmds;
    },
  });
  const f = report.world.factions!;
  return {
    strategy: strategy.name,
    seed,
    days: report.days,
    factions: [...lines.values()],
    counts: f.counts,
    firstAlliance,
    firstSchism,
    maxWater,
    maxCrowd,
    twoCrowdDays,
    water,
    cards: report.cards,
    log: f.log.map((l) => `d${l.day} ${l.text}`),
    world: report.world,
  };
}

/** The report as a markdown table, for the PR. */
export function factionsTable(reports: FactionsReport[]): string {
  const head = `| faction | ${reports.map((r) => `${r.strategy} (end / min..max)`).join(" | ")} |`;
  const rule = `|---|${reports.map(() => "---").join("|")}|`;
  const rows = reports[0]!.factions.map((line) => {
    const cells = reports.map((r) => {
      const l = r.factions.find((x) => x.id === line.id)!;
      return `${Math.round(l.meter)} (${Math.round(l.min)}..${Math.round(l.max)}) ${l.mood}`;
    });
    return `| ${line.id} | ${cells.join(" | ")} |`;
  });
  const tally = (k: keyof FactionsState["counts"]) => `| ${k} | ${reports.map((r) => r.counts[k]).join(" | ")} |`;
  return [head, rule, ...rows, ...(["alliances", "schisms", "feuds", "arguments", "opEds", "shouts", "marches", "hype", "boycotts"] as const).map(tally),
    `| max at the gate (water / faction crowd) | ${reports.map((r) => `${r.maxWater} / ${r.maxCrowd}`).join(" | ")} |`,
    `| days with two crowds | ${reports.map((r) => r.twoCrowdDays).join(" | ")} |`].join("\n");
}
