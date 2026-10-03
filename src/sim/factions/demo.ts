// Debug scenes for the discourse (`?moment=factions|counterprotest|argue|statement`, FLT-33/25/56): the game is staged a moment
// before something is worth a screenshot, like sim/opsDemo.ts. Pure sim and deterministic; the game itself never uses it.
import { unpaced } from "../events";
import { defs } from "../defs";
import { runVerb } from "../verbs";
import { syncProtesters } from "../protest";
import { createRng } from "../rng";
import { TICKS_PER_DAY } from "../tick";
import type { GameState, Walker } from "../types";
import { exchange, log, pairedThoughts, settleFactions } from "./driver";
import { issueStatement } from "./statement";
import { enableFactions, nudgeRelation, pairKey } from "./state";
import { step } from "../machines/run";
import { relationMachine } from "./machines";
import { dhypot } from "../dmath";

export const FACTION_MOMENTS = ["factions", "counterprotest", "argue", "statement"] as const;
export type FactionMoment = (typeof FACTION_MOMENTS)[number];
export const isFactionMoment = (s: string | null | undefined): s is FactionMoment => !!s && (FACTION_MOMENTS as readonly string[]).includes(s);

/** Push a relation to `value` and let its machine catch up, logging what it did the way midnight would. */
function relate(s: GameState, a: string, b: string, value: number) {
  const f = s.factions!;
  const key = pairKey(a, b);
  const stored = f.relations[key];
  if (!stored) return;
  nudgeRelation(s, a, b, value - stored.context.value);
  const r = step(relationMachine, f.relations[key]!, { type: "DAY", value });
  f.relations[key] = r.stored;
  const [na, nb] = [defs().factionById(a)?.name ?? a, defs().factionById(b)?.name ?? b];
  for (const e of r.effects) {
    if (e.type === "ALLIED") (f.counts.alliances++, log(s, f, `${na} and ${nb} are allies now.`, "good", [a, b]));
    else if (e.type === "SCHISM") (f.counts.schisms++, log(s, f, `Schism: ${na} and ${nb} have split.`, "bad", [a, b]));
    else if (e.type === "FEUD") (f.counts.feuds++, log(s, f, `${na} and ${nb} are feuding.`, "bad", [a, b]));
  }
}

/**
 * A lab that has been shipping fast and open for a season: the Accelerationists and the open-weights crowd are fans
 * (and allies), the Doomers march, and the Safetyists, once the Doomers' allies, have just split with them.
 */
function stageDiscourse(s: GameState) {
  const f = s.factions!;
  f.pace = 2.2;
  f.openness = 1.6;
  f.trouble = 0.6;
  settleFactions(s);
  relate(s, "accelerationists", "open-weights", 70);
  relate(s, "doomers", "safetyists", 70);
  relate(s, "doomers", "safetyists", -70);
  relate(s, "accelerationists", "doomers", -80);
  f.why.doomers = { text: "You shipped another model. They updated the spreadsheet.", day: s.day, amount: -8 };
  f.why.accelerationists = { text: "More compute. The line goes up.", day: s.day, amount: 6 };
}

/** Two walkers who are passing each other on a path, from factions that are feuding, say so. */
function stageArgument(s: GameState) {
  const walking = s.walkers.filter((w) => w.kind !== "protester" && w.route.length > 0);
  let best: [Walker, Walker] | null = null;
  let bestD = Infinity;
  for (let i = 0; i < walking.length; i++) {
    for (let j = i + 1; j < walking.length; j++) {
      const d = dhypot(walking[i]!.x - walking[j]!.x, walking[i]!.z - walking[j]!.z);
      if (d > 0.6 && d < bestD) [best, bestD] = [[walking[i]!, walking[j]!], d];
    }
  }
  if (!best) return;
  const [a, b] = best;
  a.faction = "accelerationists";
  b.faction = "doomers";
  const da = defs().factionById("accelerationists");
  const db = defs().factionById("doomers");
  if (!da || !db) return;
  const rng = createRng(s.factions!.rngState);
  const [said, reply] = exchange(rng, da, db);
  s.factions!.rngState = rng.state();
  pairedThoughts(s, a, said, da.id, b, reply, db.id);
  s.factions!.counts.arguments++;
  s.factions!.lastArgue = s.tick;
}

/** The Water Discourse at its height: a documentary aired, and the Water Truthers Truthers across the path from it. */
function stageCounterprotest(s: GameState) {
  s.waterDiscourse = 48;
  s.day = Math.max(s.day, 40);
  s.tick = s.day * TICKS_PER_DAY + (s.tick % TICKS_PER_DAY);
  const arc = defs().arcs.find((a) => a.id === "water-escalation");
  const rng = createRng(s.rngState);
  if (arc && !s.flags["arcOff:water-escalation"]) {
    s.modArcs = { ...s.modArcs, [arc.id]: { value: "counter", context: { enteredTick: s.tick } } };
    runVerb({ state: s, rng, run: null, owner: arc.id }, { type: "faction.rally", params: { faction: "truthers-truthers", against: ["ethicists", "luddites"], share: 0.6 } });
  }
  syncProtesters(s, rng, true);
  s.rngState = rng.state();
}

export function stageFactions(s: GameState, moment: FactionMoment) {
  unpaced(s);
  enableFactions(s);
  if (!s.factions) return;
  stageDiscourse(s);
  if (moment === "argue") stageArgument(s);
  if (moment === "counterprotest" || moment === "statement") stageCounterprotest(s);
  else {
    const rng = createRng(s.rngState);
    syncProtesters(s, rng, true);
    s.rngState = rng.state();
  }
  // FLT-56: three crowds in three colours at the gate, and the lab addresses the Doomers (the intern writes it).
  if (moment === "statement") {
    s.cash = Math.max(s.cash, 100_000);
    issueStatement(s, "doomers");
  }
  s.version++;
}
